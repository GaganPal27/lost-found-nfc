/**
 * BLE Scanning & Relay — Enhanced Multi-Network Version
 * 
 * Handles background BLE scanning for our app relay network (Layer 3).
 * This scans for beacons with the "LF-BLE-" prefix and relays their
 * location to the ble-location-relay Edge Function.
 * 
 * Layers 1 (FMDN) and 2 (OpenHaystack) work at the OS level and don't
 * need our app — that's handled by the beacon firmware and edge functions.
 */

import { BleManager } from 'react-native-ble-plx';
import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
import { Platform, PermissionsAndroid } from 'react-native';

export const BLE_RELAY_TASK = 'BLE_RELAY_BACKGROUND_TASK';
export const bleManager = new BleManager();

/** Request Bluetooth permissions on Android 12+ */
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

/** Start background BLE scanning for the app relay network */
export const startBLEScanning = async () => {
  const { status: fgStatus } = await Location.requestForegroundPermissionsAsync();
  const { status: bgStatus } = await Location.requestBackgroundPermissionsAsync();
  
  if (fgStatus !== 'granted' || bgStatus !== 'granted') {
    console.warn('Location permissions required for BLE tracking');
    return;
  }

  const isRegistered = await TaskManager.isTaskRegisteredAsync(BLE_RELAY_TASK);
  if (!isRegistered) {
    await Location.startLocationUpdatesAsync(BLE_RELAY_TASK, {
      accuracy: Location.Accuracy.Balanced,
      timeInterval: 60000,
      distanceInterval: 50,
      foregroundService: {
        notificationTitle: "Lost & Found Multi-Network Active",
        notificationBody: "Contributing to the global tracking network",
        notificationColor: "#0d9488",
      },
    });
  }
};

/** Stop background BLE scanning */
export const stopBLEScanning = async () => {
  const isRegistered = await TaskManager.isTaskRegisteredAsync(BLE_RELAY_TASK);
  if (isRegistered) {
    await Location.stopLocationUpdatesAsync(BLE_RELAY_TASK);
  }
  bleManager.stopDeviceScan();
};

/**
 * Perform a one-time BLE scan burst for nearby beacons.
 * Requests Bluetooth permissions first, then scans for durationMs.
 */
export const scanForNearbyBeacons = async (
  callback: (device: { name: string; rssi: number }) => void,
  durationMs: number = 8000
): Promise<{ permissionDenied?: boolean }> => {
  // 1. Request Bluetooth permissions (required on Android 12+)
  const btGranted = await requestBluetoothPermissions();
  if (!btGranted) {
    console.warn('Bluetooth permissions denied — cannot scan');
    return { permissionDenied: true };
  }

  return new Promise((resolve) => {
    try {
      bleManager.startDeviceScan(null, { allowDuplicates: false }, (error, device) => {
        if (error) {
          console.warn('BLE scan error:', error.message);
          bleManager.stopDeviceScan();
          resolve({});
          return;
        }
        const pName = device?.name || device?.localName;
        if (pName && pName.startsWith('LF-BLE-') && device?.rssi) {
          callback({ name: pName, rssi: device.rssi });
        }
      });
    } catch (e) {
      console.warn('startDeviceScan threw:', e);
      resolve({});
      return;
    }

    setTimeout(() => {
      bleManager.stopDeviceScan();
      resolve({});
    }, durationMs);
  });
};

// ─── Background Task Definition ──────────────────────────────────────────────

TaskManager.defineTask(BLE_RELAY_TASK, async ({ data, error }) => {
  if (error) {
    console.error(error);
    return;
  }
  if (data) {
    const { locations } = data as any;
    const loc = locations[0];
    
    // Background BLE scan burst — scan for 5 seconds
    bleManager.startDeviceScan(null, { allowDuplicates: false }, async (error, device) => {
      if (error) return;
      
      const pName = device?.name || device?.localName;
      if (pName && pName.startsWith('LF-BLE-')) {
        bleManager.stopDeviceScan();
        try {
          const edgeUrl = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/ble-location-relay`;
          await fetch(edgeUrl, {
             method: 'POST',
             headers: {
               'Content-Type': 'application/json',
               'Authorization': `Bearer ${process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY}`
             },
             body: JSON.stringify({
               beacon_id: pName,
               lat: loc.coords.latitude,
               lng: loc.coords.longitude,
               accuracy_metres: loc.coords.accuracy,
               relay_app_version: '2.0.0',
               source: 'app_relay',  // Explicitly tag as app relay
             })
          });
        } catch(e) { console.warn(e); }
      }
    });

    setTimeout(() => {
      bleManager.stopDeviceScan();
    }, 5000);
  }
});

