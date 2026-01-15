-- ===============================================
-- VERIFICATION: Check if update_watch_history exists
-- ===============================================
-- Run this query in Supabase SQL Editor to check if the function exists

SELECT 
  routine_name,
  routine_type,
  data_type
FROM information_schema.routines 
WHERE routine_name = 'update_watch_history'
  AND routine_schema = 'public';

-- If this returns NO ROWS, the function doesn't exist
-- If this returns 1 row, the function exists

-- ===============================================
-- ALTERNATIVE CHECK: List all RPC functions
-- ===============================================

SELECT routine_name 
FROM information_schema.routines 
WHERE routine_schema = 'public'
  AND routine_type = 'FUNCTION'
ORDER BY routine_name;

-- Look for 'update_watch_history' in the list
