export const PLAN_LIMITS = {
  basic: {
    maxItems: 5,
    scanHistoryDays: 7,
    bleTracking: false,
    trackingNetworks: [] as string[],
    tagTypes: ['nfc_only'] as const,
    price: 'Free',
    oneLiner: 'Tap to track — perfect for getting started',
    badges: ['5 items', 'Tap-only', '7-day history'],
    tagBuyingGuide: "Search 'NTAG213 NFC sticker' on Flipkart — ₹649 for 10 tags",
  },
  pro: {
    maxItems: 15,
    scanHistoryDays: 30,
    bleTracking: true,
    trackingNetworks: ['fmdn', 'app_relay'] as string[],
    tagTypes: ['ble_only'] as const,
    price: '₹99/month',
    oneLiner: 'Passive tracking via 3B+ Android devices — no app needed on finders',
    badges: ['15 items', 'Google Find My', '30-day history'],
    tagBuyingGuide: "Search 'ESP32-C3 BLE beacon' on Amazon India — ₹300/tag",
    mostPopular: true,
  },
  max: {
    maxItems: Infinity,
    scanHistoryDays: 90,
    bleTracking: true,
    trackingNetworks: ['fmdn', 'openhaystack', 'app_relay'] as string[],
    tagTypes: ['nfc_only', 'nfc_ble', 'ble_only'] as const,
    price: '₹149/month',
    oneLiner: 'Full AirTag-style protection — tracked by 4.8B phones worldwide',
    badges: ['Unlimited', 'All Networks', '90-day history'],
    tagBuyingGuide: "Search 'ESP32-C3 + NTAG213 combo' on Amazon India — ₹400/tag",
  },
} as const;

/** Network display metadata */
export const NETWORK_INFO = {
  fmdn: {
    name: 'Google Find My Device',
    shortName: 'Google FMDN',
    icon: '📡',
    color: '#4285f4',
    deviceCount: '~3B Android phones',
    description: 'Every Android phone with Google Play Services relays your beacon automatically. No app needed.',
  },
  openhaystack: {
    name: 'Apple Find My',
    shortName: 'Apple FM',
    icon: '🍎',
    color: '#a3aaae',
    deviceCount: '~1.8B iPhones',
    description: 'Every iPhone relays your beacon via Apple\'s Find My network. No app needed.',
  },
  app_relay: {
    name: 'Lost & Found Network',
    shortName: 'App Relay',
    icon: '📱',
    color: '#06b6d4',
    deviceCount: 'Our app users',
    description: 'Lost & Found app users contribute to high-frequency relay updates.',
  },
} as const;

export type NetworkType = keyof typeof NETWORK_INFO;

