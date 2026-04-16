-- =========================================================
-- PATCH: 003_idempotent_fix.sql
-- Lost & Found NFC — Safe catch-up patch for current DB state
-- Run this in Supabase SQL Editor → this is fully idempotent
-- It applies everything in 002 that may have failed or been skipped
-- =========================================================

-- ---- PART 1: Fix items FK to auth.users ----
ALTER TABLE items DROP CONSTRAINT IF EXISTS items_user_id_fkey;
ALTER TABLE items
  ADD CONSTRAINT items_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

DROP POLICY IF EXISTS "items_owner_write" ON items;
CREATE POLICY "items_owner_write" ON items FOR ALL
  USING (user_id = auth.uid());

-- ---- PART 2: Fix notifications FK + policies ----
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_user_id_fkey;
ALTER TABLE notifications
  ADD CONSTRAINT notifications_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

DROP POLICY IF EXISTS "notif_own" ON notifications;
CREATE POLICY "notif_own" ON notifications
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "notif_public_insert" ON notifications;
CREATE POLICY "notif_public_insert" ON notifications FOR INSERT WITH CHECK (true);

-- ---- PART 3: Auto-create users row on signup ----
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

-- Unique constraint on auth_id (safe guard)
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

-- ---- PART 4: User RLS policies ----
DROP POLICY IF EXISTS "own_user" ON users;
DROP POLICY IF EXISTS "own_user_read" ON users;
DROP POLICY IF EXISTS "own_user_update" ON users;
CREATE POLICY "own_user_read" ON users FOR SELECT USING (auth.uid() = auth_id);
CREATE POLICY "own_user_update" ON users FOR UPDATE USING (auth.uid() = auth_id);

-- ---- PART 5: Storage bucket + policies (the ones that failed) ----
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

-- ---- VERIFICATION QUERIES (run after to confirm everything is applied) ----
-- Uncomment and run separately if you want to verify:

-- SELECT conname FROM pg_constraint WHERE conrelid = 'public.users'::regclass AND conname = 'users_auth_id_unique';
-- SELECT tgname FROM pg_trigger WHERE tgname = 'on_auth_user_created';
-- SELECT id, name, public FROM storage.buckets WHERE id = 'item-images';
-- SELECT policyname, tablename FROM pg_policies WHERE tablename = 'objects' AND policyname LIKE 'item_images%';
-- SELECT policyname FROM pg_policies WHERE tablename = 'notifications';
-- SELECT policyname FROM pg_policies WHERE tablename = 'items';
