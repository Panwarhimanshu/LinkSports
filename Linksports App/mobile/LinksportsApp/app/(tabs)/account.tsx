import { Alert, Linking, Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar, Badge, Button, Card, SectionTitle, titleCase } from '../../src/components/ui';
import { api } from '../../src/lib/api';
import { SITE_URL, absoluteUrl } from '../../src/lib/cv';
import { useAuth } from '../../src/store/auth';
import { colors, gradients, radius, shadow, type } from '../../src/theme';

type IconName = keyof typeof Ionicons.glyphMap;

export default function Account() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, profile, logout } = useAuth();
  const isGuest = user?._id === 'guest';
  const name = profile?.fullName || profile?.name || user?.email;
  const completion = typeof profile?.profileCompletion === 'number' ? profile.profileCompletion : null;

  const notifications = useQuery({
    queryKey: ['notifications'],
    enabled: !isGuest,
    queryFn: async () => (await api.get('/notifications')).data.data as any[],
  });
  const list = notifications.data || [];
  const isUnread = (n: any) => !n.isRead && !n.read;

  const confirmLogout = () =>
    Alert.alert('Log out', 'Do you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log out', style: 'destructive', onPress: async () => { await logout(); router.replace('/(auth)/login'); } },
    ]);

  const profileType = user?.role === 'organization' ? 'organization' : user?.role === 'coach' ? 'coach' : 'athlete';

  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={{ paddingBottom: 32 }}>
      <LinearGradient colors={gradients.hero} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={{ paddingTop: insets.top + 24, paddingBottom: 56, alignItems: 'center', borderBottomLeftRadius: radius.xl, borderBottomRightRadius: radius.xl, overflow: 'hidden' }}>
        <View style={{ position: 'absolute', width: 260, height: 260, borderRadius: 130, borderWidth: 22, borderColor: 'rgba(255,255,255,0.06)', top: -90, left: -80 }} />
        <Avatar uri={absoluteUrl(profile?.photo || profile?.logo)} name={name} size={92} ring />
        <Text style={[type.h1, { color: '#fff', marginTop: 12 }]}>{name}</Text>
        <Text style={{ color: '#c7d2fe', marginTop: 2 }}>{user?.email}</Text>
        <View style={{ flexDirection: 'row', gap: 6, marginTop: 10 }}>
          <Badge label={titleCase(user?.role).toUpperCase()} color="#fff" soft="rgba(255,255,255,0.18)" />
          {isGuest ? <Badge label="GUEST MODE" color="#fff" soft={colors.accent} /> : null}
        </View>
      </LinearGradient>

      <View style={{ paddingHorizontal: 16, marginTop: -36 }}>
        <Card style={{ ...shadow(3) }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={{ fontWeight: '800', color: colors.text }}>Profile strength</Text>
            <Text style={{ fontWeight: '800', color: colors.primary }}>{completion ?? 0}%</Text>
          </View>
          <View style={{ height: 8, borderRadius: 4, backgroundColor: colors.primarySoft, marginTop: 10, overflow: 'hidden' }}>
            <LinearGradient colors={gradients.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={{ width: `${Math.max(completion ?? 0, 4)}%`, height: 8, borderRadius: 4 }} />
          </View>
          <Text style={{ color: colors.muted, marginTop: 8, fontSize: 13 }}>
            {isGuest ? 'Build your CV to see how scouts will see you.' : 'A complete profile gets noticed by more academies.'}
          </Text>
        </Card>

        <View style={{ backgroundColor: colors.card, borderRadius: radius.lg, ...shadow(1), marginBottom: 14 }}>
          {user?.role === 'athlete' && <MenuRow icon="id-card-outline" label="My Sports CV" onPress={() => router.push('/(tabs)/cv')} />}
          {profile?._id && !isGuest ? (
            <MenuRow icon="eye-outline" label="View my public profile" onPress={() => router.push(`/profile/${profileType}/${profile._id}`)} />
          ) : null}
          <MenuRow icon="checkmark-done-circle-outline" label="My applications" onPress={() => router.push('/(tabs)/dashboard')} />
          {isGuest && <MenuRow icon="log-in-outline" label="Preview login screen" onPress={() => router.push('/(auth)/login')} />}
          <MenuRow icon="globe-outline" label="Open linksports.in" onPress={() => Linking.openURL(SITE_URL)} last />
        </View>

        <SectionTitle title="Notifications" action={list.length ? `${list.filter(isUnread).length} new` : undefined} />
        <Card>
          {isGuest ? (
            <EmptyNote icon="notifications-off-outline" text="Notifications appear here once you log in." />
          ) : notifications.isLoading ? (
            <Text style={{ color: colors.muted }}>Loading…</Text>
          ) : list.length === 0 ? (
            <EmptyNote icon="notifications-outline" text="You're all caught up." />
          ) : (
            list.slice(0, 8).map((n, i) => (
              <View key={n._id} style={{ flexDirection: 'row', paddingVertical: 10, borderTopWidth: i ? 1 : 0, borderColor: colors.border }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, marginTop: 6, marginRight: 10, backgroundColor: isUnread(n) ? colors.accent : 'transparent' }} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: isUnread(n) ? '800' : '600', color: colors.text }}>{n.title}</Text>
                  <Text style={{ color: colors.muted, marginTop: 2 }}>{n.message}</Text>
                </View>
              </View>
            ))
          )}
        </Card>

        <Text style={{ color: colors.subtle, marginVertical: 8, fontSize: 12, textAlign: 'center' }}>
          To edit profile details, add media or manage listings, use linksports.in for now.
        </Text>
        {!isGuest && <Button title="Log out" icon="log-out-outline" variant="outline" onPress={confirmLogout} style={{ marginTop: 8 }} />}
      </View>
    </ScrollView>
  );
}

function MenuRow({ icon, label, onPress, last }: { icon: IconName; label: string; onPress: () => void; last?: boolean }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({
      flexDirection: 'row', alignItems: 'center', padding: 14, borderBottomWidth: last ? 0 : 1, borderColor: colors.border,
      backgroundColor: pressed ? '#f8faff' : 'transparent', borderRadius: radius.lg,
    })}>
      <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
        <Ionicons name={icon} size={18} color={colors.primary} />
      </View>
      <Text style={{ flex: 1, fontWeight: '700', color: colors.text, fontSize: 15 }}>{label}</Text>
      <Ionicons name="chevron-forward" size={18} color={colors.subtle} />
    </Pressable>
  );
}

function EmptyNote({ icon, text }: { icon: IconName; text: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      <Ionicons name={icon} size={20} color={colors.subtle} style={{ marginRight: 10 }} />
      <Text style={{ color: colors.muted, flex: 1 }}>{text}</Text>
    </View>
  );
}
