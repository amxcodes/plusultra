-- Allow Admins to Delete Requests and Replies

-- Policy: Admins can DELETE from movie_requests
CREATE POLICY "Admins can delete requests" ON public.movie_requests
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    );

-- Policy: Admins can DELETE from request_replies (if cascade doesn't handle it, but CASCADE usually does)
-- But explicit delete might be needed if we delete replies individually later.
CREATE POLICY "Admins can delete replies" ON public.request_replies
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    );
