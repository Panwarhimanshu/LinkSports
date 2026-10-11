import { ColorValue, View } from 'react-native';
import { Redirect, Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../src/store/auth';
import { colors, shadow } from '../../src/theme';

type IconName = keyof typeof Ionicons.glyphMap;

// outline icon normally, filled icon inside a soft pill when the tab is active
const icon = (name: string) =>
  ({ color, focused }: { color: ColorValue; focused: boolean }) => (
    <View style={{
      width: 46, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center',
      backgroundColor: focused ? colors.primarySoft : 'transparent',
    }}>
      <Ionicons name={(focused ? name : `${name}-outline`) as IconName} color={color as string} size={21} />
    </View>
  );

export default function TabsLayout() {
  const user = useAuth((s) => s.user);
  const insets = useSafeAreaInsets();
  if (!user) return <Redirect href="/(auth)/login" />;
  const isOrg = user.role === 'organization';
  const isAthlete = user.role === 'athlete';

  return (
    <Tabs
      initialRouteName={isAthlete ? 'cv' : 'index'}
      screenOptions={{
        headerShown: false, // every tab screen draws its own gradient Hero
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.subtle,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '700', marginTop: 2 },
        tabBarStyle: {
          height: 64 + insets.bottom, paddingTop: 8, paddingBottom: insets.bottom + 6,
          borderTopWidth: 0, backgroundColor: '#fff', ...shadow(3),
        },
      }}
    >
      {/* Player CV creator: the app's home for athletes, hidden for other roles */}
      <Tabs.Screen name="cv" options={{ title: 'My CV', href: isAthlete ? undefined : null, tabBarIcon: icon('id-card') }} />
      <Tabs.Screen name="index" options={{ title: 'Trials', tabBarIcon: icon('trophy') }} />
      <Tabs.Screen name="jobs" options={{ title: 'Jobs', tabBarIcon: icon('briefcase') }} />
      <Tabs.Screen name="search" options={{ title: 'Discover', tabBarIcon: icon('compass') }} />
      <Tabs.Screen
        name="dashboard"
        options={{ title: isOrg ? 'Dashboard' : 'Applied', tabBarIcon: icon(isOrg ? 'grid' : 'checkmark-done-circle') }}
      />
      <Tabs.Screen name="account" options={{ title: 'Me', tabBarIcon: icon('person-circle') }} />
    </Tabs>
  );
}
