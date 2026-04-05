import { useEffect } from 'react';
import { useRouter } from 'expo-router';

// This is just a redirect shim — the real navigation
// is handled by the auth guard in _layout.tsx.
// Authenticated users go to /(tabs)/my-items automatically.
export default function IndexScreen() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/(tabs)/my-items');
  }, []);
  return null;
}
