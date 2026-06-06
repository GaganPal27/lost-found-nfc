import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const EARTH_RADIUS_KM = 6371;

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * c;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { record } = await req.json();

    if (!record || !record.id || !record.location_found_lat || !record.location_found_lng || !record.category) {
      throw new Error('Invalid payload: missing required community item fields');
    }

    const { id: found_item_id, location_found_lat, location_found_lng, category, finder_id, title } = record;

    // 1. Get all lost posts in the same category that are still searching and < 7 days old
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const { data: lostPosts, error: lostError } = await supabaseClient
      .from('lost_item_posts')
      .select('id, poster_id, title, last_seen_lat, last_seen_lng')
      .eq('category', category)
      .eq('status', 'searching')
      .gte('created_at', sevenDaysAgo.toISOString())
      .neq('poster_id', finder_id); // Exclude the finder themselves

    if (lostError) throw lostError;

    // 2. Filter posts within 2km
    const matchingPosts = (lostPosts || []).filter((post) => {
      const dist = haversineDistance(location_found_lat, location_found_lng, post.last_seen_lat, post.last_seen_lng);
      return dist <= 2.0;
    });

    if (matchingPosts.length === 0) {
      return new Response(JSON.stringify({ success: true, message: 'No matches found', matchCount: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    // 3. For each match, we want to notify the poster (loser)
    // In a production scenario we might also notify the finder, but let's notify the loser first.
    const loserIds = matchingPosts.map(p => p.poster_id);

    // Get push tokens for the losers
    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

    const { data: users, error: userError } = await supabaseClient
      .from('users')
      .select('id, expo_push_token')
      .in('id', loserIds)
      .eq('push_notifications_enabled', true)
      .not('expo_push_token', 'is', null)
      .gte('push_token_updated_at', sixtyDaysAgo.toISOString());

    if (userError) throw userError;

    // We will map users to their tokens
    const tokens = (users || []).map((u) => u.expo_push_token).filter((t): t is string => !!t);

    // Also notify the finder that a potential match was found!
    const { data: finder } = await supabaseClient
      .from('users')
      .select('expo_push_token')
      .eq('id', finder_id)
      .eq('push_notifications_enabled', true)
      .single();

    if (finder?.expo_push_token) {
      tokens.push(finder.expo_push_token);
    }

    // Insert in-app notifications
    const notificationsToInsert = [];
    
    for (const post of matchingPosts) {
      notificationsToInsert.push({
        user_id: post.poster_id,
        type: 'message',
        message: `Smart Match: A ${category} matching your lost "${post.title}" was just found nearby!`,
        metadata: { community_item_id: found_item_id, match_type: 'smart_match' },
      });
    }
    
    notificationsToInsert.push({
      user_id: finder_id,
      type: 'message',
      message: `Smart Match: The ${category} you just found matches a recently lost item!`,
      metadata: { community_item_id: found_item_id, match_type: 'smart_match' },
    });

    await supabaseClient.from('notifications').insert(notificationsToInsert);

    // Send Push Notifications if tokens exist
    const allExpoResponses: any[] = [];
    if (tokens.length > 0) {
      const BATCH_SIZE = 100;
      for (let i = 0; i < tokens.length; i += BATCH_SIZE) {
        const batch = tokens.slice(i, i + BATCH_SIZE);
        const pushMessage = {
          to: batch,
          sound: 'default',
          title: 'Smart Match Found 🪄',
          body: `We found a potential match for a ${category} nearby! Check the app now.`,
          data: { route: '/(tabs)/community', tab: 'found', item_id: found_item_id },
          priority: 'high',
        };
        const expoRes = await fetch('https://exp.host/--/api/v2/push/send', {
          method: 'POST',
          headers: {
            'Accept': 'application/json',
            'Accept-encoding': 'gzip, deflate',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(pushMessage),
        });
        const expoData = await expoRes.json();
        allExpoResponses.push(expoData);
      }
    }

    return new Response(JSON.stringify({ success: true, expoResponses: allExpoResponses, matchCount: matchingPosts.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});
