-- Migration 014: Add DELETE policies to community_items and lost_item_posts
-- Allows users to delete their own posts.

-- community_items
DROP POLICY IF EXISTS "community_items_finder_delete" ON community_items;
CREATE POLICY "community_items_finder_delete" ON community_items
  FOR DELETE USING (
    finder_id = (SELECT id FROM users WHERE auth_id = auth.uid())
  );

-- lost_item_posts
DROP POLICY IF EXISTS "lost_item_posts_owner_delete" ON lost_item_posts;
CREATE POLICY "lost_item_posts_owner_delete" ON lost_item_posts
  FOR DELETE USING (
    poster_id = (SELECT id FROM users WHERE auth_id = auth.uid())
  );
