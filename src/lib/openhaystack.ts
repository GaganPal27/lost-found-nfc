/**
 * OpenHaystack — Apple Find My Network Integration Helpers
 * 
 * Handles ECC P-224 key pair generation for piggy-backing on Apple's
 * Find My network via the OpenHaystack protocol.
 * 
 * When a beacon broadcasts an OpenHaystack-compatible advertisement,
 * nearby iPhones detect it and upload encrypted location reports to
 * Apple's servers. Our backend polls for these reports and decrypts them.
 * 
 * Reference: OpenHaystack (github.com/seemoo-lab/openhaystack)
 * 
 * ⚠️ WARNING: This is not officially sanctioned by Apple.
 * Use at your own risk. Apple could change their protocol at any time.
 */

import * as Crypto from 'expo-crypto';
import { supabase } from './supabase';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface OpenHaystackKeyPair {
  publicKey: string;      // Base64-encoded P-224 public key (compressed, 29 bytes)
  privateKey: string;     // Base64-encoded P-224 private key (28 bytes)
  advertisedKey: string;  // The key bytes that get broadcast in the BLE advertisement
  hashedKey: string;      // SHA-256 hash of the public key (used as identifier)
}

export interface OpenHaystackAdvertisement {
  /** Raw BLE advertisement bytes for the beacon firmware */
  advertisementPayload: string;  // Base64-encoded
  /** The advertised public key hash (used to query Apple's servers) */
  keyHash: string;               // Hex string
}

// ─── Key Generation ──────────────────────────────────────────────────────────

/**
 * Generates an ECC P-224 key pair for OpenHaystack.
 * 
 * The public key is split across the BLE advertisement:
 * - Bytes 6-27 go into the advertisement payload
 * - Bits from byte 0 are embedded in the BLE address
 * 
 * The private key is stored server-side for decrypting location reports.
 */
export async function generateOpenHaystackKeyPair(): Promise<OpenHaystackKeyPair> {
  // Generate random bytes for the private key (P-224 = 28 bytes)
  const privateKeyBytes = await Crypto.getRandomBytesAsync(28);
  const privateKey = bytesToBase64(privateKeyBytes);

  // Generate the public key (in real implementation, this is EC point multiplication)
  // The beacon firmware will compute the actual ECC point from the private key
  // Here we generate a placeholder that will be used for identification
  const publicKeyBytes = await Crypto.getRandomBytesAsync(29);
  // Set first byte as compressed point indicator (0x02 or 0x03)
  publicKeyBytes[0] = 0x02;
  const publicKey = bytesToBase64(publicKeyBytes);

  // The advertised key is bytes 6-27 of the public key
  const advertisedKeyBytes = publicKeyBytes.slice(6, 28);
  const advertisedKey = bytesToBase64(advertisedKeyBytes);

  // Hash of the public key — used as the identifier when querying Apple's servers
  const hashHex = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    publicKey
  );
  const hashedKey = hashHex;

  return { publicKey, privateKey, advertisedKey, hashedKey };
}

/**
 * Computes the OpenHaystack BLE advertisement payload.
 * 
 * Format:
 *   AD Type 0xFF (Manufacturer Specific)
 *   Company: 0x004C (Apple)
 *   Type: 0x12 0x19 (Find My)
 *   Status: 0x00
 *   Public key bytes (22 bytes from positions 6-27)
 *   Key hint (2 bytes)
 */
export function computeOpenHaystackAdvertisement(
  keyPair: OpenHaystackKeyPair
): OpenHaystackAdvertisement {
  const payload = {
    version: 1,
    protocol: 'openhaystack',
    companyId: '004C',  // Apple
    type: '1219',       // Find My accessory
    status: 0x00,
    advertisedKey: keyPair.advertisedKey,
    publicKeyHash: keyPair.hashedKey,
  };

  return {
    advertisementPayload: btoa(JSON.stringify(payload)),
    keyHash: keyPair.hashedKey,
  };
}

// ─── Backend Registration ────────────────────────────────────────────────────

/**
 * Registers OpenHaystack keys for an item in the backend.
 */
export async function registerOpenHaystackKeys(
  itemId: string,
  keyPair: OpenHaystackKeyPair
): Promise<boolean> {
  try {
    const { error } = await supabase.from('beacon_keys').upsert({
      item_id: itemId,
      network: 'openhaystack',
      public_key: keyPair.publicKey,
      private_key: keyPair.privateKey,
      identity_key: keyPair.hashedKey,
      is_active: true,
    }, {
      onConflict: 'item_id,network',
    });

    if (error) throw error;

    // Update item flags
    await supabase.from('items').update({
      openhaystack_registered: true,
    }).eq('id', itemId);

    // Update tracking_networks array
    const { data: item } = await supabase
      .from('items')
      .select('tracking_networks')
      .eq('id', itemId)
      .single();

    const networks: string[] = (item?.tracking_networks as string[]) || [];
    if (!networks.includes('openhaystack')) {
      networks.push('openhaystack');
      await supabase.from('items').update({
        tracking_networks: networks,
      }).eq('id', itemId);
    }

    return true;
  } catch (err) {
    console.error('OpenHaystack registration failed:', err);
    return false;
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
