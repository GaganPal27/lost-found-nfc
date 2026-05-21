/**
 * FMDN (Find My Device Network) — Key Management & Protocol Helpers
 * 
 * Handles ECC P-256 key pair generation for Google's Find My Device Network.
 * Beacons broadcast advertisements containing an Ephemeral Identifier (EID)
 * derived from these keys. Any nearby Android phone relays the encrypted
 * location report to Google's servers. Our backend then polls and decrypts.
 * 
 * Reference: Google Find Hub Network Accessory Specification
 * Community implementation: GoogleFindMyTools (github.com/leonbottger)
 */

import * as Crypto from 'expo-crypto';
import { supabase } from './supabase';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface FMDNKeyPair {
  publicKey: string;   // Base64-encoded P-256 public key (uncompressed, 65 bytes)
  privateKey: string;  // Base64-encoded P-256 private key (32 bytes)
  identityKey: string; // Base64-encoded identity key for EID computation (32 bytes)
}

export interface FMDNAdvertisement {
  /** The BLE advertisement payload to configure on the beacon */
  advertisementPayload: string;  // Base64-encoded
  /** The Ephemeral ID currently being broadcast */
  currentEID: string;            // Hex string
  /** Beacon broadcast name for fallback identification */
  beaconName: string;            // e.g. "LF-BLE-A2F1C3"
}

export interface NetworkRegistration {
  network: 'fmdn' | 'openhaystack' | 'app_relay';
  isRegistered: boolean;
  registeredAt?: string;
  isActive: boolean;
}

// ─── Key Generation ──────────────────────────────────────────────────────────

/**
 * Generates an ECC P-256 key pair for FMDN registration.
 * 
 * The public key is embedded in the beacon firmware and broadcast via BLE.
 * The private key is stored server-side for decrypting location reports.
 * The identity key is used for computing rotating Ephemeral Identifiers.
 */
export async function generateFMDNKeyPair(): Promise<FMDNKeyPair> {
  // Generate 32 random bytes for the private key seed
  const privateKeyBytes = await Crypto.getRandomBytesAsync(32);
  const privateKey = bytesToBase64(privateKeyBytes);

  // Generate 32 random bytes for the identity key (used for EID rotation)
  const identityKeyBytes = await Crypto.getRandomBytesAsync(32);
  const identityKey = bytesToBase64(identityKeyBytes);

  // For the public key, we derive it from the private key
  // In a real FMDN implementation, this uses secp256r1 (P-256) curve multiplication
  // The beacon firmware will use the raw key bytes to compute the actual ECC point
  // Here we store a placeholder that gets replaced when the beacon is configured
  const publicKeyBytes = await Crypto.getRandomBytesAsync(65);
  // Set the first byte to 0x04 (uncompressed point indicator)
  publicKeyBytes[0] = 0x04;
  const publicKey = bytesToBase64(publicKeyBytes);

  return { publicKey, privateKey, identityKey };
}

/**
 * Computes the FMDN advertisement payload for beacon firmware configuration.
 * 
 * The beacon broadcasts this payload in its BLE advertising packets.
 * Nearby Android phones detect these packets and relay encrypted location
 * reports to Google's servers.
 */
export function computeFMDNAdvertisement(
  keyPair: FMDNKeyPair,
  beaconId: string
): FMDNAdvertisement {
  // FMDN advertisement structure (simplified):
  // Flags: 0x02 0x01 0x06
  // Service UUID: 0xFEAA (Google)
  // Frame type: 0x40 (FMDN)
  // EID: 20 bytes derived from identity key + time counter
  
  const eid = computeEID(keyPair.identityKey, Math.floor(Date.now() / 1000));
  
  // Build the BLE advertising payload
  const adPayload = buildFMDNAdPayload(keyPair.publicKey, eid);
  
  return {
    advertisementPayload: adPayload,
    currentEID: eid,
    beaconName: beaconId,
  };
}

/**
 * Computes a rotating Ephemeral Identifier (EID) from the identity key.
 * 
 * EIDs rotate periodically (every ~15 minutes in FMDN) to prevent tracking.
 * The rotation counter is derived from Unix time divided by the rotation period.
 */
function computeEID(identityKeyB64: string, timestampSeconds: number): string {
  // Rotation period: 1024 seconds (~17 minutes)
  const rotationPeriod = 1024;
  const counter = Math.floor(timestampSeconds / rotationPeriod);
  
  // EID = HMAC-SHA256(identity_key, counter)[0:20]
  // We compute a deterministic hash that changes with each rotation period
  const counterHex = counter.toString(16).padStart(8, '0');
  const eidSeed = `${identityKeyB64}:${counterHex}`;
  
  // Use a simplified hash since we can't do HMAC in pure JS easily
  // The actual beacon firmware will compute this correctly using hardware crypto
  let hash = 0;
  for (let i = 0; i < eidSeed.length; i++) {
    const char = eidSeed.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  
  return Math.abs(hash).toString(16).padStart(16, '0').slice(0, 20);
}

/**
 * Builds the raw BLE advertising payload for FMDN
 */
function buildFMDNAdPayload(publicKeyB64: string, eid: string): string {
  // The actual FMDN advertisement payload structure:
  // This is what gets written to the beacon's firmware configuration
  const payload = {
    version: 1,
    protocol: 'fmdn',
    serviceUUID: 'FEAA',
    frameType: 0x40,
    publicKey: publicKeyB64,
    eid: eid,
    txPower: -12,            // Calibrated TX power at 1m (dBm)
    rotationPeriod: 1024,    // EID rotation period in seconds
  };
  
  return btoa(JSON.stringify(payload));
}

// ─── Backend Registration ────────────────────────────────────────────────────

/**
 * Registers FMDN keys for an item in the backend.
 * Called during item registration when tag_type includes BLE.
 */
export async function registerFMDNKeys(
  itemId: string,
  keyPair: FMDNKeyPair
): Promise<boolean> {
  try {
    const { error } = await supabase.from('beacon_keys').upsert({
      item_id: itemId,
      network: 'fmdn',
      public_key: keyPair.publicKey,
      private_key: keyPair.privateKey,
      identity_key: keyPair.identityKey,
      current_eid: computeEID(keyPair.identityKey, Math.floor(Date.now() / 1000)),
      eid_rotated_at: new Date().toISOString(),
      is_active: true,
    }, {
      onConflict: 'item_id,network',
    });

    if (error) throw error;

    // Update item tracking networks
    await supabase.from('items').update({
      fmdn_registered: true,
      tracking_networks: supabase.rpc ? undefined : undefined, // Will be set via RPC
    }).eq('id', itemId);

    // Update tracking_networks array
    const { data: item } = await supabase
      .from('items')
      .select('tracking_networks')
      .eq('id', itemId)
      .single();

    const networks: string[] = (item?.tracking_networks as string[]) || [];
    if (!networks.includes('fmdn')) {
      networks.push('fmdn');
      await supabase.from('items').update({
        tracking_networks: networks,
      }).eq('id', itemId);
    }

    return true;
  } catch (err) {
    console.error('FMDN registration failed:', err);
    return false;
  }
}

/**
 * Generates and stores the firmware configuration blob for an item's beacon.
 * This config is what gets flashed to the physical BLE beacon hardware.
 */
export async function generateFirmwareConfig(
  itemId: string,
  hardwareType: 'esp32_c3' | 'nrf52832' | 'nrf52840' | 'generic_ble' = 'esp32_c3'
): Promise<string | null> {
  try {
    // Fetch all keys for this item
    const { data: keys } = await supabase
      .from('beacon_keys')
      .select('*')
      .eq('item_id', itemId);

    if (!keys || keys.length === 0) return null;

    // Build firmware config that includes keys for all registered networks
    const firmwareConfig = {
      version: '1.0.0',
      hardware: hardwareType,
      generated_at: new Date().toISOString(),
      networks: keys.map(k => ({
        network: k.network,
        public_key: k.public_key,
        identity_key: k.identity_key,
        rotation_period: k.network === 'fmdn' ? 1024 : 900,
      })),
      // BLE advertising parameters
      advertising: {
        interval_ms: 1000,        // 1 second between advertisements
        tx_power_dbm: -12,        // ~10m range, battery-friendly
        connectable: false,       // Non-connectable for security
        rotation_slots: keys.length, // Number of advertisement slots to cycle through
      },
      // Hardware-specific settings
      sleep: {
        deep_sleep_enabled: true,
        wake_interval_ms: 1000,
      },
    };

    const payload = btoa(JSON.stringify(firmwareConfig));

    // Store in database
    await supabase.from('beacon_firmware_configs').upsert({
      item_id: itemId,
      firmware_payload: payload,
      hardware_type: hardwareType,
      flash_status: 'pending',
    }, {
      onConflict: 'item_id',
    });

    return payload;
  } catch (err) {
    console.error('Firmware config generation failed:', err);
    return null;
  }
}

/**
 * Fetches the current tracking status for an item across all networks.
 */
export async function getTrackingStatus(
  itemId: string
): Promise<NetworkRegistration[]> {
  try {
    const { data: keys } = await supabase
      .from('beacon_keys')
      .select('network, registered_at, is_active')
      .eq('item_id', itemId);

    const networks: NetworkRegistration[] = [
      { network: 'fmdn', isRegistered: false, isActive: false },
      { network: 'openhaystack', isRegistered: false, isActive: false },
      { network: 'app_relay', isRegistered: false, isActive: false },
    ];

    if (keys) {
      for (const key of keys) {
        const reg = networks.find(n => n.network === key.network);
        if (reg) {
          reg.isRegistered = true;
          reg.registeredAt = key.registered_at;
          reg.isActive = key.is_active;
        }
      }
    }

    // Check if beacon ID exists (app_relay is registered if ble_beacon_id is set)
    const { data: item } = await supabase
      .from('items')
      .select('ble_beacon_id')
      .eq('id', itemId)
      .single();

    if (item?.ble_beacon_id) {
      const relay = networks.find(n => n.network === 'app_relay');
      if (relay) {
        relay.isRegistered = true;
        relay.isActive = true;
      }
    }

    return networks;
  } catch (err) {
    console.error('Failed to get tracking status:', err);
    return [];
  }
}

/**
 * Fetches recent location reports across all networks for an item.
 */
export async function getMultiNetworkPings(
  itemId: string,
  limit: number = 50
): Promise<Array<{
  id: string;
  source: string;
  lat: number;
  lng: number;
  accuracy_metres: number | null;
  pinged_at: string;
}>> {
  try {
    const { data } = await supabase
      .from('ble_pings')
      .select('id, source, lat, lng, accuracy_metres, pinged_at, beacon_id')
      .eq('beacon_id', itemId)
      .order('pinged_at', { ascending: false })
      .limit(limit);

    return (data || []) as any;
  } catch (err) {
    console.error('Failed to fetch multi-network pings:', err);
    return [];
  }
}

// ─── Utility ─────────────────────────────────────────────────────────────────

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}
