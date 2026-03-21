-- HARDEN NOTIFICATIONS INSERT RLS
-- Notifications are created by SECURITY DEFINER triggers/functions, not by clients.
-- Block all direct client inserts so users cannot forge notifications.

DROP POLICY IF EXISTS "System can insert notifications" ON public.notifications;
DROP POLICY IF EXISTS "notifications_insert" ON public.notifications;

CREATE POLICY "notifications_insert"
ON public.notifications FOR INSERT
WITH CHECK (false);
