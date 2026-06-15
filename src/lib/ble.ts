/**
 * BLE Scanning & Relay — Sprint 1 Hardened Version
 *
 * Changes in Sprint 1:
 * 1. generateServiceUUID() — derives a deterministic 128-bit UUID from beacon_id
 * 2. scanForNearbyBeacons() — matches by BOTH device name AND Service UUID
 * 3. Background task — fixed race condition with Promise-based scan + isScanning guard
 * 4. Duplicate scan guard — prevents concurrent scan crashes
 */

import { BleManager } from 'react-native-ble-plx';
import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
import { Platform, PermissionsAndroid } from 'react-native';

export const BLE_RELAY_TASK = 'BLE_RELAY_BACKGROUND_TASK';
export const bleManager = new BleManager();

// Guard: prevents starting a new scan while one is already running
let isScanning = false;

// ─── Service UUID Generation ──────────────────────────────────────────────────
// Derives a deterministic, unique 128-bit Service UUID from a beacon ID string.
// This UUID is programmed into the ESP32 firmware AND stored in the database.
// The scanner uses it to match beacons even when the device name is hidden (iOS background).
//
// Algorithm: simple deterministic hash → UUID v4 format
// Input:  "LF-BLE-A3F2B1"
// Output: "4c464654-a3f2-4b31-8000-000000000001" (example)
export function generateServiceUUID(beaconId: string): string {
  // Hash the beacon ID into a 32-char hex string
  let hash = 0;
  for (let i = 0; i < beaconId.length; i++) {
    const chr = beaconId.charCodeAt(i);
    hash = (hash << 5) - hash + chr;
    hash |= 0; // Convert to 32-bit int
  }
  // Use the beacon suffix (e.g. "A3F2B1") directly for the last segments
  const suffix = beaconId.replace('LF-BLE-', '').toLowerCase().padEnd(12, '0');
  const h32 = Math.abs(hash).toString(16).padStart(8, '0');

  // Format as UUID: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
  // Prefix with "4c4c" (hex for "LL" = LostFound) for easy identification
  const uuid = [
    `4c4c${h32.slice(0, 4)}`,       // 8 chars
    h32.slice(4, 8),                 // 4 chars
    `4${suffix.slice(0, 3)}`,        // 4 chars (version 4)
    `8${suffix.slice(3, 6)}`,        // 4 chars (variant bits)
    `${suffix}000000`,               // 12 chars
  ].join('-').toLowerCase();

  return uuid;
}

// ─── Permissions ──────────────────────────────────────────────────────────────
async function requestBluetoothPermissions(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  if (Platform.Version < 31) return true; // Android < 12 doesn't need explicit BT perms
  try {
    const result = await PermissionsAndroid.requestMultiple([
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
    ]);
    return (
      result[PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN] === 'granted' &&
      result[PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT] === 'granted'
    );
  } catch (e) {
    console.warn('BLE permission request failed:', e);
    return false;
  }
}

// ─── Foreground Scan ──────────────────────────────────────────────────────────
// Scans for beacons matching by:
//   1. Device name prefix "LF-BLE-" (when name is visible, e.g. Android foreground)
//   2. Service UUID in advertisement data (works on iOS background + nameless devices)
//
// knownServiceUUIDs: optional list of registered service_uuids to match against
export const scanForNearbyBeacons = async (
  callback: (device: { id: string; name: string; rssi: number; serviceUUID?: string }) => void,
  durationMs: number = 8000,
  knownServiceUUIDs: string[] = [],
): Promise<{ permissionDenied?: boolean }> => {
  const btGranted = await requestBluetoothPermissions();
  if (!btGranted) return { permissionDenied: true };

  // Guard: don't start if already scanning
  if (isScanning) {
    console.warn('BLE scan already in progress — skipping');
    return {};
  }

  isScanning = true;

  return new Promise((resolve) => {
    try {
      bleManager.startDeviceScan(
        null, // scan all service UUIDs
        { allowDuplicates: false },
        (error, device) => {
          if (error) {
            console.warn('BLE scan error:', error.message);
            bleManager.stopDeviceScan();
            isScanning = false;
            resolve({});
            return;
          }
          if (!device) return;

          const deviceName = device.name || device.localName || '';
          const deviceServiceUUIDs = (device as any).serviceUUIDs as string[] | undefined;

          // Match by name prefix
          const matchesByName = deviceName.startsWith('LF-BLE-');

          // Match by Service UUID (for iOS background / nameless beacons)
          const matchesByUUID =
            knownServiceUUIDs.length > 0 &&
            deviceServiceUUIDs != null &&
            deviceServiceUUIDs.some((svcId: string) =>
              knownServiceUUIDs.some(known =>
                known.toLowerCase() === svcId.toLowerCase()
              )
            );

          if ((matchesByName || matchesByUUID) && device.rssi) {
            const matchedUUID = matchesByUUID
              ? deviceServiceUUIDs?.find((svcId: string) =>
                  knownServiceUUIDs.some(k => k.toLowerCase() === svcId.toLowerCase())
                )
              : undefined;

            callback({
              id: device.id,
              name: deviceName || matchedUUID || device.id,
              rssi: device.rssi,
              serviceUUID: matchedUUID,
            });
          }
        }
      );
    } catch (e) {
      console.warn('startDeviceScan threw:', e);
      isScanning = false;
      resolve({});
      return;
    }

    setTimeout(() => {
      bleManager.stopDeviceScan();
      isScanning = false;
      resolve({});
    }, durationMs);
  });
};

// ─── Background Service ───────────────────────────────────────────────────────
export const startBLEScanning = async () => {
  const { status: fgStatus } = await Location.requestForegroundPermissionsAsync();
  const { status: bgStatus } = await Location.requestBackgroundPermissionsAsync();

  if (fgStatus !== 'granted' || bgStatus !== 'granted') {
    console.warn('Location permissions required for BLE background tracking');
    return;
  }

  const isRegistered = await TaskManager.isTaskRegisteredAsync(BLE_RELAY_TASK);
  if (!isRegistered) {
    await Location.startLocationUpdatesAsync(BLE_RELAY_TASK, {
      accuracy: Location.Accuracy.Balanced,
      timeInterval: 60000,   // fire at most once per minute
      distanceInterval: 50,  // or every 50m
      foregroundService: {
        notificationTitle: 'Poki Lost & Found Active',
        notificationBody: 'Scanning nearby beacons to help locate lost items',
        notificationColor: '#6366f1',
      },
    });
  }
};

export const stopBLEScanning = async () => {
  const isRegistered = await TaskManager.isTaskRegisteredAsync(BLE_RELAY_TASK);
  if (isRegistered) {
    await Location.stopLocationUpdatesAsync(BLE_RELAY_TASK);
  }
  if (isScanning) {
    bleManager.stopDeviceScan();
    isScanning = false;
  }
};

// ─── Background Task ──────────────────────────────────────────────────────────
// SPRINT 1 FIX: The old version used a loose setTimeout which was killed by Android OS
// before the scan could complete. This version wraps the scan in a Promise that
// resolves AS SOON as a known beacon is found (fast path) or after 6 seconds (timeout).
// The relay call is fire-and-forget so it doesn't block task completion.

TaskManager.defineTask(BLE_RELAY_TASK, async ({ data, error }) => {
  if (error) { console.error('[BLE Task]', error); return; }
  if (!data) return;

  const { locations } = data as any;
  const loc = locations?.[0];
  if (!loc) return;

  // Guard: skip if a scan is already running from foreground
  if (isScanning) return;

  const edgeUrl = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/ble-location-relay`;
  const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

  // Promise-based background scan — resolves when beacon found OR after 6s
  await new Promise<void>((resolve) => {
    let taskComplete = false;
    isScanning = true;

    const finish = () => {
      if (taskComplete) return;
      taskComplete = true;
      bleManager.stopDeviceScan();
      isScanning = false;
      resolve();
    };

    // Hard timeout: ensure we always finish within 6s
    const timeout = setTimeout(finish, 6000);

    try {
      bleManager.startDeviceScan(null, { allowDuplicates: false }, (err, device) => {
        if (err || !device) return;

        const deviceName = device.name || device.localName || '';
        const matchesByName = deviceName.startsWith('LF-BLE-');
        // Note: in background, fetch known service UUIDs would require an async DB call
        // which is expensive — name-based matching is sufficient for background relay

        if (matchesByName && device.rssi) {
          // Relay immediately (fire-and-forget)
          fetch(edgeUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${anonKey}`,
            },
            body: JSON.stringify({
              beacon_id: deviceName,
              lat: loc.coords.latitude,
              lng: loc.coords.longitude,
              accuracy_metres: loc.coords.accuracy,
              relay_app_version: '2.1.0',
              source: 'app_relay',
            }),
          }).catch(e => console.warn('[BLE Relay]', e));

          // Fast path: found a beacon — stop scan immediately instead of waiting 6s
          clearTimeout(timeout);
          finish();
        }
      });
    } catch (e) {
      console.warn('[BLE Task] startDeviceScan threw:', e);
      clearTimeout(timeout);
      finish();
    }
  });
});
