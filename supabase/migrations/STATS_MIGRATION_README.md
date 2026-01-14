# Stats System Migration Guide

## 🚨 Before Running the Frontend

**You MUST run this SQL migration first** or the Stats page will fail with 400 errors.

## Steps to Migrate

### 1.  **Open Supabase Studio**
   - Go to your project dashboard: https://supabase.com/dashboard/project/izspvmfunuwdhmhmemhi
   - Click on "SQL Editor" in the left sidebar

### 2. **Run the Migration**
   - Copy the entire contents of `supabase/migrations/stats_system.sql`
   - Paste into the SQL Editor
   - Click "Run" (or press Cmd/Ctrl + Enter)

### 3. **Verify Tables Created**
   - Go to "Table Editor"
   - You should see:
     - `server_votes` (new table)
     - `community_stats` (new table)
     - `profiles` → check that it has a new `stats` column (JSONB type)

### 4. **(Optional) Enable Cron Job**
   If you want automatic cleanup every 2 months:
   
   ```sql
   -- Only run this if pg_cron extension is enabled
   SELECT cron.schedule(
     'periodic-history-prune',
     '0 3 1 */2 *', 
     'SELECT prune_watch_history();'
   );
   ```

## What This Adds

1.  **`profiles.stats`** (JSONB column)
    - Stores permanent aggregated stats (total movies, genres, streak)
    - Survives history cleanup

2.  **`server_votes`** (Table)
    - Tracks which servers work best for each movie/episode
    - Anonymous voting

3.  **`community_stats`** (Table)
    - Global trending data (will be used later)

4.  **RPC Functions**
    - `increment_server_vote()` - Vote for a server
    - `update_watch_history_with_stats()` - Update both history + stats
    - `prune_watch_history()` - Cleanup old data

## Troubleshooting

### Error: "column stats does not exist"
- You didn't run the migration. Go back to Step 1.

### Error: "function increment_server_vote does not exist"
- The RPC functions weren't created. Check for SQL errors in the migration output.

### Error: "permission denied for table server_votes"
- RLS policies weren't applied. Re-run the migration.

## After Migration

- Refresh your app
- Go to the "Stats" tab (chart icon in sidebar)
- You should see "No Stats Yet" (this is expected for new users)
- Start watching content to populate stats!
