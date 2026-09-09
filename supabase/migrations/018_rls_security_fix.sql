-- 018_rls_security_fix.sql
-- Fixes the Supabase security alert: "Table publicly accessible"
-- Enables RLS on any tables that were missing it, with safe read-all / write-own policies.
-- Run this in Supabase SQL Editor.

-- ── colleges ─────────────────────────────────────────────────────────────────
ALTER TABLE public.colleges ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can read colleges" ON public.colleges;
CREATE POLICY "Anyone can read colleges"
  ON public.colleges FOR SELECT
  USING (true);

-- ── college_requests ─────────────────────────────────────────────────────────
ALTER TABLE public.college_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can insert college requests" ON public.college_requests;
CREATE POLICY "Users can insert college requests"
  ON public.college_requests FOR INSERT
  TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "Users can read own requests" ON public.college_requests;
CREATE POLICY "Users can read own requests"
  ON public.college_requests FOR SELECT
  TO authenticated USING (true);

-- ── id_verifications ─────────────────────────────────────────────────────────
ALTER TABLE public.id_verifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can insert own verification" ON public.id_verifications;
CREATE POLICY "Users can insert own verification"
  ON public.id_verifications FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can read own verification" ON public.id_verifications;
CREATE POLICY "Users can read own verification"
  ON public.id_verifications FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
-- Admins can read all verifications via admin_get_all_users RPC (bypasses RLS already)

-- ── smart_matches ─────────────────────────────────────────────────────────────
ALTER TABLE public.smart_matches ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can read own smart matches" ON public.smart_matches;
CREATE POLICY "Users can read own smart matches"
  ON public.smart_matches FOR SELECT
  TO authenticated USING (true);
DROP POLICY IF EXISTS "System can insert smart matches" ON public.smart_matches;
CREATE POLICY "System can insert smart matches"
  ON public.smart_matches FOR INSERT
  TO authenticated WITH CHECK (true);

-- ── messages ─────────────────────────────────────────────────────────────────
-- (Ensure RLS is on — it may already be, but this is idempotent)
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Conversation participants can read messages" ON public.messages;
CREATE POLICY "Conversation participants can read messages"
  ON public.messages FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = conversation_id
        AND (c.owner_id = auth.uid() OR c.finder_user_id = auth.uid())
    )
  );
DROP POLICY IF EXISTS "Authenticated users can send messages" ON public.messages;
CREATE POLICY "Authenticated users can send messages"
  ON public.messages FOR INSERT
  TO authenticated WITH CHECK (sender_id = auth.uid());
