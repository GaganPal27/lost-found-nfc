# Lost & Found NFC App

A React Native (Expo) mobile application for tracking and finding lost items using NFC tags. The app leverages RevenueCat for subscription handling and Supabase for backend services (authentication, database).

## Project Setup

### Prerequisites
- Node.js (v18 or higher)
- Expo CLI
- EAS CLI (installed globally via `npm i -g eas-cli`)
- Supabase account and project
- RevenueCat account and project

### Env Setup
Create a `.env` file in the root folder with the following keys:
```env
EXPO_PUBLIC_SUPABASE_URL=your_supabase_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
EXPO_PUBLIC_REVENUECAT_ANDROID_KEY=your_revenuecat_android_key
```

### Installation
```bash
npm install
# or
yarn install
```

### Running Locally
You can run the application with the Expo development server:
```bash
npm start
# or
yarn start
```
Use the Expo Go application or an emulator to view the application in development mode.

## Generating the Android APK

This project is configured to generate an `.apk` file upon building with the Expo Application Services (EAS).

1. Log in to your Expo account (via terminal):
```bash
npx eas login
```

2. Trigger the cloud build using the `preview` profile:
```bash
npx eas build -p android --profile preview
```

3. Once the build finishes, EAS will provide a link to download the generated `app-preview.apk`. You can directly install this file on an Android device to test NFC features.

## Tech Stack
- **Framework:** React Native / Expo (Router)
- **Styling:** NativeWind (Tailwind CSS)
- **State Management:** Zustand
- **Backend/DB:** Supabase
- **In-app Subscriptions:** RevenueCat
- **Hardware Integration:** `react-native-nfc-manager`
