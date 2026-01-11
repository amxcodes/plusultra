-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- 1. PROFILES
create table public.profiles (
  id uuid references auth.users not null primary key,
  username text unique,
  avatar_url text,
  role text default 'user' check (role in ('user', 'admin', 'moderator')),
  watch_history jsonb default '{}'::jsonb, -- Netflix-style bundled history
  created_at timestamptz default now()
);

-- RPC to atomically update a single history item inside the JSON blob
create or replace function update_watch_history(
  p_user_id uuid,
  p_tmdb_id text,
  p_data jsonb
)
returns void as $$
begin
  update public.profiles
  set watch_history = jsonb_set(
    coalesce(watch_history, '{}'::jsonb), 
    array[p_tmdb_id], 
    p_data
  )
  where id = p_user_id;
end;
$$ language plpgsql security definer;

-- Secure Profiles (RLS)
alter table public.profiles enable row level security;
create policy "Public profiles are viewable by everyone." on public.profiles for select using (true);
create policy "Users can insert their own profile." on public.profiles for insert with check (auth.uid() = id);
create policy "Users can update own profile." on public.profiles for update using (auth.uid() = id);

-- 2. PLAYLISTS (Unified List System)
create table public.playlists (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) not null,
  name text not null,
  description text,
  is_public boolean default true,
  is_featured boolean default false, -- Admin only: Promotes playlist to front page
  type text default 'custom' check (type in ('custom', 'watch_later', 'favorites', 'curated')), 
  created_at timestamptz default now()
);

-- Secure Playlists (RLS)
alter table public.playlists enable row level security;
create policy "Public playlists are viewable by everyone." on public.playlists for select using (is_public = true);
create policy "Users can view their own private playlists." on public.playlists for select using (auth.uid() = user_id);
create policy "Users can insert their own playlists." on public.playlists for insert with check (auth.uid() = user_id);
create policy "Users can update own playlists." on public.playlists for update using (auth.uid() = user_id);
create policy "Users can delete own playlists." on public.playlists for delete using (auth.uid() = user_id);
create policy "Admins can view all playlists." on public.playlists for select using (
  exists ( select 1 from public.profiles where id = auth.uid() and role = 'admin' )
);
create policy "Admins can update all playlists." on public.playlists for update using (
  exists ( select 1 from public.profiles where id = auth.uid() and role = 'admin' )
);

-- 3. PLAYLIST ITEMS
create table public.playlist_items (
  playlist_id uuid references public.playlists(id) on delete cascade not null,
  tmdb_id text not null,
  media_type text not null,
  metadata jsonb, -- Stores title, image, etc. snapshot
  added_at timestamptz default now(),
  primary key (playlist_id, tmdb_id)
);

-- Secure Items (RLS)
alter table public.playlist_items enable row level security;
create policy "Items viewable if playlist is viewable" on public.playlist_items for select using (
  exists ( select 1 from public.playlists p where p.id = playlist_items.playlist_id and (p.is_public = true or p.user_id = auth.uid()) )
);
create policy "Admins can view all playlist items." on public.playlist_items for select using (
  exists ( select 1 from public.profiles where id = auth.uid() and role = 'admin' )
);
create policy "Users can add items to own playlists" on public.playlist_items for insert with check (
  exists ( select 1 from public.playlists p where p.id = playlist_items.playlist_id and p.user_id = auth.uid() )
);
create policy "Users can remove items from own playlists" on public.playlist_items for delete using (
  exists ( select 1 from public.playlists p where p.id = playlist_items.playlist_id and p.user_id = auth.uid() )
);

-- 4. WATCH HISTORY (Legacy / Deprecated in favor of profiles.watch_history JSONB)
-- create table public.watch_history ... (Deprecated)


-- 5. ANNOUNCEMENTS (Admin)
create table public.announcements (
  id uuid default uuid_generate_v4() primary key,
  title text not null,
  content text not null,
  type text default 'info' check (type in ('info', 'warning', 'success')),
  is_active boolean default true,
  created_at timestamptz default now()
);

alter table public.announcements enable row level security;
create policy "Announcements are viewable by everyone" on public.announcements for select using (true);
create policy "Admins can manage announcements" on public.announcements for all using (
  exists ( select 1 from public.profiles where id = auth.uid() and role = 'admin' )
);

-- 6. FEATURED SECTIONS (Editor's Picks / Home Page Rows)
create table public.featured_sections (
  id uuid default uuid_generate_v4() primary key,
  title text not null,
  description text,
  content_type text check (content_type in ('movie', 'tv', 'mixed')),
  display_order int default 0,
  is_active boolean default true,
  items jsonb, -- Array of TMDB IDs or objects: [{id: 123, type: 'movie'}, ...]
  created_at timestamptz default now()
);

alter table public.featured_sections enable row level security;
create policy "Featured sections viewable by everyone" on public.featured_sections for select using (is_active = true);
create policy "Admins can manage sections" on public.featured_sections for all using (
  exists ( select 1 from public.profiles where id = auth.uid() and role = 'admin' )
);

-- 6b. FEATURED MOVIES (Simple List for Home Page)
create table if not exists public.featured_movies (
  id uuid default uuid_generate_v4() primary key,
  tmdb_id text not null,
  media_type text not null,
  metadata jsonb,
  created_at timestamptz default now()
);

alter table public.featured_movies enable row level security;
create policy "Featured movies viewable by everyone" on public.featured_movies for select using (true);
create policy "Admins can manage featured movies" on public.featured_movies for all using (
  exists ( select 1 from public.profiles where id = auth.uid() and role = 'admin' )
);

-- 7. UPCOMING EVENTS (Premieres / Live)
create table public.upcoming_events (
  id uuid default uuid_generate_v4() primary key,
  title text not null,
  description text,
  poster_url text,
  starts_at timestamptz not null,
  tmdb_id text, -- Optional link to content
  media_type text,
  is_active boolean default true,
  created_at timestamptz default now()
);

alter table public.upcoming_events enable row level security;
create policy "Events viewable by everyone" on public.upcoming_events for select using (is_active = true);
create policy "Admins can manage events" on public.upcoming_events for all using (
  exists ( select 1 from public.profiles where id = auth.uid() and role = 'admin' )
);

-- 8. FOLLOWS
create table public.follows (
  follower_id uuid references public.profiles(id) not null,
  following_id uuid references public.profiles(id) not null,
  created_at timestamptz default now(),
  primary key (follower_id, following_id)
);

alter table public.follows enable row level security;
create policy "Follows viewable by everyone" on public.follows for select using (true);
create policy "Users can follow others" on public.follows for insert with check (auth.uid() = follower_id);
create policy "Users can unfollow" on public.follows for delete using (auth.uid() = follower_id);

-- 7. FUNCTION & TRIGGER: Handle New User
create or replace function public.handle_new_user() 
returns trigger as $$
begin
  -- 1. Create Profile
  insert into public.profiles (id, username, avatar_url, role)
  values (
    new.id,
    new.raw_user_meta_data->>'username',
    coalesce(
      new.raw_user_meta_data->>'avatar_url',
      'https://i.pinimg.com/736x/c0/2c/6e/c02c6ec94553229c9bbce6090710714b.jpg' -- Young Deku Default
    ),
    'user'
  );

  -- 2. Create Default 'Watch Later' Playlist
  insert into public.playlists (user_id, name, is_public, type)
  values (new.id, 'Watch Later', false, 'watch_later');

  -- 3. Create Default 'Favorites' Playlist
  insert into public.playlists (user_id, name, is_public, type)
  values (new.id, 'Favorites', true, 'favorites');

  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 9. WATCH PARTIES
create table public.watch_parties (
  id uuid default uuid_generate_v4() primary key,
  host_id uuid references public.profiles(id) on delete cascade not null,
  tmdb_id text not null,
  media_type text not null check (media_type in ('movie', 'tv')),
  season int,
  episode int,
  current_server text default 'cinemaos',
  invite_code text unique not null,
  created_at timestamptz default now(),
  expires_at timestamptz default now() + interval '4 hours',
  max_participants int default 4
);

-- Generate 6-character invite codes
create or replace function generate_invite_code()
returns text as $$
  select upper(substring(md5(random()::text) from 1 for 6));
$$ language sql;

-- Set default invite code
alter table public.watch_parties 
  alter column invite_code set default generate_invite_code();

-- RLS Policies
alter table public.watch_parties enable row level security;
create policy "Users can create parties" on public.watch_parties 
  for insert with check (auth.uid() = host_id);
create policy "Anyone can view active parties" on public.watch_parties 
  for select using (expires_at > now());
create policy "Host can update party" on public.watch_parties 
  for update using (auth.uid() = host_id);
create policy "Host can delete party" on public.watch_parties 
  for delete using (auth.uid() = host_id);

-- Auto-cleanup expired parties
create or replace function cleanup_expired_parties()
returns void as $$
  delete from public.watch_parties where expires_at < now();
$$ language sql;

-- 10. APP SETTINGS
create table public.app_settings (
  key text primary key,
  value text
);

alter table public.app_settings enable row level security;

-- Everyone can read settings (needed for site URL and donation link)
create policy "Settings viewable by everyone" 
  on public.app_settings for select using (true);

-- Only admins can modify
create policy "Admins can manage settings" 
  on public.app_settings for all using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- Insert default values
insert into public.app_settings (key, value) values 
  ('site_url', 'http://localhost:5173'),
  ('donation_url', 'https://ko-fi.com')
on conflict do nothing;
