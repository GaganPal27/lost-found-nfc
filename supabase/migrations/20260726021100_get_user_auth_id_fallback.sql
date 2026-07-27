CREATE OR REPLACE FUNCTION public.get_user_auth_id(profile_id UUID)
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT COALESCE(
    -- 1. Normal case: find the user by their public profile ID, return their auth_id
    (SELECT auth_id FROM public.users WHERE id = profile_id AND auth_id IS NOT NULL),
    -- 2. Fallback for data inconsistency: if the passed ID is ALREADY the auth_id 
    -- (e.g. because items.user_id was populated with auth.uid() directly without an enforced FK),
    -- or if they hit the registration upsert bug (id=auth_id but auth_id=NULL),
    -- then just return the passed ID as it's already the auth_id we need.
    profile_id
  );
$$;

GRANT EXECUTE ON FUNCTION public.get_user_auth_id(UUID) TO anon, authenticated;
