-- Fix RLS for lost_item_posts
CREATE POLICY "Enable insert for authenticated users only" ON "public"."lost_item_posts"
AS PERMISSIVE FOR INSERT
TO authenticated
WITH CHECK (true);

-- Fix RLS for community_groups
CREATE POLICY "Enable insert for authenticated users only" ON "public"."community_groups"
AS PERMISSIVE FOR INSERT
TO authenticated
WITH CHECK (true);

-- Fix RLS for group_members
CREATE POLICY "Enable insert for authenticated users only" ON "public"."group_members"
AS PERMISSIVE FOR INSERT
TO authenticated
WITH CHECK (true);

-- Fix RLS for group_messages
CREATE POLICY "Enable insert for authenticated users only" ON "public"."group_messages"
AS PERMISSIVE FOR INSERT
TO authenticated
WITH CHECK (true);

-- Ensure select is available for all
CREATE POLICY "Enable read access for all users" ON "public"."lost_item_posts"
AS PERMISSIVE FOR SELECT
TO public
USING (true);

CREATE POLICY "Enable read access for all users" ON "public"."community_groups"
AS PERMISSIVE FOR SELECT
TO public
USING (true);

CREATE POLICY "Enable read access for all users" ON "public"."group_members"
AS PERMISSIVE FOR SELECT
TO public
USING (true);

CREATE POLICY "Enable read access for all users" ON "public"."group_messages"
AS PERMISSIVE FOR SELECT
TO public
USING (true);
