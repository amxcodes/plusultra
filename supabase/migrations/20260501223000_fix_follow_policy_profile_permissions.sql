CREATE OR REPLACE FUNCTION public.can_join_social_graph(
  p_user_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles profile
    WHERE profile.id = p_user_id
      AND profile.account_kind = 'standard'
      AND COALESCE(profile.is_guest_hidden, false) = false
  );
$$;

DROP POLICY IF EXISTS "Users can follow others" ON public.follows;
CREATE POLICY "Users can follow others"
ON public.follows FOR INSERT
WITH CHECK (
  follower_id = (SELECT auth.uid())
  AND follower_id <> following_id
  AND public.can_join_social_graph(follower_id)
  AND public.can_join_social_graph(following_id)
);

REVOKE ALL ON FUNCTION public.can_join_social_graph(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_join_social_graph(uuid) TO authenticated, service_role;
