# Supabase Baselines

`2026-03-21_remote_public_types.ts` is the current linked-project schema snapshot for the `public` schema of project `izspvmfunuwdhmhmemhi`.

Why this exists:
- the remote project was built through a lot of direct SQL and manual migrations
- the remote database does not have a clean historical migration ledger to trust as a baseline
- a full `supabase db dump` is blocked on this machine because the Windows CLI path requires Docker Desktop

How to use it:
- treat this file as the current remote schema reference for future DB cleanup work
- apply new DB changes through tracked SQL migrations in `supabase/migrations`
- when Docker or `pg_dump` is available, replace or supplement this with a full SQL schema dump from the linked project
