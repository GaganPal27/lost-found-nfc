-- own_user_read correctly restricts users to reading only their own row
-- (auth.uid() = auth_id). But conversations.owner_id and push_tokens.user_id
-- both need the AUTH id of a *different* user (the item owner / finder),
-- resolved from their profile-table id — which own_user_read blocks for
-- anyone but that user themselves, by design.
--
-- Rather than widening SELECT access to the whole users row (a real privacy
-- regression), expose only the single UUID that's actually needed via a
-- narrow SECURITY DEFINER function, matching the pattern already used by
-- is_admin() / user_is_active_member() elsewhere in this schema.

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
    -- (e.g. because items.user_id was populated with auth.uid() directly),
    -- or if they hit the registration upsert bug (id=auth_id but auth_id=NULL),
    -- then just return the passed ID as it's already the auth_id we need.
    profile_id
  );
$$;

-- Callable by anyone, including anonymous website visitors notifying an
-- item owner — it only ever returns one UUID, nothing else about the user.
GRANT EXECUTE ON FUNCTION public.get_user_auth_id(UUID) TO anon, authenticated;
