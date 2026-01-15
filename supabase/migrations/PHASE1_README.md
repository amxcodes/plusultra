# Phase 1: Wrapped Fields Migration

## What This Migration Does

1. **Updates `update_watch_history()` function** to track:
   - `max_streak` - Highest consecutive days streak this year
   - `monthly_watches` - Count of watches per month (e.g., `{"2026-01": 15, "2026-02": 22}`)
   - `first_watch_of_year` - First content watched in current year
   - `year` - Current year tracker (resets annually)

2. **Disables pruning cron jobs**:
   - `periodic-history-prune` (60-day cleanup)
   - `cleanup-inactive-watch-history` (2-week inactive cleanup)
   
   **Why?** At 100 users, storage is only 34 MB (6.8% of 500 MB free tier). Keeping all data enables complete Year End Wrapped without snapshots.

## How to Run

### Step 1: Run Migration in Supabase

1. Open Supabase SQL Editor
2. Copy contents of `phase1_add_wrapped_fields.sql`
3. Execute the migration
4. Check for errors (should complete in < 5 seconds)

### Step 2: Verify Migration

Run this query to check new fields exist:

```sql
SELECT 
  id,
  username,
  stats->>'max_streak' as max_streak,
  stats->'monthly_watches' as monthly_watches,
  stats->'first_watch_of_year'->>
'title' as first_watch,
  stats->>'year' as year
FROM profiles
WHERE stats IS NOT NULL
LIMIT 5;
```

**Expected result**: Existing users will have default values:
- `max_streak`: 0 (will update on next watch)
- `monthly_watches`: `{}` (empty, will populate on next watch)
- `first_watch_of_year`: null (will set on next watch)
- `year`: 2026

### Step 3: Test with Real User

1. Watch a movie/show as a test user
2. Query their stats:

```sql
SELECT stats FROM profiles WHERE id = 'YOUR_USER_ID';
```

3. Verify new fields are populated:
   - `max_streak` should equal `streak_days` (for new watches)
   - `monthly_watches` should have current month with count = 1
   - `first_watch_of_year` should show the title you just watched

## Impact

### Storage
- **Before**: 5.9 MB (with pruning)
- **After**: ~34 MB (no pruning, all data preserved)
- **Free Tier**: 500 MB
- **Usage**: 6.8% ✅

### Bandwidth
- **No change**: Same queries, same data transfer

### New Users
- Automatically get wrapped fields initialized on first watch

### Existing Users
- Backward compatible - missing fields auto-initialize on next watch
- Historical data preserved (no backfill needed)

## Rollback Plan

If you need to revert:

```sql
-- Re-enable pruning
SELECT cron.schedule(
  'periodic-history-prune',
  '0 3 1 */2 *',
  'SELECT prune_watch_history();'
);

SELECT cron.schedule(
  'cleanup-inactive-watch-history',
  '0 2 1 * *',
  'select cleanup_inactive_watch_history();'
);

-- Revert to old function (use MASTER_STATS_MIGRATION.sql version)
```

## Next Steps

After successful migration:
1. ✅ Database ready for Wrapped
2. Build Wrapped UI (Phase 1b)
3. Monitor storage growth over time
4. Consider Phase 2 (optimization) only if you hit 500 users

## Troubleshooting

**Error: "function does not exist"**
- The migration replaces the existing function, so this shouldn't happen
- If it does, check that `MASTER_STATS_MIGRATION.sql` was run previously

**Cron jobs not found**
- Check if they exist: `SELECT * FROM cron.job`
- If not found, they were never scheduled (safe to ignore)

**Stats not updating**
- Verify frontend is calling `update_watch_history` RPC
- Check browser console for errors
- Query `profiles` table directly to see if stats exist
