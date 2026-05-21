// Supabase Edge Function: send-push-notification
// Sends an Expo Push Notification to the item owner when their item is scanned.
// Deploy with: supabase functions deploy send-push-notification

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const EXPO_PUSH_API = 'https://exp.host/--/api/v2/push/send';

serve(async (req: Request) => {
  try {
    const { owner_id, conversation_id, item_name, finder_name, location_label } = await req.json();

    if (!owner_id || !item_name) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), { status: 400 });
    }

    // Init Supabase with service role (bypasses RLS)
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Fetch the owner's push tokens
    const { data: tokens } = await supabase
      .from('push_tokens')
      .select('token')
      .eq('user_id', owner_id);

    if (!tokens || tokens.length === 0) {
      return new Response(JSON.stringify({ message: 'No push tokens found for owner' }), { status: 200 });
    }

    // Build location part of message
    const locationPart = location_label ? ` near ${location_label}` : '';
    const title = `🔍 Your "${item_name}" was found!`;
    const body = `${finder_name ?? 'Someone'} found it${locationPart}. Tap to connect.`;

    // Send to all registered tokens
    const messages = tokens.map(({ token }: { token: string }) => ({
      to: token,
      sound: 'default',
      title,
      body,
      data: { conversation_id, item_name, location_label },
      badge: 1,
      priority: 'high',
    }));

    const response = await fetch(EXPO_PUSH_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip, deflate',
      },
      body: JSON.stringify(messages),
    });

    const result = await response.json();
    console.log('Expo push result:', JSON.stringify(result));

    return new Response(JSON.stringify({ success: true, sent: messages.length, result }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Push notification error:', err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});
