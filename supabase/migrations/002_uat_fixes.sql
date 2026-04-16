-- Migration: Fix auth_id mismatch + add storage bucket + missing columns
-- IDEMPOTENT VERSION: Safe to run multiple times — all statements are guarded
-- Run this in your Supabase SQL editor to fix critical issues found during UAT

-- =========================================================
-- FIX 1: items table needs to reference auth.users directly
-- because the app inserts with user?.id (which is auth_id)
-- =========================================================
ALTER TABLE items DROP CONSTRAINT IF EXISTS items_user_id_fkey;
ALTER TABLE items
  ADD CONSTRAINT items_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Update the RLS policy to use auth.uid() directly (no join needed)
DROP POLICY IF EXISTS "items_owner_write" ON items;
CREATE POLICY "items_owner_write" ON items FOR ALL
  USING (user_id = auth.uid());

-- =========================================================
-- FIX 2: notifications.user_id also needs to match auth.uid
-- The finder inserts notification with item.user_id (from items table)
-- So notifications.user_id must also be auth.uid
-- =========================================================
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_user_id_fkey;
ALTER TABLE notifications
  ADD CONSTRAINT notifications_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

DROP POLICY IF EXISTS "notif_own" ON notifications;
CREATE POLICY "notif_own" ON notifications
  USING (user_id = auth.uid());

-- Allow public (anonymous finders) to INSERT notifications
DROP POLICY IF EXISTS "notif_public_insert" ON notifications;
CREATE POLICY "notif_public_insert" ON notifications FOR INSERT WITH CHECK (true);

-- =========================================================
-- FIX 3: users table needs auto-create on auth sign-up
-- =========================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.users (auth_id, full_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.email
  )
  ON CONFLICT (auth_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Add unique constraint on auth_id for the ON CONFLICT clause
-- (guarded: only add if it doesn't exist)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'users_auth_id_unique'
    AND conrelid = 'public.users'::regclass
  ) THEN
    ALTER TABLE users ADD CONSTRAINT users_auth_id_unique UNIQUE (auth_id);
  END IF;
END $$;

-- =========================================================
-- FIX 4: Grant users RLS update for their own row
-- =========================================================
DROP POLICY IF EXISTS "own_user" ON users;
DROP POLICY IF EXISTS "own_user_read" ON users;
DROP POLICY IF EXISTS "own_user_update" ON users;
CREATE POLICY "own_user_read" ON users FOR SELECT USING (auth.uid() = auth_id);
CREATE POLICY "own_user_update" ON users FOR UPDATE USING (auth.uid() = auth_id);

-- =========================================================
-- FIX 5: Storage bucket for item images (expo-image-picker)
-- =========================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('item-images', 'item-images', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "item_images_public_read" ON storage.objects;
CREATE POLICY "item_images_public_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'item-images');

DROP POLICY IF EXISTS "item_images_auth_upload" ON storage.objects;
CREATE POLICY "item_images_auth_upload" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'item-images'
    AND auth.uid() IS NOT NULL
  );

DROP POLICY IF EXISTS "item_images_owner_delete" ON storage.objects;
CREATE POLICY "item_images_owner_delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'item-images'
    AND auth.uid() IS NOT NULL
  );
