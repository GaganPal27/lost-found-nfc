import { Redirect } from 'expo-router';

// This is a redirect shim.
// Unauthenticated users will be caught by the auth guard in _layout.tsx 
// and sent to /login. Authenticated users will land on the community feed.
export default function IndexScreen() {
  return <Redirect href="/(tabs)/community" />;
}
