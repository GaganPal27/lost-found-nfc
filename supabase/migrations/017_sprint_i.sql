-- Sprint I: Claim / Contact Flow
-- Add lost_post_id to conversations so we can create a direct chat from a lost-item post

ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS lost_post_id UUID REFERENCES lost_item_posts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_conversations_lost_post ON conversations(lost_post_id);

-- Allow finder (finder_user_id) to update conversation too
-- (needed if we later add "finder marks as sent back" action)
DROP POLICY IF EXISTS "conv_finder_update" ON conversations;
CREATE POLICY "conv_finder_update" ON conversations FOR UPDATE
  USING (finder_user_id = auth.uid());
