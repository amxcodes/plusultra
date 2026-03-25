create table if not exists public.curator_memories (
    user_id uuid primary key references auth.users(id) on delete cascade,
    memory jsonb not null default jsonb_build_object(
        'sessions', 0,
        'promptHistory', '[]'::jsonb,
        'smashed', '[]'::jsonb,
        'passed', '[]'::jsonb,
        'updatedAt', floor(extract(epoch from now()) * 1000)::bigint
    ),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

alter table public.curator_memories enable row level security;

create or replace function public.set_curator_memories_updated_at()
returns trigger
language plpgsql
set search_path to public
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

drop trigger if exists curator_memories_set_updated_at on public.curator_memories;
create trigger curator_memories_set_updated_at
before update on public.curator_memories
for each row
execute function public.set_curator_memories_updated_at();

drop policy if exists curator_memories_select_own on public.curator_memories;
create policy curator_memories_select_own
on public.curator_memories
for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists curator_memories_insert_own on public.curator_memories;
create policy curator_memories_insert_own
on public.curator_memories
for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists curator_memories_update_own on public.curator_memories;
create policy curator_memories_update_own
on public.curator_memories
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists curator_memories_delete_own on public.curator_memories;
create policy curator_memories_delete_own
on public.curator_memories
for delete
to authenticated
using ((select auth.uid()) = user_id);

grant all on public.curator_memories to authenticated;
