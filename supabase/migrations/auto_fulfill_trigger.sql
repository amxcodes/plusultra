-- Trigger to automatically mark a request as 'fulfilled' when a reply is added

CREATE OR REPLACE FUNCTION public.auto_fulfill_request()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.movie_requests
    SET status = 'fulfilled', updated_at = NOW()
    WHERE id = NEW.request_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_reply_added
AFTER INSERT ON public.request_replies
FOR EACH ROW
EXECUTE FUNCTION public.auto_fulfill_request();
