# Streak Calculation Logic

## 🔥 How Streaks Work

Streaks track **consecutive days** a user watches content.

---

## 📊 **Calculation Rules**

### **Scenario 1: First-Time Watcher**
```
User has never watched anything
→ Streak = 1
```

### **Scenario 2: Watched Earlier Today**
```
Last watched: Today at 10:00 AM
Current time: Today at 8:00 PM
Days since: 0
→ Streak = Keep current (no change)
```

### **Scenario 3: Consecutive Day (Yesterday)**
```
Last watched: Jan 13, 2026
Current date: Jan 14, 2026
Days since: 1
→ Streak = Previous + 1
```

### **Scenario 4: Missed a Day (Reset)**
```
Last watched: Jan 12, 2026
Current date: Jan 14, 2026
Days since: 2
→ Streak = 1 (reset, today is day 1)
```

---

## 🧮 **Technical Implementation**

### **Function:** `update_watch_history_with_stats()`

```sql
-- Extract previous data
previous_last_watched := (current_stats->>'last_watched')::timestamptz;
current_streak := COALESCE((current_stats->>'streak_days')::int, 0);

-- Calculate days since last watch
days_since_last_watch := EXTRACT(DAY FROM (CURRENT_DATE - DATE(previous_last_watched)));

-- Decision tree
IF previous_last_watched IS NULL THEN
  current_streak := 1;  -- First watch
ELSIF days_since_last_watch = 0 THEN
  current_streak := current_streak;  -- Same day, no change
ELSIF days_since_last_watch = 1 THEN
  current_streak := current_streak + 1;  -- Consecutive day
ELSE
  current_streak := 1;  -- Missed day(s), reset
END IF;
```

---

## 🎯 **Examples**

### **Example 1: Building a Streak**
| Date | Action | Streak |
|------|--------|--------|
| Jan 1 | Watch movie | 1 |
| Jan 2 | Watch show | 2 |
| Jan 3 | Watch movie | 3 |
| Jan 4 | Watch show | 4 |

### **Example 2: Multiple Watches Same Day**
| Date & Time | Action | Streak |
|-------------|--------|--------|
| Jan 1, 10:00 AM | Watch movie | 1 |
| Jan 1, 8:00 PM | Watch show | 1 (no change) |
| Jan 2, 3:00 PM | Watch movie | 2 |

### **Example 3: Breaking a Streak**
| Date | Action | Streak |
|------|--------|--------|
| Jan 1 | Watch movie | 1 |
| Jan 2 | Watch show | 2 |
| Jan 3 | Watch movie | 3 |
| Jan 4 | (No activity) | - |
| Jan 5 | Watch movie | 1 (reset) |

---

## ⚙️ **When Streak Updates**

Streak calculation happens **every time** `update_watch_history_with_stats()` is called.

Currently, this function is called by:
- ❌ **Not hooked up yet** - Need to integrate with `useWatchHistory` hook

### **TODO: Integration**
You need to call this RPC when:
- User completes watching (progress > 80%)
- Or when user closes the player after significant watch time

---

## 🔄 **Update Migration File**

To apply the new streak logic:

1. **Re-run** `stats_system.sql` in Supabase (it will update the function)
2. Existing users' streaks will recalculate on their next watch

---

## 🎨 **UI Display**

The `StatsDashboard` already shows the streak with a flame icon 🔥:

```tsx
<StatCard
  icon={Flame}
  label="Day Streak"
  value={stats.streak_days}  // Will be 0 initially
  color="text-orange-400"
  bg="bg-orange-500/10"
/>
```

---

## 🧪 **Testing**

### **Manual Test:**
1. Watch a movie today → Streak = 1
2. Watch another movie today → Streak = 1 (no change)
3. Tomorrow, watch something → Streak = 2
4. Skip a day → Streak resets to 1

### **SQL Test:**
```sql
-- Check your current streak
SELECT id, stats->>'streak_days' as streak, stats->>'last_watched' as last_watched
FROM profiles
WHERE id = 'YOUR_USER_ID';
```

---

## ⚠️ **Known Limitations**

1. **Timezone-dependent** - Uses `CURRENT_DATE` which is server timezone
2. **No decay** - Streak doesn't automatically reset if user hasn't watched in days (only resets on next watch)
3. **No notification** - User won't know if they're about to lose their streak

### **Future Enhancements:**
- [ ] Add timezone support (user's local date)
- [ ] Background job to reset streaks for inactive users
- [ ] "Don't break the streak" reminder notifications
