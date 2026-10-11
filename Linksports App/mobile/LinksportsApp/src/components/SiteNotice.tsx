import { useEffect, useState } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { api } from '../lib/api';
import { radius, shadow } from '../theme';

type PublicSettings = {
  banner: { text: string; link?: string; tone: 'info' | 'success' | 'warning' } | null;
  maintenance: { message: string } | null;
};

const TONE = { info: '#1d4ed8', success: '#16a34a', warning: '#d97706' } as const;

/**
 * Banner / maintenance notice set in the web admin (Site & App Settings), shown as a
 * dismissible card floating just above the tab bar.
 */
export default function SiteNotice({ bottom }: { bottom: number }) {
  const router = useRouter();
  const [s, setS] = useState<PublicSettings | null>(null);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    api.get('/settings').then((r) => setS(r.data.data)).catch(() => undefined);
  }, []);

  if (!s || hidden || (!s.banner && !s.maintenance)) return null;
  const isMaintenance = !!s.maintenance;
  const text = s.maintenance?.message || s.banner!.text;
  const color = isMaintenance ? TONE.warning : TONE[s.banner!.tone] || TONE.info;
  const link = !isMaintenance ? s.banner?.link : undefined;

  const open = () => {
    if (!link) return;
    if (/^https?:\/\//.test(link)) Linking.openURL(link);
    else if (link.startsWith('/listings')) router.push('/(tabs)');
    else if (link.startsWith('/jobs')) router.push('/(tabs)/jobs');
  };

  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', left: 12, right: 12, bottom }}>
      <Pressable onPress={open} style={[{ flexDirection: 'row', alignItems: 'center', backgroundColor: color, borderRadius: radius.md, paddingVertical: 10, paddingLeft: 14, paddingRight: 6 }, shadow(3)]}>
        <Ionicons name={isMaintenance ? 'construct-outline' : 'megaphone-outline'} size={18} color="#fff" style={{ marginRight: 10 }} />
        <Text style={{ flex: 1, color: '#fff', fontWeight: '600', fontSize: 13, lineHeight: 18 }} numberOfLines={3}>{text}</Text>
        <Pressable onPress={() => setHidden(true)} hitSlop={10} accessibilityLabel="Dismiss" style={{ padding: 6 }}>
          <Ionicons name="close" size={18} color="#fff" />
        </Pressable>
      </Pressable>
    </View>
  );
}
