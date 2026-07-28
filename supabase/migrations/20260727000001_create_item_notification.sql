-- Migration 20260727000001: create_item_notification SECURITY DEFINER function
--
-- ROOT CAUSE: The RLS insert policy for notifications only allows users to
-- create notifications FOR THEMSELVES:
--   WITH CHECK (user_id = (SELECT id FROM users WHERE auth_id = auth.uid()))
-- This means a finder (different auth identity from the owner) — or an anonymous
-- website visitor — cannot INSERT a notification for the item owner. The insert
-- silently succeeds in Postgres (it's filtered, not errored) but the row is never
-- written, so the owner's Inbox tab stays permanently empty after a scan.
--
-- FIX: SECURITY DEFINER function that bypasses RLS and correctly resolves
-- to the profile UUID (users.id) regardless of whether the caller passes the
-- profile UUID or the auth UUID. Both scan.tsx (which passes auth_id via route
-- param) and item/[nfc_uid].tsx (which passes user_id = profile UUID) can call
-- this safely.

CREATE OR REPLACE FUNCTION public.create_item_notification(
  p_owner_id UUID,        -- accepts either profile UUID (users.id) or auth UUID
  p_type     TEXT,
  p_message  TEXT,
  p_metadata JSONB DEFAULT '{}'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  notif_id   UUID;
  profile_id UUID;
BEGIN
  -- 1. Try exact profile UUID match (users.id FK)
  SELECT id INTO profile_id FROM public.users WHERE id = p_owner_id LIMIT 1;

  -- 2. Fallback: if passed an auth UUID, resolve to profile UUID via auth_id column
  IF profile_id IS NULL THEN
    SELECT id INTO profile_id FROM public.users WHERE auth_id = p_owner_id LIMIT 1;
  END IF;

  IF profile_id IS NULL THEN
    RAISE EXCEPTION 'create_item_notification: no user found for owner_id %', p_owner_id;
  END IF;

  INSERT INTO notifications (user_id, type, message, metadata)
  VALUES (profile_id, p_type::notif_type, p_message, p_metadata)
  RETURNING id INTO notif_id;

  RETURN notif_id;
END;
$$;

-- Grant to both anonymous (website/in-app public pages) and authenticated users
GRANT EXECUTE ON FUNCTION public.create_item_notification(UUID, TEXT, TEXT, JSONB) TO anon, authenticated;
