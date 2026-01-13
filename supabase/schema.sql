create extension if not exists "uuid-ossp";

-- APP SETTINGS (Global Configuration)
create table if not exists public.app_settings (
  key text primary key,
  value text not null,
  updated_at timestamptz default now()
);

alter table public.app_settings enable row level security;
create policy "Settings are viewable by everyone" on public.app_settings for select using (true);
create policy "Only admins can update settings" on public.app_settings for all using (
  exists ( select 1 from public.profiles where id = auth.uid() and role = 'admin' )
);

-- Insert default settings
insert into public.app_settings (key, value) values
  ('site_url', ''),
  ('donation_url', ''),
  ('registration_enabled', 'true'),
  ('clear_history_enabled', 'false')
on conflict (key) do nothing;

-- 1. PROFILES
create table public.profiles (
  id uuid references auth.users not null primary key,
  username text unique,
  avatar_url text,
  role text default 'user' check (role in ('user', 'admin', 'moderator')),
  watch_history jsonb default '{}'::jsonb, -- Netflix-style bundled history
  last_seen_announcements timestamptz default now(), -- For notification badge
  last_seen_activity timestamptz default now(), -- For activity badge
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
  ('donation_url', 'https://ko-fi.com'),
  ('registration_enabled', 'true')
on conflict do nothing;

-- 11. PLAYLIST ENGAGEMENT (Likes & Analytics)

-- Add analytics columns to playlists
alter table public.playlists add column if not exists likes_count int default 0;
alter table public.playlists add column if not exists analytics jsonb default '{"total_views": 0, "weekly_views": 0, "monthly_views": 0, "week_start": null, "month_start": null, "last_viewers": []}'::jsonb;

-- Playlist Likes Junction Table
create table if not exists public.playlist_likes (
  user_id uuid references public.profiles(id) on delete cascade not null,
  playlist_id uuid references public.playlists(id) on delete cascade not null,
  created_at timestamptz default now(),
  primary key (user_id, playlist_id)
);

alter table public.playlist_likes enable row level security;
create policy "Anyone can view likes" on public.playlist_likes for select using (true);
create policy "Users can like playlists" on public.playlist_likes for insert with check (auth.uid() = user_id);
create policy "Users can unlike playlists" on public.playlist_likes for delete using (auth.uid() = user_id);

-- RPC: Like Playlist
create or replace function like_playlist(p_playlist_id uuid)
returns void as $$
begin
  -- Insert like
  insert into public.playlist_likes (user_id, playlist_id)
  values (auth.uid(), p_playlist_id)
  on conflict do nothing;
  
  -- Increment counter
  update public.playlists
  set likes_count = likes_count + 1
  where id = p_playlist_id;
end;
$$ language plpgsql security definer;

-- RPC: Unlike Playlist
create or replace function unlike_playlist(p_playlist_id uuid)
returns void as $$
begin
  -- Delete like
  delete from public.playlist_likes
  where user_id = auth.uid() and playlist_id = p_playlist_id;
  
  -- Decrement counter
  update public.playlists
  set likes_count = greatest(likes_count - 1, 0)
  where id = p_playlist_id;
end;
$$ language plpgsql security definer;

-- RPC: Track Playlist View
create or replace function track_playlist_view(p_playlist_id uuid)
returns void as $$
declare
  current_analytics jsonb;
  current_week text;
  current_month text;
  stored_week text;
  stored_month text;
  new_analytics jsonb;
begin
  current_analytics := (select analytics from public.playlists where id = p_playlist_id);
  current_week := to_char(now(), 'IYYY-IW'); -- ISO week format
  current_month := to_char(now(), 'YYYY-MM');
  
  stored_week := current_analytics->>'week_start';
  stored_month := current_analytics->>'month_start';
  
  -- Build new analytics object
  new_analytics := jsonb_build_object(
    'total_views', coalesce((current_analytics->>'total_views')::int, 0) + 1,
    'weekly_views', case when stored_week = current_week then coalesce((current_analytics->>'weekly_views')::int, 0) + 1 else 1 end,
    'monthly_views', case when stored_month = current_month then coalesce((current_analytics->>'monthly_views')::int, 0) + 1 else 1 end,
    'week_start', current_week,
    'month_start', current_month,
    'last_viewers', (
      select jsonb_agg(viewer order by (viewer->>'timestamp')::bigint desc)
      from (
        select jsonb_array_elements(coalesce(current_analytics->'last_viewers', '[]'::jsonb)) as viewer
        union all
        select jsonb_build_object('user_id', auth.uid()::text, 'timestamp', extract(epoch from now())::bigint)
        limit 10
      ) viewers
    )
  );
  
  update public.playlists
  set analytics = new_analytics
  where id = p_playlist_id;
end;
$$ language plpgsql security definer;

-- ========================================
-- PERFORMANCE INDEXES
-- ========================================

-- Critical: Index for playlist_items queries (main bottleneck)
create index if not exists idx_playlist_items_playlist_id 
on public.playlist_items(playlist_id);

-- Index for ordering playlist items by added_at
create index if not exists idx_playlist_items_added_at 
on public.playlist_items(playlist_id, added_at desc);

-- Indexes for playlist analytics sorting (trending/popular pages)
create index if not exists idx_playlists_weekly_views 
on public.playlists using btree ((analytics->'weekly_views'));

create index if not exists idx_playlists_monthly_views 
on public.playlists using btree ((analytics->'monthly_views'));

create index if not exists idx_playlists_likes_count 
on public.playlists(likes_count desc);

-- Index for featured playlists
create index if not exists idx_playlists_featured 
on public.playlists(is_featured, is_public) 
where is_featured = true;

-- Index for user's playlists
create index if not exists idx_playlists_user_id 
on public.playlists(user_id, created_at desc);

-- Composite index for playlist_likes lookups
create index if not exists idx_playlist_likes_user_playlist 
on public.playlist_likes(user_id, playlist_id);

-- ========================================
-- WATCH HISTORY AUTO-CLEANUP
-- ========================================

-- Function: Clean up watch history for inactive users (2+ weeks)
create or replace function cleanup_inactive_watch_history()
returns void as $$
declare
  two_weeks_ago bigint;
  user_record record;
  max_timestamp bigint;
begin
  -- Calculate timestamp for 2 weeks ago (Unix milliseconds)
  two_weeks_ago := extract(epoch from (now() - interval '14 days'))::bigint * 1000;
  
  -- Loop through all users with watch history
  for user_record in 
    select id, watch_history 
    from public.profiles 
    where watch_history is not null 
      and watch_history::text != '{}'
  loop
    -- Find the most recent lastUpdated timestamp in this user's history
    select max((value->>'lastUpdated')::bigint) into max_timestamp
    from jsonb_each(user_record.watch_history);
    
    -- If most recent activity is older than 2 weeks, clear history
    if max_timestamp < two_weeks_ago then
      update public.profiles
      set watch_history = '{}'::jsonb
      where id = user_record.id;
      
      raise notice 'Cleared watch history for user %', user_record.id;
    end if;
  end loop;
end;
$$ language plpgsql;

-- Schedule: Run on 1st of every month at 2 AM UTC
select cron.schedule(
  'cleanup-inactive-watch-history',
  '0 2 1 * *',  -- 2 AM on the 1st of each month
  'select cleanup_inactive_watch_history();'
);

-- ========================================
-- USER CLEAR HISTORY FEATURE
-- ========================================

-- Function: Clear OWN watch history (User initiated)
create or replace function clear_my_watch_history()
returns void as $$
declare
  is_enabled text;
begin
  -- 1. Check if feature is enabled in App Settings
  -- Assuming app_settings is a simple key-value table or single row
  select value into is_enabled 
  from public.app_settings 
  where key = 'clear_history_enabled';
  
  if is_enabled != 'true' then
    raise exception 'This feature is currently disabled by the administrator.';
  end if;

  -- 2. Clear history for calling user
  update public.profiles
  set watch_history = '{}'::jsonb
  where id = auth.uid();
  
end;
$$ language plpgsql security definer;

