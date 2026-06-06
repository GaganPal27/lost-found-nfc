import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Earth's radius in kilometers
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

    if (!record || !record.id || !record.last_seen_lat || !record.last_seen_lng || !record.radius_km) {
      throw new Error('Invalid payload: missing required lost item fields');
    }

    const { last_seen_lat, last_seen_lng, radius_km, title, poster_id, category } = record;

    // 1. Get all users who have a recent location AND a push token
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

    const { data: users, error: userError } = await supabaseClient
      .from('users')
      .select('id, last_lat, last_lng, location_updated_at, expo_push_token')
      .not('last_lat', 'is', null)
      .not('last_lng', 'is', null)
      .gte('location_updated_at', sevenDaysAgo.toISOString())
      .eq('push_notifications_enabled', true)
      .not('expo_push_token', 'is', null)
      .gte('push_token_updated_at', sixtyDaysAgo.toISOString())
      .neq('id', poster_id); // Don't notify the poster

    if (userError) throw userError;

    // 2. Filter users within radius
    const nearbyUsers = (users || []).filter((u) => {
      const dist = haversineDistance(last_seen_lat, last_seen_lng, u.last_lat, u.last_lng);
      return dist <= radius_km;
    });
    const nearbyUserIds = nearbyUsers.map((u) => u.id);
    const tokens = nearbyUsers
      .map((u) => u.expo_push_token)
      .filter((t): t is string => !!t);

    if (nearbyUserIds.length === 0) {
      return new Response(JSON.stringify({ success: true, message: 'No nearby users found', notifiedCount: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }


    if (tokens.length === 0) {
      // Still insert in-app notifications if users are nearby but no tokens
      if (nearbyUserIds.length > 0) {
        const notificationsToInsert = nearbyUserIds.map((uid) => ({
          user_id: uid,
          title: 'Lost Item Nearby 📍',
          body: `Someone lost a ${category || 'item'} near you: ${title}. Can you help?`,
          type: 'lost_nearby',
          data: { route: '/(tabs)/community', tab: 'lost', item_id: record.id },
        }));
        await supabaseClient.from('notifications').insert(notificationsToInsert);
      }
      return new Response(JSON.stringify({ success: true, message: 'Nearby users found, but no push tokens', notifiedCount: nearbyUserIds.length }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    // 4. Send Expo Push Notifications in batches of 100 (Expo API limit)
    const BATCH_SIZE = 100;
    const allExpoResponses: any[] = [];
    for (let i = 0; i < tokens.length; i += BATCH_SIZE) {
      const batch = tokens.slice(i, i + BATCH_SIZE);
      const pushMessage = {
        to: batch,
        sound: 'default',
        title: 'Lost Item Nearby 📍',
        body: `Someone lost a ${category || 'item'} near you: "${title}". Can you help?`,
        data: { route: '/(tabs)/community', tab: 'lost', item_id: record.id },
        priority: 'high',
        channelId: 'default',
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

    // 5. Also insert into notifications table for in-app bell
    const notificationsToInsert = nearbyUserIds.map((uid) => ({
      user_id: uid,
      title: 'Lost Item Nearby 📍',
      body: `Someone lost a ${category || 'item'} near you: ${title}. Can you help?`,
      type: 'lost_nearby',
      data: { route: '/(tabs)/community', tab: 'lost', item_id: record.id },
    }));

    await supabaseClient.from('notifications').insert(notificationsToInsert);

    return new Response(JSON.stringify({ success: true, expoResponses: allExpoResponses, notifiedCount: nearbyUserIds.length, pushTokenCount: tokens.length }), {
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
