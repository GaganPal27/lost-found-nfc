import * as Location from 'expo-location';
import { supabase } from './supabase';

// Track last update time to avoid hammering GPS on every foreground event
let lastLocationUpdate = 0;
const LOCATION_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Updates the user's last_lat and last_lng in the database.
 * Throttled to once every 5 minutes to avoid blocking the UI.
 * Returns true if updated, false if skipped or error.
 */
export const updateUserLocation = async (userId: string): Promise<boolean> => {
  const now = Date.now();
  if (now - lastLocationUpdate < LOCATION_COOLDOWN_MS) {
    return false; // Skip — updated recently
  }

  try {
    // Check permission without prompting (avoids blocking UI)
    const { status } = await Location.getForegroundPermissionsAsync();
    
    if (status !== 'granted') {
      // Only prompt once if never asked before
      const { status: newStatus } = await Location.requestForegroundPermissionsAsync();
      if (newStatus !== 'granted') return false;
    }

    lastLocationUpdate = now;

    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Low, // Low accuracy is fine for radius matching
    });

    const { error } = await supabase
      .from('users')
      .update({
        last_lat: location.coords.latitude,
        last_lng: location.coords.longitude,
        location_updated_at: new Date().toISOString(),
      })
      .eq('auth_id', userId); // Use auth_id not id

    if (error) {
      console.warn('Error updating user location:', error.message);
      return false;
    }

    return true;
  } catch (err) {
    // Fail silently — location errors should never crash the app
    console.warn('Location update skipped:', err);
    return false;
  }
};
