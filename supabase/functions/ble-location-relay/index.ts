// @ts-nocheck
/**
 * BLE Location Relay — Enhanced Multi-Source Version
 * 
 * Receives beacon sighting reports from:
 * - App relay (our app users scanning BLE in background)
 * - Manual sighting submissions
 * 
 * Handles deduplication and source attribution.
 * FMDN and OpenHaystack reports come through their own dedicated edge functions.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      }
    })
  }

  try {
    const {
      beacon_id,
      lat,
      lng,
      accuracy_metres,
      relay_app_version,
      source = 'app_relay',  // 'app_relay' | 'manual'
    } = await req.json();

    if (!beacon_id || lat == null || lng == null) {
      return new Response(JSON.stringify({ error: 'Missing required fields: beacon_id, lat, lng' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Look up the beacon
    const { data: item } = await supabase
      .from('items')
      .select('id, user_id, item_name, last_seen_at, last_seen_source')
      .eq('ble_beacon_id', beacon_id)
      .single();

    if (!item) {
      return new Response(JSON.stringify({ error: 'Unknown beacon' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }

    // Deduplication: skip if we received a ping from the same location within 2 minutes
    const twoMinAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();
    const { data: recentPings } = await supabase
      .from('ble_pings')
      .select('id')
      .eq('beacon_id', beacon_id)
      .gte('pinged_at', twoMinAgo)
      .limit(1);

    if (recentPings && recentPings.length > 0) {
      return new Response(JSON.stringify({ status: 'deduplicated' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }

    // Insert the ping with source tracking
    await supabase.from('ble_pings').insert({
      beacon_id,
      lat,
      lng,
      accuracy_metres,
      relay_app_version,
      source,
    });

    // Update item location
    await supabase.from('items').update({
      last_seen_lat: lat,
      last_seen_lng: lng,
      last_seen_at: new Date().toISOString(),
      last_seen_source: source,
    }).eq('id', item.id);

    // Notification logic — only if >30 min since last notification
    const lastPingTime = item.last_seen_at ? new Date(item.last_seen_at).getTime() : 0;
    const minutesSinceLast = (Date.now() - lastPingTime) / 60000;

    if (minutesSinceLast > 30) {
      let areaLabel = 'an unknown location';
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);
        const geodata = await res.json();
        areaLabel = geodata?.address?.city || geodata?.address?.town || geodata?.address?.suburb || 'an unknown location';
      } catch (_) {}

      const sourceLabel = source === 'app_relay'
        ? 'a Lost & Found app user'
        : source === 'fmdn'
        ? "Google's Find My Device network"
        : source === 'openhaystack'
        ? "Apple's Find My network"
        : 'the tracking network';

      const emoji = source === 'fmdn' ? '📡' : source === 'openhaystack' ? '🍎' : '📱';

      await supabase.from('notifications').insert({
        user_id: item.user_id,
        type: 'ble_location',
        message: `${emoji} Your ${item.item_name} was spotted near ${areaLabel} via ${sourceLabel}`,
        metadata: {
          lat,
          lng,
          item_name: item.item_name,
          item_id: item.id,
          source,
          location_label: `Near ${areaLabel}`,
        },
      });
    }

    return new Response(JSON.stringify({ status: 'ok', source }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err?.message ?? String(err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }
})
