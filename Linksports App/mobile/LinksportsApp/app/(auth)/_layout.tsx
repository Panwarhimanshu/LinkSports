import { Redirect, Stack } from 'expo-router';
import { AUTH_BYPASS, useAuth } from '../../src/store/auth';

export default function AuthLayout() {
  const user = useAuth((s) => s.user);
  // while login is bypassed the guest can still open these screens to preview them
  if (user && !AUTH_BYPASS) return <Redirect href="/(tabs)" />;
  return <Stack screenOptions={{ headerShown: false }} />;
}
