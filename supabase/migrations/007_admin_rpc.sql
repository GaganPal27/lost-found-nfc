-- Migration 007: Admin RPC functions that bypass RLS
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/pzhuszyyykususkmzpud/sql/new

-- First apply the policies from migration 006 if not already done
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.users 
    WHERE auth_id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Admin RPC: Get ALL users (bypasses RLS via SECURITY DEFINER)
CREATE OR REPLACE FUNCTION admin_get_all_users()
RETURNS SETOF users AS $$
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Access denied';
  END IF;
  RETURN QUERY SELECT * FROM public.users ORDER BY created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Admin RPC: Get ALL items with owner email (bypasses RLS)
CREATE OR REPLACE FUNCTION admin_get_all_items()
RETURNS TABLE (
  id UUID, user_id UUID, item_name TEXT, category TEXT, color TEXT,
  description TEXT, image_url TEXT, nfc_uid TEXT, ble_beacon_id TEXT,
  tag_type tag_type, status item_status, last_seen_lat DOUBLE PRECISION,
  last_seen_lng DOUBLE PRECISION, last_seen_at TIMESTAMPTZ, created_at TIMESTAMPTZ,
  owner_email TEXT, owner_name TEXT
) AS $$
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Access denied';
  END IF;
  RETURN QUERY
    SELECT i.id, i.user_id, i.item_name, i.category, i.color, i.description,
           i.image_url, i.nfc_uid, i.ble_beacon_id, i.tag_type, i.status,
           i.last_seen_lat, i.last_seen_lng, i.last_seen_at, i.created_at,
           u.email, u.full_name
    FROM public.items i
    LEFT JOIN public.users u ON u.id = i.user_id
    WHERE i.status != 'deleted'
    ORDER BY i.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Admin RPC: Update user role
CREATE OR REPLACE FUNCTION admin_set_user_role(target_user_id UUID, new_role TEXT)
RETURNS VOID AS $$
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Access denied';
  END IF;
  UPDATE public.users SET role = new_role::user_role WHERE id = target_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update the own_user policy to also allow SELECT (needed for is_admin check)
DROP POLICY IF EXISTS "own_user" ON public.users;
CREATE POLICY "own_user" ON public.users USING (auth.uid() = auth_id);
