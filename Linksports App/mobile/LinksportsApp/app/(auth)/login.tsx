import { useRef, useState } from 'react';
import { Alert, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Path } from 'react-native-svg';
import { Button } from '../../src/components/ui';
import { AUTH_BYPASS } from '../../src/store/auth';
import { colors, radius, shadow } from '../../src/theme';

// UI only for now: the backend has no phone-OTP endpoint yet and Google sign-in in the app
// needs its own OAuth client, so both actions stop at a "coming soon" notice.
const comingSoon = (what: string) =>
  Alert.alert(`${what} is coming soon`, 'Sign-in will be connected in a future update.');

export default function Login() {
  const router = useRouter();
  const [phone, setPhone] = useState('');
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [otp, setOtp] = useState('');

  const digits = phone.replace(/\D/g, '');
  const pretty = digits.length > 5 ? `${digits.slice(0, 5)} ${digits.slice(5)}` : digits;

  const sendOtp = () => {
    if (!/^[6-9]\d{9}$/.test(digits)) return Alert.alert('Enter a valid number', 'Use your 10-digit Indian mobile number.');
    setStep('otp');
  };

  return (
    <LinearGradient colors={['#eff6ff', '#e0e7ff']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ flex: 1 }}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 20 }} keyboardShouldPersistTaps="handled">
          {AUTH_BYPASS && (
            <Pressable onPress={() => router.back()} hitSlop={12} style={{ position: 'absolute', top: 52, left: 20, flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons name="close" size={22} color={colors.muted} />
              <Text style={{ color: colors.muted, marginLeft: 4, fontWeight: '600' }}>Close preview</Text>
            </Pressable>
          )}

          {/* Logo */}
          <View style={{ alignItems: 'center', marginBottom: 28 }}>
            <View style={[{ backgroundColor: '#fff', borderRadius: radius.md, overflow: 'hidden' }, shadow(1)]}>
              <Image source={require('../../assets/logo.png')} style={{ width: 72, height: 72 }} resizeMode="cover" />
            </View>
            <Text style={{ color: colors.muted, marginTop: 10, fontSize: 14 }}>India's Sports Networking Platform</Text>
          </View>

          <View style={[{ backgroundColor: '#fff', borderRadius: radius.lg, padding: 24 }, shadow(2)]}>
            {step === 'phone' ? (
              <>
                <Text style={{ fontSize: 24, fontWeight: '800', color: colors.text }}>Welcome back</Text>
                <Text style={{ color: colors.muted, marginTop: 4, marginBottom: 22 }}>Sign in with your phone or Google account.</Text>

                <Pressable onPress={() => comingSoon('Google sign-in')}
                  style={({ pressed }) => ({
                    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#d1d5db',
                    borderRadius: radius.sm, paddingVertical: 13, backgroundColor: pressed ? '#f9fafb' : '#fff',
                  })}>
                  <GoogleIcon />
                  <Text style={{ marginLeft: 10, fontWeight: '600', color: '#374151', fontSize: 15 }}>Continue with Google</Text>
                </Pressable>

                <View style={{ flexDirection: 'row', alignItems: 'center', marginVertical: 22 }}>
                  <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
                  <Text style={{ marginHorizontal: 10, color: colors.subtle, fontSize: 12 }}>or sign in with phone</Text>
                  <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
                </View>

                <Text style={{ fontSize: 13, fontWeight: '600', color: colors.text, marginBottom: 6 }}>Phone number</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.sm, paddingHorizontal: 14, marginBottom: 16 }}>
                  <Text style={{ color: colors.muted, fontSize: 16, marginRight: 8 }}>+91</Text>
                  <TextInput
                    value={pretty} onChangeText={(v) => setPhone(v.replace(/\D/g, '').slice(0, 10))}
                    placeholder="98765 43210" placeholderTextColor={colors.subtle} keyboardType="phone-pad" maxLength={11}
                    style={{ flex: 1, paddingVertical: 13, fontSize: 16, color: colors.text, letterSpacing: 0.5 }}
                  />
                </View>

                <Button title="Send OTP" icon="call-outline" onPress={sendOtp} />

                <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: 22 }}>
                  <Text style={{ color: colors.muted }}>New to LinkSports? </Text>
                  <Link href="/(auth)/register" style={{ color: colors.primary, fontWeight: '700' }}>Join free</Link>
                </View>
              </>
            ) : (
              <OtpStep phone={pretty} otp={otp} setOtp={setOtp} onBack={() => { setStep('phone'); setOtp(''); }} />
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

function OtpStep({ phone, otp, setOtp, onBack }: { phone: string; otp: string; setOtp: (v: string) => void; onBack: () => void }) {
  const input = useRef<TextInput>(null);
  return (
    <>
      <Pressable onPress={onBack} hitSlop={10} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14 }}>
        <Ionicons name="arrow-back" size={18} color={colors.primary} />
        <Text style={{ color: colors.primary, fontWeight: '600', marginLeft: 4 }}>Change number</Text>
      </Pressable>
      <Text style={{ fontSize: 24, fontWeight: '800', color: colors.text }}>Enter OTP</Text>
      <Text style={{ color: colors.muted, marginTop: 4, marginBottom: 22 }}>We sent a 6-digit code to +91 {phone}</Text>

      {/* one hidden input drives six display boxes */}
      <Pressable onPress={() => input.current?.focus()} style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 }}>
        {Array.from({ length: 6 }).map((_, i) => {
          const active = i === otp.length;
          return (
            <View key={i} style={{
              width: 44, height: 52, borderRadius: radius.sm, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center',
              borderColor: active ? colors.primary : otp[i] ? '#94a3b8' : colors.border, backgroundColor: active ? '#f8faff' : '#fff',
            }}>
              <Text style={{ fontSize: 22, fontWeight: '700', color: colors.text }}>{otp[i] || ''}</Text>
            </View>
          );
        })}
      </Pressable>
      <TextInput ref={input} value={otp} onChangeText={(v) => setOtp(v.replace(/\D/g, '').slice(0, 6))}
        keyboardType="number-pad" maxLength={6} autoFocus textContentType="oneTimeCode" autoComplete="sms-otp"
        style={{ position: 'absolute', opacity: 0, height: 1, width: 1 }} />

      <Button title="Verify & sign in" icon="shield-checkmark-outline" disabled={otp.length < 6} onPress={() => comingSoon('Phone sign-in')} />
      <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: 18 }}>
        <Text style={{ color: colors.muted }}>Didn't get it? </Text>
        <Text onPress={() => comingSoon('Resend OTP')} style={{ color: colors.primary, fontWeight: '700' }}>Resend OTP</Text>
      </View>
    </>
  );
}

function GoogleIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24">
      <Path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <Path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <Path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <Path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </Svg>
  );
}
