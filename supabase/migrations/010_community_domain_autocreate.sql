-- Migration 010: Official (university) communities vs. user-created sub-groups
-- Fixes the schema gap where community_groups had no way to distinguish
-- an auto-created university-level community from a user-made sub-group.

-- 1. New columns on community_groups
ALTER TABLE community_groups ADD COLUMN IF NOT EXISTS domain TEXT;
ALTER TABLE community_groups ADD COLUMN IF NOT EXISTS is_official BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE community_groups ADD COLUMN IF NOT EXISTS parent_group_id UUID REFERENCES community_groups(id) ON DELETE SET NULL;

-- Only one official community per domain. Sub-groups (parent_group_id set,
-- is_official = false) are unaffected since domain will be NULL for them.
CREATE UNIQUE INDEX IF NOT EXISTS community_groups_domain_unique
  ON community_groups(domain) WHERE domain IS NOT NULL;

-- 2. Optional "pretty name" lookup for known institutions.
-- If a domain isn't listed here, the trigger below falls back to
-- title-casing the domain itself (e.g. "xyz.edu.in" -> "Xyz Community").
CREATE TABLE IF NOT EXISTS college_domains (
  domain        TEXT PRIMARY KEY,
  display_name  TEXT NOT NULL
);

-- Seed your known domain. Replace with Bennett's actual student email domain.
INSERT INTO college_domains (domain, display_name)
VALUES ('bennett.edu.in', 'Bennett University')
ON CONFLICT (domain) DO NOTHING;

-- 3. Extend the existing signup trigger to auto-join/auto-create
-- the official community for institutional email domains.
-- Personal email providers (gmail, yahoo, etc.) are skipped —
-- those users land in the app with no community and use the
-- "Join a Community" screen instead.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  v_user_id     UUID;
  v_domain      TEXT;
  v_group_id    UUID;
  v_display     TEXT;
  v_is_personal BOOLEAN;
BEGIN
  INSERT INTO public.users (auth_id, full_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.email
  )
  ON CONFLICT (auth_id) DO NOTHING
  RETURNING id INTO v_user_id;

  -- If the row already existed (rare re-fire), fetch its id instead.
  IF v_user_id IS NULL THEN
    SELECT id INTO v_user_id FROM public.users WHERE auth_id = NEW.id;
  END IF;

  v_domain := lower(split_part(NEW.email, '@', 2));

  v_is_personal := v_domain = ANY (ARRAY[
    'gmail.com','yahoo.com','yahoo.co.in','outlook.com','hotmail.com',
    'icloud.com','protonmail.com','live.com','rediffmail.com','aol.com'
  ]);

  IF v_domain IS NOT NULL AND v_domain <> '' AND NOT v_is_personal THEN
    SELECT id INTO v_group_id
    FROM community_groups
    WHERE domain = v_domain AND is_official = true
    LIMIT 1;

    IF v_group_id IS NULL THEN
      SELECT display_name INTO v_display FROM college_domains WHERE domain = v_domain;
      IF v_display IS NULL THEN
        v_display := initcap(split_part(v_domain, '.', 1)) || ' Community';
      END IF;

      INSERT INTO community_groups (name, description, creator_id, type, domain, is_official, member_count)
      VALUES (v_display, 'Official community for ' || v_domain, v_user_id, 'public', v_domain, true, 0)
      ON CONFLICT (domain) DO NOTHING
      RETURNING id INTO v_group_id;

      -- Race: another signup from the same domain created it first.
      IF v_group_id IS NULL THEN
        SELECT id INTO v_group_id
        FROM community_groups
        WHERE domain = v_domain AND is_official = true
        LIMIT 1;
      END IF;
    END IF;

    INSERT INTO group_members (group_id, user_id, role, status)
    VALUES (v_group_id, v_user_id, 'member', 'active')
    ON CONFLICT (group_id, user_id) DO NOTHING;

    UPDATE community_groups SET member_count = member_count + 1 WHERE id = v_group_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. RLS: everyone can browse official communities to find/join theirs.
DROP POLICY IF EXISTS "official_groups_public_read" ON community_groups;
CREATE POLICY "official_groups_public_read" ON community_groups
  FOR SELECT USING (is_official = true OR type = 'public');

-- 5. Missing RPC used by group-requests and join-community screens —
-- never existed in any prior migration, calls were silently failing.
CREATE OR REPLACE FUNCTION public.increment_group_members(g_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE community_groups SET member_count = member_count + 1 WHERE id = g_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Close the cross-college leak.
-- The original policies from 009_community_v2.sql were:
--   community_groups SELECT: USING (true)                    -- every group, every college, world-readable
--   group_members INSERT:    user_id = self OR creator_id = self  -- self-join always passes, no group scoping at all
-- That meant any signed-in user could read AND join any sub-group from any college.
-- These replacements scope sub-groups to members of their parent official community,
-- while keeping official communities themselves publicly browsable (needed for
-- join-community.tsx search-and-join).

DROP POLICY IF EXISTS "community_groups_public_read" ON community_groups;
DROP POLICY IF EXISTS "official_groups_public_read" ON community_groups;
DROP POLICY IF EXISTS "community_groups_scoped_read" ON community_groups;
CREATE POLICY "community_groups_scoped_read" ON community_groups
  FOR SELECT USING (
    is_official = true
    OR id IN (
      SELECT group_id FROM group_members
      WHERE user_id = (SELECT id FROM users WHERE auth_id = auth.uid())
      AND status = 'active'
    )
    OR parent_group_id IN (
      SELECT group_id FROM group_members
      WHERE user_id = (SELECT id FROM users WHERE auth_id = auth.uid())
      AND status = 'active'
    )
  );

DROP POLICY IF EXISTS "group_members_insert" ON group_members;
DROP POLICY IF EXISTS "group_members_scoped_insert" ON group_members;
CREATE POLICY "group_members_scoped_insert" ON group_members
  FOR INSERT WITH CHECK (
    user_id = (SELECT id FROM users WHERE auth_id = auth.uid())
    AND (
      -- Official communities: anyone may self-join (this is how domain
      -- auto-join and the manual "search communities" screen both work).
      group_id IN (SELECT id FROM community_groups WHERE is_official = true)
      -- Sub-groups: only if it belongs to the college you're already in.
      OR group_id IN (
        SELECT cg.id FROM community_groups cg
        WHERE cg.parent_group_id IN (
          SELECT group_id FROM group_members
          WHERE user_id = (SELECT id FROM users WHERE auth_id = auth.uid())
          AND status = 'active'
        )
      )
      -- Creator inserting their own admin row right after creating a group.
      OR group_id IN (
        SELECT id FROM community_groups
        WHERE creator_id = (SELECT id FROM users WHERE auth_id = auth.uid())
      )
    )
  );
