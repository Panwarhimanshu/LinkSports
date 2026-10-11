import { forwardRef } from 'react';
import { Image, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import QRCode from 'react-native-qrcode-svg';
import type { StoryData } from '../lib/cv';

export const STORY_W = 1080;
export const STORY_H = 1920;

/**
 * 9:16 Instagram Story card. Laid out in 1080-wide design units and scaled by `width`,
 * so what you preview is exactly what captureRef exports at 1080×1920.
 */
const StoryCard = forwardRef<View, { data: StoryData; width: number; onPhotoLoaded?: () => void }>(
  ({ data, width, onPhotoLoaded }, ref) => {
    const u = width / STORY_W;
    const initials = data.fullName.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();
    const sportLine = [data.sport, data.position].filter(Boolean).join(' • ');

    return (
      <View ref={ref} collapsable={false} style={{ width, height: width * (STORY_H / STORY_W), overflow: 'hidden' }}>
        <LinearGradient colors={['#0f172a', '#1e3a8a']} start={{ x: 0.1, y: 0 }} end={{ x: 0.9, y: 1 }}
          style={{ flex: 1, paddingTop: 110 * u, paddingHorizontal: 90 * u, paddingBottom: 90 * u, alignItems: 'center' }}>
          {/* header */}
          <View style={{ width: '100%', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Image source={require('../../assets/logo.png')} style={{ width: 76 * u, height: 76 * u }} resizeMode="contain" />
              <Text style={{ color: '#fff', fontSize: 44 * u, fontWeight: '800', marginLeft: 16 * u }}>LinkSports.in</Text>
            </View>
            <View style={{ borderWidth: 3 * u, borderColor: '#60a5fa', borderRadius: 999, paddingVertical: 12 * u, paddingHorizontal: 30 * u }}>
              <Text style={{ color: '#93c5fd', fontSize: 30 * u, fontWeight: '700', letterSpacing: 2 * u }}>PLAYER PROFILE</Text>
            </View>
          </View>

          {/* athlete */}
          <View style={{ marginTop: 120 * u, alignItems: 'center', width: '100%' }}>
            <View style={{ width: 460 * u, height: 460 * u, borderRadius: 230 * u, padding: 10 * u, backgroundColor: '#3b82f6' }}>
              {data.photo ? (
                <Image source={{ uri: data.photo }} onLoadEnd={onPhotoLoaded} style={{ flex: 1, borderRadius: 220 * u, backgroundColor: '#1e293b' }} />
              ) : (
                <View style={{ flex: 1, borderRadius: 220 * u, backgroundColor: '#1e293b', alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ color: '#93c5fd', fontSize: 180 * u, fontWeight: '800' }}>{initials}</Text>
                </View>
              )}
            </View>
            <Text numberOfLines={2} style={{ color: '#fff', marginTop: 60 * u, fontSize: (data.fullName.length > 20 ? 80 : 100) * u, fontWeight: '800', textAlign: 'center' }}>
              {data.fullName}
            </Text>
            {!!sportLine && <Text style={{ color: '#93c5fd', marginTop: 22 * u, fontSize: 48 * u, fontWeight: '600', textAlign: 'center' }}>{sportLine}</Text>}
            {!!data.club && <Text numberOfLines={1} style={{ color: '#cbd5e1', marginTop: 12 * u, fontSize: 38 * u, textAlign: 'center' }}>{data.club}</Text>}
          </View>

          {/* top 3 */}
          <View style={{ marginTop: 70 * u, width: '100%' }}>
            {data.stats.length > 0 && <Text style={{ color: '#60a5fa', fontSize: 28 * u, fontWeight: '700', letterSpacing: 4 * u, marginBottom: 18 * u }}>CAREER HIGHLIGHTS</Text>}
            {data.stats.map((s, i) => (
              <View key={i} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.09)', borderColor: 'rgba(255,255,255,0.16)', borderWidth: 2 * u, borderRadius: 28 * u, paddingVertical: 26 * u, paddingHorizontal: 32 * u, marginBottom: 22 * u }}>
                <View style={{ width: 60 * u, height: 60 * u, borderRadius: 30 * u, backgroundColor: '#2563eb', alignItems: 'center', justifyContent: 'center', marginRight: 26 * u }}>
                  <Text style={{ color: '#fff', fontSize: 32 * u, fontWeight: '800' }}>{i + 1}</Text>
                </View>
                <Text numberOfLines={2} style={{ flex: 1, color: '#fff', fontSize: 38 * u, fontWeight: '600' }}>{s}</Text>
              </View>
            ))}
          </View>

          {/* CTA + QR */}
          <View style={{ marginTop: 'auto', width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flex: 1, paddingRight: 30 * u }}>
              <Text style={{ color: '#fff', fontSize: 44 * u, fontWeight: '800' }}>Create your Free Sports CV at</Text>
              <Text style={{ color: '#60a5fa', fontSize: 54 * u, fontWeight: '800', marginTop: 6 * u }}>linksports.in</Text>
              <Text style={{ color: '#94a3b8', fontSize: 26 * u, marginTop: 14 * u }}>Scan to view my live profile</Text>
            </View>
            <View style={{ backgroundColor: '#fff', padding: 20 * u, borderRadius: 26 * u }}>
              <QRCode value={data.shareUrl} size={250 * u} color="#0f172a" backgroundColor="#ffffff" />
            </View>
          </View>
        </LinearGradient>
      </View>
    );
  },
);
StoryCard.displayName = 'StoryCard';
export default StoryCard;
