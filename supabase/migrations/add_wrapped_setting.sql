-- ===============================================
-- WRAPPED FEATURE TOGGLE
-- ===============================================

-- 1. Create app_settings table if it doesn't exist (safety check)
CREATE TABLE IF NOT EXISTS public.app_settings (
  key TEXT PRIMARY KEY,
  value TEXT
);

-- 2. Insert default 'wrapped_enabled' setting (default: false)
INSERT INTO public.app_settings (key, value)
VALUES ('wrapped_enabled', 'false')
ON CONFLICT (key) DO NOTHING;

-- 3. Enable RLS
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- 4. Policies (Public Read, Admin Write)
-- Allow everyone to read settings
CREATE POLICY "Allow public read access" ON public.app_settings
  FOR SELECT USING (true);

-- Allow only authenticated admins to update (assuming admin role check logic exists,
-- otherwise restricted to service_role or specific logic. For now, we'll keep it open for auth/service_role
-- or rely on existing policies if table existed. If new, we add basic policy).

-- NOTE: If you have an 'admins' table or role check, use that.
-- For this migration, we ensure public read is available so frontend can check the flag.
