-- No prior migration ever added these tables to the supabase_realtime
-- publication — this is a required opt-in step in Supabase; a table with
-- RLS policies and a .channel().on('postgres_changes', ...) subscription in
-- the client will still never receive any events until it's added here.
-- This likely explains inconsistent "works only after leaving and
-- re-entering the screen" behavior across the app (messages-list.tsx,
-- notifications-list.tsx, community.tsx feed, etc.) — the focus-refetch
-- fixes cover the "already left the screen" case; this covers true live
-- updates while a screen is already open.
--
-- Wrapped in a DO block since ADD TABLE errors if the table is already a
-- member (safe to re-run).

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'conversations'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  END IF;
END $$;
