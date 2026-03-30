import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: { 'Access-Control-Allow-Origin': '*' } })
  }

  try {
    const { beacon_id, lat, lng, accuracy_metres } = await req.json();

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: item } = await supabase
      .from('items')
      .select('id, user_id, item_name, last_seen_at')
      .eq('ble_beacon_id', beacon_id)
      .single();

    if (!item) return new Response('Unknown beacon', { status: 404 });

    await supabase.from('ble_pings').insert({ beacon_id, lat, lng, accuracy_metres });

    await supabase.from('items').update({
      last_seen_lat: lat, last_seen_lng: lng, last_seen_at: new Date().toISOString()
    }).eq('id', item.id);

    const lastPingTime = item.last_seen_at ? new Date(item.last_seen_at).getTime() : 0;
    const minutesSinceLast = (Date.now() - lastPingTime) / 60000;

    if (minutesSinceLast > 30) {
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);
      const geodata = await res.json();
      const areaLabel = geodata?.address?.city || geodata?.address?.town || 'an unknown location';

      await supabase.from('notifications').insert({
        user_id: item.user_id,
        type: 'ble_location',
        message: `Your ${item.item_name} was spotted near ${areaLabel}`,
        metadata: { lat, lng, item_name: item.item_name, location_label: `Near ${areaLabel}` }
      });
    }

    return new Response('OK', { status: 200, headers: { 'Access-Control-Allow-Origin': '*' } });
  } catch (err: any) {
    return new Response(String(err?.message ?? err), { status: 500 });
  }
})
