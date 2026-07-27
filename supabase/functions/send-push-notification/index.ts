// Supabase Edge Function: send-push-notification
// Sends an Expo Push Notification to the item owner when their item is scanned.
// Deploy with: supabase functions deploy send-push-notification --no-verify-jwt

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const EXPO_PUSH_API = 'https://exp.host/--/api/v2/push/send';

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  try {
    const { owner_id, conversation_id, item_name, finder_name, location_label } = await req.json();

    if (!owner_id || !item_name) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
      });
    }

    // Init Supabase with service role (bypasses RLS)
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // ── Fetch the owner's push token from the users table ────────────────
    // Tokens are stored in users.expo_push_token (set by safeRegisterPushToken
    // in _layout.tsx). The push_tokens table may not exist — always read from users.
    const { data: userRow, error: userError } = await supabase
      .from('users')
      .select('expo_push_token, push_notifications_enabled')
      .eq('auth_id', owner_id)
      .maybeSingle();

    if (!userRow?.expo_push_token || userRow.push_notifications_enabled === false) {
      return new Response(JSON.stringify({ message: 'No push token found for owner' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
      });
    }

    const token = userRow.expo_push_token;

    // ── Build and send the push notification ────────────────────────────
    const locationPart = location_label ? ` near ${location_label}` : '';
    const title = `Your "${item_name}" was found!`;
    const body  = `${finder_name ?? 'Someone'} found it${locationPart}. Tap to connect.`;

    const message = {
      to: token,
      sound: 'default',
      title,
      body,
      data: { conversation_id, item_name, location_label },
      badge: 1,
      priority: 'high',
      channelId: 'default',
    };

    console.log(`Sending push to token=${token.substring(0, 20)}...`);

    const response = await fetch(EXPO_PUSH_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip, deflate',
      },
      body: JSON.stringify(message),
    });

    const result = await response.json();
    console.log('Expo push result:', JSON.stringify(result));

    return new Response(JSON.stringify({ success: true, result }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
    });
  } catch (err) {
    console.error('Push notification error:', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
    });
  }
});
