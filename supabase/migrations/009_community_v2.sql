-- Phase 1: Community v2 tables

-- Add location fields to users table if they don't exist
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_lat DOUBLE PRECISION;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_lng DOUBLE PRECISION;
ALTER TABLE users ADD COLUMN IF NOT EXISTS location_updated_at TIMESTAMPTZ;

-- Enum for lost post status
DO $$ BEGIN
  CREATE TYPE lost_post_status AS ENUM ('searching', 'found', 'closed');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Lost Item Posts (with radius)
CREATE TABLE IF NOT EXISTS lost_item_posts (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  poster_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title               TEXT NOT NULL,
  description         TEXT,
  category            TEXT NOT NULL DEFAULT 'Other',
  image_url           TEXT,
  last_seen_lat       DOUBLE PRECISION NOT NULL,
  last_seen_lng       DOUBLE PRECISION NOT NULL,
  radius_km           INT NOT NULL DEFAULT 5,
  status              lost_post_status NOT NULL DEFAULT 'searching',
  created_at          TIMESTAMPTZ DEFAULT now()
);

-- Community Groups (WhatsApp style)
CREATE TABLE IF NOT EXISTS community_groups (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                TEXT NOT NULL,
  description         TEXT,
  image_url           TEXT,
  creator_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type                TEXT NOT NULL DEFAULT 'public', -- 'public' or 'private'
  member_count        INT NOT NULL DEFAULT 1,
  created_at          TIMESTAMPTZ DEFAULT now()
);

-- Group Members (and join requests)
CREATE TABLE IF NOT EXISTS group_members (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id            UUID NOT NULL REFERENCES community_groups(id) ON DELETE CASCADE,
  user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role                TEXT NOT NULL DEFAULT 'member', -- 'admin' or 'member'
  status              TEXT NOT NULL DEFAULT 'active', -- 'active', 'pending', 'banned'
  joined_at           TIMESTAMPTZ DEFAULT now(),
  UNIQUE(group_id, user_id)
);

-- Group Messages
CREATE TABLE IF NOT EXISTS group_messages (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id            UUID NOT NULL REFERENCES community_groups(id) ON DELETE CASCADE,
  sender_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body                TEXT,
  image_url           TEXT,
  created_at          TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE lost_item_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies: lost_item_posts
DROP POLICY IF EXISTS "lost_item_posts_public_read" ON lost_item_posts;
CREATE POLICY "lost_item_posts_public_read" ON lost_item_posts
  FOR SELECT USING (status != 'closed');

DROP POLICY IF EXISTS "lost_item_posts_owner_insert" ON lost_item_posts;
CREATE POLICY "lost_item_posts_owner_insert" ON lost_item_posts
  FOR INSERT WITH CHECK (
    poster_id = (SELECT id FROM users WHERE auth_id = auth.uid())
  );

DROP POLICY IF EXISTS "lost_item_posts_owner_update" ON lost_item_posts;
CREATE POLICY "lost_item_posts_owner_update" ON lost_item_posts
  FOR UPDATE USING (
    poster_id = (SELECT id FROM users WHERE auth_id = auth.uid())
  );

-- RLS Policies: community_groups
DROP POLICY IF EXISTS "community_groups_public_read" ON community_groups;
CREATE POLICY "community_groups_public_read" ON community_groups
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "community_groups_auth_insert" ON community_groups;
CREATE POLICY "community_groups_auth_insert" ON community_groups
  FOR INSERT WITH CHECK (
    creator_id = (SELECT id FROM users WHERE auth_id = auth.uid())
  );

DROP POLICY IF EXISTS "community_groups_admin_update" ON community_groups;
CREATE POLICY "community_groups_admin_update" ON community_groups
  FOR UPDATE USING (
    id IN (
      SELECT group_id FROM group_members 
      WHERE user_id = (SELECT id FROM users WHERE auth_id = auth.uid())
      AND role = 'admin'
    )
  );

-- RLS Policies: group_members
DROP POLICY IF EXISTS "group_members_read" ON group_members;
CREATE POLICY "group_members_read" ON group_members
  FOR SELECT USING (true); -- anyone can see who is in a group for now (to count members, etc.)

DROP POLICY IF EXISTS "group_members_insert" ON group_members;
CREATE POLICY "group_members_insert" ON group_members
  FOR INSERT WITH CHECK (
    user_id = (SELECT id FROM users WHERE auth_id = auth.uid()) 
    OR 
    group_id IN (
      SELECT id FROM community_groups WHERE creator_id = (SELECT id FROM users WHERE auth_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "group_members_admin_update" ON group_members;
CREATE POLICY "group_members_admin_update" ON group_members
  FOR UPDATE USING (
    group_id IN (
      SELECT group_id FROM group_members 
      WHERE user_id = (SELECT id FROM users WHERE auth_id = auth.uid())
      AND role = 'admin'
    )
  );

-- RLS Policies: group_messages
DROP POLICY IF EXISTS "group_messages_read" ON group_messages;
CREATE POLICY "group_messages_read" ON group_messages
  FOR SELECT USING (
    group_id IN (
      SELECT group_id FROM group_members 
      WHERE user_id = (SELECT id FROM users WHERE auth_id = auth.uid())
      AND status = 'active'
    )
  );

DROP POLICY IF EXISTS "group_messages_insert" ON group_messages;
CREATE POLICY "group_messages_insert" ON group_messages
  FOR INSERT WITH CHECK (
    sender_id = (SELECT id FROM users WHERE auth_id = auth.uid())
    AND
    group_id IN (
      SELECT group_id FROM group_members 
      WHERE user_id = (SELECT id FROM users WHERE auth_id = auth.uid())
      AND status = 'active'
    )
  );

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_lost_items_poster ON lost_item_posts(poster_id);
CREATE INDEX IF NOT EXISTS idx_lost_items_status ON lost_item_posts(status);
CREATE INDEX IF NOT EXISTS idx_groups_type ON community_groups(type);
CREATE INDEX IF NOT EXISTS idx_groups_creator ON community_groups(creator_id);
CREATE INDEX IF NOT EXISTS idx_group_members_status ON group_members(status);
CREATE INDEX IF NOT EXISTS idx_group_messages_group_time ON group_messages(group_id, created_at DESC);
