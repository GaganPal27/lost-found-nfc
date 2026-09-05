-- Sprint H + Sprint F schema additions

-- 1. id_verifications table (Sprint H)
CREATE TABLE IF NOT EXISTS id_verifications (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  group_id      UUID NOT NULL REFERENCES community_groups(id) ON DELETE CASCADE,
  id_card_url   TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'pending',
  submitted_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at   TIMESTAMPTZ,
  UNIQUE(user_id, group_id)
);

ALTER TABLE id_verifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "id_verif_owner_read" ON id_verifications;
CREATE POLICY "id_verif_owner_read" ON id_verifications
  FOR SELECT USING (user_id = (SELECT id FROM users WHERE auth_id = auth.uid()));

DROP POLICY IF EXISTS "id_verif_owner_insert" ON id_verifications;
CREATE POLICY "id_verif_owner_insert" ON id_verifications
  FOR INSERT WITH CHECK (user_id = (SELECT id FROM users WHERE auth_id = auth.uid()));

DROP POLICY IF EXISTS "id_verif_owner_update" ON id_verifications;
CREATE POLICY "id_verif_owner_update" ON id_verifications
  FOR UPDATE USING (user_id = (SELECT id FROM users WHERE auth_id = auth.uid()));

DROP POLICY IF EXISTS "id_verif_admin_all" ON id_verifications;
CREATE POLICY "id_verif_admin_all" ON id_verifications
  FOR ALL USING ((SELECT role FROM users WHERE auth_id = auth.uid()) = 'admin');

-- 2. membership_status column on group_members (Sprint H)
ALTER TABLE group_members
  ADD COLUMN IF NOT EXISTS membership_status TEXT;

-- 3. avatar_url column on users (Sprint F)
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- 4. avatars storage bucket (Sprint F)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars', 'avatars', true, 5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/jpg']
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "avatars_upload" ON storage.objects;
CREATE POLICY "avatars_upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "avatars_update" ON storage.objects;
CREATE POLICY "avatars_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "avatars_public_read" ON storage.objects;
CREATE POLICY "avatars_public_read" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'avatars');

-- 5. Allow users to update their own group_members row (id-verification flow writes membership_status)
DROP POLICY IF EXISTS "group_members_self_update" ON group_members;
CREATE POLICY "group_members_self_update" ON group_members
  FOR UPDATE USING (
    user_id = (SELECT id FROM users WHERE auth_id = auth.uid())
  );

-- 6. Admin can manage group_members
DROP POLICY IF EXISTS "group_members_admin_all" ON group_members;
CREATE POLICY "group_members_admin_all" ON group_members
  FOR ALL USING (
    (SELECT role FROM users WHERE auth_id = auth.uid()) = 'admin'
  );
