-- ============================================================
-- Migration 010: Push Notification Token Support
-- ============================================================
-- Purpose:
--   Adds expo_push_token and related columns to public.users
--   so the app can store Expo push tokens and the edge function
--   (notify-lost-item-radius, and future notification functions)
--   can send push notifications to users within a radius.
--
-- Changes:
--   1. expo_push_token           TEXT    - The Expo push token for this device
--   2. push_notifications_enabled BOOLEAN - User opt-in/opt-out flag (defaults true)
--   3. push_token_updated_at     TIMESTAMPTZ - When the token was last refreshed
--                                             (used to skip stale/expired tokens)
--   4. Index on expo_push_token  - For fast IS NOT NULL filtering in edge functions
--   5. RLS UPDATE policy         - Allows users to write their own push token
-- ============================================================

-- 1. Add columns to users table
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS expo_push_token           TEXT,
  ADD COLUMN IF NOT EXISTS push_notifications_enabled BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS push_token_updated_at      TIMESTAMPTZ;

-- 2. Index for fast filtering of users who have a valid push token
--    (edge function runs: WHERE expo_push_token IS NOT NULL AND push_notifications_enabled = true)
CREATE INDEX IF NOT EXISTS idx_users_push_token
  ON public.users (expo_push_token)
  WHERE expo_push_token IS NOT NULL;

-- 3. RLS: Allow authenticated users to update their OWN push token fields only.
--    The existing "own_user" policy (SELECT) uses auth_id = auth.uid().
--    We need a separate UPDATE policy for the push token columns.
DROP POLICY IF EXISTS "users_update_own_push_token" ON public.users;
CREATE POLICY "users_update_own_push_token" ON public.users
  FOR UPDATE
  USING (auth.uid() = id)       -- the user can only update their own row
  WITH CHECK (auth.uid() = id); -- and cannot change it to someone else's row

-- ============================================================
-- Notes for the Edge Function (notify-lost-item-radius):
--
-- To find all users within a radius who have push notifications enabled:
--
--   SELECT id, expo_push_token
--   FROM public.users
--   WHERE expo_push_token IS NOT NULL
--     AND push_notifications_enabled = true
--     AND push_token_updated_at > now() - interval '60 days'  -- skip stale tokens
--     AND (
--       6371 * acos(
--         cos(radians(TARGET_LAT)) * cos(radians(last_lat)) *
--         cos(radians(last_lng) - radians(TARGET_LNG)) +
--         sin(radians(TARGET_LAT)) * sin(radians(last_lat))
--       )
--     ) <= RADIUS_KM;
--
-- Then POST each token to: https://exp.host/--/api/v2/push/send
-- ============================================================
