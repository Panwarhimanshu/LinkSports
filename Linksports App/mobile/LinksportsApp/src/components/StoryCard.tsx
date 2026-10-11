import { forwardRef, useState } from 'react';
import { Image, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import QRCode from 'react-native-qrcode-svg';
import type { StoryData } from '../lib/cv';

export const STORY_W = 1080;
export const STORY_H = 1920;

/**
 * 9:16 Instagram Story card. Laid out in 1080-wide design units and scaled by `width`,
 * so what you preview is exactly what captureRef exports at 1080×1920.
 *
 * Three regions — header, a flexible middle and a footer pinned to the bottom — so long names,
 * a club line and three two-line highlights can never push the QR code off the card.
 */
const StoryCard = forwardRef<View, { data: StoryData; width: number; onPhotoLoaded?: () => void }>(
  ({ data, width, onPhotoLoaded }, ref) => {
    const u = width / STORY_W;
    const [photoFailed, setPhotoFailed] = useState(false);
    const initials = data.fullName.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();
    const sportLine = [data.sport, data.position].filter(Boolean).join(' • ');
    const stats = data.stats.slice(0, 3);

    // shrink the showcase a little when the card is busy
    const busy = stats.length + (data.club ? 1 : 0) + (data.fullName.length > 18 ? 1 : 0);
    const photo = (busy >= 4 ? 360 : busy >= 3 ? 400 : 440) * u;
    const nameSize = (data.fullName.length > 22 ? 72 : data.fullName.length > 16 ? 84 : 100) * u;

    return (
      <View ref={ref} collapsable={false} style={{ width, height: width * (STORY_H / STORY_W), overflow: 'hidden' }}>
        <LinearGradient colors={['#0f172a', '#1e3a8a']} start={{ x: 0.1, y: 0 }} end={{ x: 0.9, y: 1 }}
          style={{ flex: 1, paddingTop: 96 * u, paddingHorizontal: 90 * u, paddingBottom: 84 * u }}>
          {/* header: real logo cropped to its wordmark band, on a white badge */}
          <View style={{ width: '100%', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View style={{ width: 330 * u, height: 104 * u, borderRadius: 18 * u, overflow: 'hidden', backgroundColor: '#fff' }}>
              <Image source={require('../../assets/logo.png')} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
            </View>
            <View style={{ borderWidth: 3 * u, borderColor: '#60a5fa', borderRadius: 999, paddingVertical: 12 * u, paddingHorizontal: 30 * u }}>
              <Text style={{ color: '#93c5fd', fontSize: 30 * u, fontWeight: '700', letterSpacing: 2 * u }}>PLAYER PROFILE</Text>
            </View>
          </View>

          {/* flexible middle, centred in the remaining space */}
          <View style={{ flex: 1, minHeight: 0, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', paddingVertical: 36 * u }}>
            <View style={{ width: photo, height: photo, borderRadius: photo / 2, padding: 10 * u, backgroundColor: '#3b82f6' }}>
              <View style={{ flex: 1, borderRadius: photo / 2, overflow: 'hidden', backgroundColor: '#1e293b', alignItems: 'center', justifyContent: 'center' }}>
                {/* initials underneath, so a photo that fails to load still leaves a finished card */}
                <Text style={{ color: '#93c5fd', fontSize: photo * 0.4, fontWeight: '800' }}>{initials}</Text>
                {data.photo && !photoFailed ? (
                  <Image
                    source={{ uri: data.photo }}
                    onError={() => setPhotoFailed(true)}
                    onLoadEnd={onPhotoLoaded}
                    style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
                    resizeMode="cover"
                  />
                ) : null}
              </View>
            </View>
            <Text numberOfLines={2} style={{ color: '#fff', marginTop: 36 * u, fontSize: nameSize, fontWeight: '800', textAlign: 'center' }}>
              {data.fullName}
            </Text>
            {!!sportLine && <Text style={{ color: '#93c5fd', marginTop: 18 * u, fontSize: 46 * u, fontWeight: '600', textAlign: 'center' }}>{sportLine}</Text>}
            {!!data.club && <Text numberOfLines={1} style={{ color: '#cbd5e1', marginTop: 10 * u, fontSize: 36 * u, textAlign: 'center' }}>{data.club}</Text>}

            {stats.length > 0 && (
              <View style={{ marginTop: 44 * u, width: '100%' }}>
                <Text style={{ color: '#60a5fa', fontSize: 28 * u, fontWeight: '700', letterSpacing: 4 * u, marginBottom: 16 * u }}>CAREER HIGHLIGHTS</Text>
                {stats.map((s, i) => (
                  <View key={i} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.09)', borderColor: 'rgba(255,255,255,0.16)', borderWidth: 2 * u, borderRadius: 26 * u, paddingVertical: 20 * u, paddingHorizontal: 30 * u, marginBottom: 16 * u }}>
                    <View style={{ width: 58 * u, height: 58 * u, borderRadius: 29 * u, backgroundColor: '#2563eb', alignItems: 'center', justifyContent: 'center', marginRight: 26 * u }}>
                      <Text style={{ color: '#fff', fontSize: 30 * u, fontWeight: '800' }}>{i + 1}</Text>
                    </View>
                    <Text numberOfLines={2} style={{ flex: 1, color: '#fff', fontSize: 36 * u, fontWeight: '600' }}>{s}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>

          {/* CTA + QR — fixed height, always fully visible */}
          <View style={{ width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flex: 1, paddingRight: 30 * u }}>
              <Text style={{ color: '#fff', fontSize: 44 * u, fontWeight: '800' }}>Create your Free Sports CV at</Text>
              <Text style={{ color: '#60a5fa', fontSize: 54 * u, fontWeight: '800', marginTop: 6 * u }}>linksports.in</Text>
              <Text style={{ color: '#94a3b8', fontSize: 26 * u, marginTop: 14 * u }}>Scan to view my live profile</Text>
            </View>
            <View style={{ backgroundColor: '#fff', padding: 20 * u, borderRadius: 26 * u }}>
              <QRCode value={data.shareUrl} size={240 * u} color="#0f172a" backgroundColor="#ffffff" />
            </View>
          </View>
        </LinearGradient>
      </View>
    );
  },
);
StoryCard.displayName = 'StoryCard';
export default StoryCard;
