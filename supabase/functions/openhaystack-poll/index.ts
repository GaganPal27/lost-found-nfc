// @ts-nocheck
/**
 * OpenHaystack Poll Edge Function
 * 
 * Runs on a cron schedule (every 5 minutes) to:
 * 1. Fetch all active OpenHaystack-registered beacons
 * 2. Poll Apple's Find My servers for encrypted location reports
 * 3. Decrypt reports using stored private keys (P-224)
 * 4. Insert locations into ble_pings and update item positions
 * 5. Create notifications for new sightings
 * 
 * This enables tracking via Apple's ~1.8B iPhone network.
 * ⚠️ Not officially sanctioned by Apple — legal grey area.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// OpenHaystack proxy endpoint
// In production, this would point to a self-hosted OpenHaystack server/proxy
const OFHA_PROXY_URL = Deno.env.get('OPENHAYSTACK_PROXY_URL') || '';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      }
    });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const supabase = createClient(supabaseUrl, supabaseKey);

  // Skip if no proxy configured
  if (!OFHA_PROXY_URL) {
    return new Response(JSON.stringify({
      status: 'skipped',
      message: 'OpenHaystack proxy URL not configured. Set OPENHAYSTACK_PROXY_URL env var.',
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }

  try {
    // 1. Fetch all active OpenHaystack-registered beacons
    const { data: beaconKeys, error: keysError } = await supabase
      .from('beacon_keys')
      .select(`
        id,
        item_id,
        public_key,
        private_key,
        identity_key
      `)
      .eq('network', 'openhaystack')
      .eq('is_active', true);

    if (keysError || !beaconKeys || beaconKeys.length === 0) {
      return new Response(JSON.stringify({
        status: 'no_beacons',
        message: 'No active OpenHaystack beacons to poll'
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }

    let totalReports = 0;
    let updatedItems = 0;
    const errors: string[] = [];

    // 2. Batch request to OpenHaystack proxy
    // The proxy handles Apple authentication and report retrieval
    const keyHashes = beaconKeys.map(b => b.identity_key); // SHA-256 hashes

    try {
      const proxyResponse = await fetch(`${OFHA_PROXY_URL}/api/reports`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hashes: keyHashes,
          days: 1, // Look back 1 day
        }),
      });

      if (!proxyResponse.ok) {
        throw new Error(`Proxy returned ${proxyResponse.status}`);
      }

      const allReports = await proxyResponse.json();

      // 3. Process reports for each beacon
      for (const beacon of beaconKeys) {
        const beaconReports = allReports?.results?.[beacon.identity_key] || [];

        for (const report of beaconReports) {
          try {
            // 4. Decrypt the location report
            const location = decryptOpenHaystackReport(report, beacon.private_key);

            if (location) {
              totalReports++;

              // Store raw report
              const { data: reportRow } = await supabase
                .from('openhaystack_reports')
                .insert({
                  beacon_key_id: beacon.id,
                  item_id: beacon.item_id,
                  lat: location.lat,
                  lng: location.lng,
                  accuracy_metres: location.accuracy,
                  report_timestamp: new Date(report.timestamp * 1000).toISOString(),
                })
                .select('id')
                .single();

              // Insert into unified ble_pings
              await supabase.from('ble_pings').insert({
                beacon_id: `ofha-${beacon.item_id}`,
                lat: location.lat,
                lng: location.lng,
                accuracy_metres: location.accuracy,
                source: 'openhaystack',
                report_id: reportRow?.id,
              });

              // Update item location
              const { data: item } = await supabase
                .from('items')
                .select('last_seen_at, item_name, user_id')
                .eq('id', beacon.item_id)
                .single();

              await supabase.from('items').update({
                last_seen_lat: location.lat,
                last_seen_lng: location.lng,
                last_seen_at: new Date().toISOString(),
                last_seen_source: 'openhaystack',
              }).eq('id', beacon.item_id);

              updatedItems++;

              // Notification (if >30 min since last)
              if (item) {
                const lastPingTime = item.last_seen_at
                  ? new Date(item.last_seen_at).getTime()
                  : 0;
                const minutesSinceLast = (Date.now() - lastPingTime) / 60000;

                if (minutesSinceLast > 30) {
                  let areaLabel = 'a nearby location';
                  try {
                    const geoRes = await fetch(
                      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${location.lat}&lon=${location.lng}`
                    );
                    const geodata = await geoRes.json();
                    areaLabel = geodata?.address?.city
                      || geodata?.address?.town
                      || geodata?.address?.suburb
                      || 'a nearby location';
                  } catch (_) {}

                  await supabase.from('notifications').insert({
                    user_id: item.user_id,
                    type: 'ble_location',
                    message: `🍎 Your ${item.item_name} was spotted near ${areaLabel} via Apple's Find My network`,
                    metadata: {
                      lat: location.lat,
                      lng: location.lng,
                      item_name: item.item_name,
                      item_id: beacon.item_id,
                      source: 'openhaystack',
                      location_label: `Near ${areaLabel}`,
                    },
                  });
                }
              }
            }
          } catch (reportErr) {
            errors.push(`Report for ${beacon.id}: ${reportErr?.message || reportErr}`);
          }
        }
      }
    } catch (proxyErr) {
      errors.push(`Proxy error: ${proxyErr?.message || proxyErr}`);
    }

    return new Response(JSON.stringify({
      status: 'ok',
      beacons_polled: beaconKeys.length,
      reports_processed: totalReports,
      items_updated: updatedItems,
      errors: errors.length > 0 ? errors : undefined,
      polled_at: new Date().toISOString(),
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });

  } catch (err) {
    return new Response(JSON.stringify({
      status: 'error',
      message: err?.message ?? String(err),
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }
});

// ─── Decryption Helper ──────────────────────────────────────────────────────

/**
 * Decrypts an OpenHaystack location report.
 * 
 * OpenHaystack reports use ECIES with P-224:
 * 1. Extract ephemeral public key from report
 * 2. ECDH key agreement with our private key
 * 3. Derive AES key from shared secret via SHA-256
 * 4. Decrypt payload with AES-GCM
 * 5. Parse lat/lng from decrypted bytes (Apple's location encoding)
 */
function decryptOpenHaystackReport(
  report: { payload: string; timestamp: number },
  privateKeyB64: string
): { lat: number; lng: number; accuracy: number } | null {
  try {
    // Apple's location encoding (after decryption):
    // Bytes 0-3: latitude (fixed point, divide by 10^7)
    // Bytes 4-7: longitude (fixed point, divide by 10^7)
    // Byte 8: accuracy (horizontal accuracy in meters)
    // Byte 9: status flags
    
    // Placeholder: actual P-224 ECIES decryption
    // Will be implemented when OpenHaystack proxy is set up
    if (!report.payload) return null;
    
    return null;
  } catch (_) {
    return null;
  }
}
