-- Fix trigger functions to use auth_id (auth.users.id) instead of users.id
-- for notifications inserts, since notifications.user_id references auth.users(id)

CREATE OR REPLACE FUNCTION public.trigger_found_item_match()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  lost_record RECORD;
BEGIN
  FOR lost_record IN
    SELECT lp.id, lp.poster_id, lp.title, u.auth_id
    FROM lost_item_posts lp
    JOIN users u ON u.id = lp.poster_id
    WHERE lp.category = NEW.category
      AND lp.status = 'searching'
      AND lp.created_at > NOW() - INTERVAL '30 days'
  LOOP
    -- Use auth_id (references auth.users) not poster_id (references users)
    INSERT INTO notifications (user_id, type, message, metadata)
    VALUES (
      lost_record.auth_id,
      'nfc_tap',
      '🔍 Possible match found for your ' || lost_record.title || '!',
      jsonb_build_object(
        'match_type', 'auto_match',
        'found_item_id', NEW.id,
        'found_item_title', NEW.title,
        'category', NEW.category,
        'location', NEW.location_label
      )
    );
  END LOOP;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.trigger_lost_post_match()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  found_record RECORD;
BEGIN
  FOR found_record IN
    SELECT ci.id, ci.finder_id, ci.title, u.auth_id
    FROM community_items ci
    JOIN users u ON u.id = ci.finder_id
    WHERE ci.category = NEW.category
      AND ci.status = 'open'
      AND ci.created_at > NOW() - INTERVAL '30 days'
  LOOP
    -- Use auth_id (references auth.users) not finder_id (references users)
    INSERT INTO notifications (user_id, type, message, metadata)
    VALUES (
      found_record.auth_id,
      'nfc_tap',
      '🔔 Someone just reported losing a ' || NEW.category || ' — could it be the one you found?',
      jsonb_build_object(
        'match_type', 'auto_match',
        'lost_post_id', NEW.id,
        'lost_item_title', NEW.title,
        'category', NEW.category
      )
    );
  END LOOP;
  RETURN NEW;
END;
$function$;
