-- Migration 015: Fix push-token RLS policy (auth_id, not profile id)
--
-- 010_push_tokens.sql shipped with:
--   USING (auth.uid() = id)
-- but `id` is public.users.id (the profile row), not the Supabase auth UID.
-- auth.uid() can never equal that, so this policy silently blocked every
-- push-token save via RLS — the app's .update({ expo_push_token... }) call
-- in _layout.tsx would fail (or affect 0 rows) for every single user.
-- This is the first domino in the "push notifications never arrive" chain.

DROP POLICY IF EXISTS "users_update_own_push_token" ON public.users;
CREATE POLICY "users_update_own_push_token" ON public.users
  FOR UPDATE
  USING (auth.uid() = auth_id)
  WITH CHECK (auth.uid() = auth_id);
