import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuth } from '../src/store/auth';
import { Loading } from '../src/components/ui';
import { colors } from '../src/theme';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
});

export default function RootLayout() {
  const { ready, bootstrap } = useAuth();

  useEffect(() => { bootstrap(); }, [bootstrap]);

  if (!ready) return <Loading />;

  return (
    <QueryClientProvider client={queryClient}>
      {/* every screen now opens on the dark brand gradient */}
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerTintColor: '#fff',
          headerBackTitle: 'Back',
          headerStyle: { backgroundColor: colors.navy },
          headerTitleStyle: { fontWeight: '700' },
          headerShadowVisible: false,
          contentStyle: { backgroundColor: colors.bg },
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="listing/[id]" options={{ title: 'Trial / Event' }} />
        <Stack.Screen name="job/[id]" options={{ title: 'Job' }} />
        <Stack.Screen name="profile/[type]/[id]" options={{ title: 'Profile' }} />
        <Stack.Screen name="org/applicants" options={{ title: 'Applicants' }} />
      </Stack>
    </QueryClientProvider>
  );
}
