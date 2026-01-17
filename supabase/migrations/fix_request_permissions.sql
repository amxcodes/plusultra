-- 1. Ensure the Auto-Fulfill Trigger exists and is correct
CREATE OR REPLACE FUNCTION public.auto_fulfill_request()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.movie_requests
    SET status = 'fulfilled', updated_at = NOW()
    WHERE id = NEW.request_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_reply_added ON public.request_replies;
CREATE TRIGGER on_reply_added
AFTER INSERT ON public.request_replies
FOR EACH ROW
EXECUTE FUNCTION public.auto_fulfill_request();

-- 2. Grant Admins permission to UPDATE requests (to manually fix status)
CREATE POLICY "Admins can update requests" ON public.movie_requests
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    );

-- 3. Grant Admins permission to DELETE requests (Ensuring this exists)
-- (Drop first to avoid duplication error if policy name matches)
DROP POLICY IF EXISTS "Admins can delete requests" ON public.movie_requests;
CREATE POLICY "Admins can delete requests" ON public.movie_requests
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    );
