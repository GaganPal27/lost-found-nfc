-- Migration 015: Allow users to delete conversations they are part of.
-- Without this, the RLS on conversations blocks DELETE and Clear All silently fails.

DROP POLICY IF EXISTS "conv_participant_delete" ON conversations;
CREATE POLICY "conv_participant_delete" ON conversations
  FOR DELETE USING (
    owner_id = auth.uid() OR finder_user_id = auth.uid()
  );
