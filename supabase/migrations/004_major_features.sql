-- ============================================================
-- Migration 004: Major Features — NFC Linking, Finder Connect,
-- Push Notifications, Item Location, Legal Consent
-- Safe to run multiple times (idempotent)
-- ============================================================

-- -------------------------------------------------------
-- 1. Add nfc_link_type to items
--    'programmed'      = we wrote NDEF URL to a blank tag
--    'linked_existing' = we read hardware UID of existing card
-- -------------------------------------------------------
ALTER TABLE items ADD COLUMN IF NOT EXISTS nfc_link_type TEXT NOT NULL DEFAULT 'programmed';
ALTER TABLE items ADD COLUMN IF NOT EXISTS last_seen_location TEXT;

-- Remove the strict CHECK constraint so nfc_uid can be null while
-- user is in the middle of the write/link flow (will be set after scan)
ALTER TABLE items DROP CONSTRAINT IF EXISTS must_have_id;
ALTER TABLE items ADD CONSTRAINT must_have_id
  CHECK (nfc_uid IS NOT NULL OR ble_beacon_id IS NOT NULL OR true);
-- Note: constraint now always passes; we enforce this in app code.

-- -------------------------------------------------------
-- 2. Push token storage for FCM / APNs via Expo
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS push_tokens (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL,
  token      TEXT NOT NULL,
  platform   TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT push_tokens_user_token_unique UNIQUE (user_id, token)
);

ALTER TABLE push_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "push_tokens_own" ON push_tokens;
CREATE POLICY "push_tokens_own" ON push_tokens
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "push_tokens_insert" ON push_tokens;
CREATE POLICY "push_tokens_insert" ON push_tokens
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- -------------------------------------------------------
-- 3. Conversations — created when a finder scans an item
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS conversations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id         UUID REFERENCES items(id) ON DELETE CASCADE,
  owner_id        UUID NOT NULL,            -- auth.uid of item owner
  finder_user_id  UUID,                     -- auth.uid of finder, if logged in
  finder_name     TEXT,                     -- if finder chose to share
  finder_phone    TEXT,                     -- if finder chose to share
  scan_lat        DOUBLE PRECISION,
  scan_lng        DOUBLE PRECISION,
  scan_location   TEXT,                     -- reverse-geocoded label
  resolved        BOOLEAN DEFAULT false,
  created_at      TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;

-- Owner can read all their conversations
DROP POLICY IF EXISTS "conv_owner_read" ON conversations;
CREATE POLICY "conv_owner_read" ON conversations FOR SELECT
  USING (owner_id = auth.uid());

-- Finder (logged-in) can read their own
DROP POLICY IF EXISTS "conv_finder_read" ON conversations;
CREATE POLICY "conv_finder_read" ON conversations FOR SELECT
  USING (finder_user_id = auth.uid());

-- Anyone (even anonymous finders) can create a conversation
DROP POLICY IF EXISTS "conv_public_insert" ON conversations;
CREATE POLICY "conv_public_insert" ON conversations FOR INSERT WITH CHECK (true);

-- Owner can update (mark resolved)
DROP POLICY IF EXISTS "conv_owner_update" ON conversations;
CREATE POLICY "conv_owner_update" ON conversations FOR UPDATE
  USING (owner_id = auth.uid());

-- -------------------------------------------------------
-- 4. Messages within a conversation
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id       UUID,                     -- auth.uid, null if anonymous
  sender_name     TEXT NOT NULL,
  body            TEXT NOT NULL,
  created_at      TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Read: owner or logged-in finder can read messages in their conversations
DROP POLICY IF EXISTS "msg_participant_read" ON messages;
CREATE POLICY "msg_participant_read" ON messages FOR SELECT
  USING (
    conversation_id IN (
      SELECT id FROM conversations
      WHERE owner_id = auth.uid() OR finder_user_id = auth.uid()
    )
  );

-- Anyone can insert a message
DROP POLICY IF EXISTS "msg_public_insert" ON messages;
CREATE POLICY "msg_public_insert" ON messages FOR INSERT WITH CHECK (true);

-- -------------------------------------------------------
-- 5. Legal consent timestamp on users table
-- -------------------------------------------------------
ALTER TABLE users ADD COLUMN IF NOT EXISTS tos_accepted_at TIMESTAMPTZ;

-- -------------------------------------------------------
-- 6. Indexes
-- -------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_push_tokens_user    ON push_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_conversations_owner ON conversations(owner_id);
CREATE INDEX IF NOT EXISTS idx_conversations_item  ON conversations(item_id);
CREATE INDEX IF NOT EXISTS idx_messages_conv       ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_created    ON messages(conversation_id, created_at);
