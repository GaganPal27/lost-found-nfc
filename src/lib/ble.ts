import { BleManager } from 'react-native-ble-plx';
import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';

export const BLE_RELAY_TASK = 'BLE_RELAY_BACKGROUND_TASK';
export const bleManager = new BleManager();

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
        notificationTitle: "Lost & Found Network Active",
        notificationBody: "Protecting your items in the background",
        notificationColor: "#0d9488",
      },
    });
  }
};

export const stopBLEScanning = async () => {
  const isRegistered = await TaskManager.isTaskRegisteredAsync(BLE_RELAY_TASK);
  if (isRegistered) {
    await Location.stopLocationUpdatesAsync(BLE_RELAY_TASK);
  }
  bleManager.stopDeviceScan();
};

TaskManager.defineTask(BLE_RELAY_TASK, async ({ data, error }) => {
  if (error) {
    console.error(error);
    return;
  }
  if (data) {
    const { locations } = data as any;
    const loc = locations[0];
    
    // Background BLE scan burst
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
               relay_app_version: '1.0.0'
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
