# Backfill Migration Guide

## 🎯 **Purpose**

This script calculates stats from your **existing** watch history so users don't start at 0.

---

## 📝 **What Gets Backfilled**

✅ **Will Backfill:**
- Total movies watched
- Total TV shows watched
- Total minutes watched
- Last watched timestamp

❌ **Cannot Backfill:**
- Genre counts (watch_history doesn't store genres)
- Watch streak (needs consecutive dates, not possible from current data)

> **Note:** Genres and streaks will start accumulating from NEW watches going forward.

---

## 🚀 **How to Run**

### **Step 1: Run Main Migration First**
```bash
# In Supabase SQL Editor, run:
supabase/migrations/stats_system.sql
```

### **Step 2: Run Backfill (ONE TIME)**
```bash
# Then run:
supabase/migrations/stats_backfill.sql
```

### **Step 3: Verify**
Check the "Logs" tab in Supabase SQL Editor. You should see:
```
NOTICE: Backfilled stats for user abc123: 42 movies, 18 shows, 5280 mins
NOTICE: Backfill complete!
```

---

## ⚙️ **How It Works**

1. Loops through all users with `watch_history`
2. For each user:
   - Counts movies (`type: 'movie'`)
   - Counts TV shows (`type: 'tv'`)
   - Sums total watch time (converts seconds → minutes)
   - Finds most recent `lastUpdated` timestamp
3. Writes calculated stats to `profiles.stats`
4. Self-destructs (drops the function after running)

---

## 📊 **Example Before/After**

### **Before Backfill:**
```json
{
  "total_movies": 0,
  "total_shows": 0,
  "total_minutes": 0
}
```

### **After Backfill:**
```json
{
  "total_movies": 42,
  "total_shows": 18,
  "total_minutes": 5280,
  "last_watched": "2026-01-14T10:30:00Z"
}
```

---

## 🛡️ **Safety**

- ✅ **Non-destructive** - Only UPDATES `stats`, never touches `watch_history`
- ✅ **Idempotent** - Safe to run multiple times (will recalculate)
- ✅ **Self-cleaning** - Drops the function after execution
- ✅ **Logged** - Shows progress in Supabase logs

---

## 🐛 **Troubleshooting**

### **Error: "column stats does not exist"**
- Run `stats_system.sql` first!

### **No output in logs**
- No users have watch history (expected for fresh installs)

### **Stats still showing 0**
- Check console logs for errors
- Verify backfill ran successfully (check Logs tab)
- Try manually querying: `SELECT id, stats FROM profiles LIMIT 5;`

---

## 🔄 **Re-running the Backfill**

If you need to recalculate stats:

```sql
-- Re-create the function (copy from stats_backfill.sql, lines 10-85)
-- Then run:
SELECT backfill_user_stats();
```
