import { useState } from 'react';
import { Alert, ScrollView, Text } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Button, Field } from '../../src/components/ui';
import { api, errorMessage } from '../../src/lib/api';
import { colors } from '../../src/theme';

export default function Verify() {
  const router = useRouter();
  const { email } = useLocalSearchParams<{ email: string }>();
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setLoading(true);
    try {
      await api.post('/auth/verify-email', { email, otp: otp.trim() });
      Alert.alert('Email verified', 'You can now log in.');
      router.replace('/(auth)/login');
    } catch (e) {
      Alert.alert('Verification failed', errorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  const resend = async () => {
    try {
      await api.post('/auth/resend-otp', { email });
      Alert.alert('Code sent', 'Check your inbox for a new code.');
    } catch (e) {
      Alert.alert('Could not resend', errorMessage(e));
    }
  };

  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={{ padding: 24, paddingTop: 90 }} keyboardShouldPersistTaps="handled">
      <Text style={{ fontSize: 26, fontWeight: '800', color: colors.primaryDark }}>Verify your email</Text>
      <Text style={{ color: colors.muted, marginVertical: 12 }}>Enter the 6-digit code we sent to {email}.</Text>
      <Field label="Verification code" value={otp} onChangeText={setOtp} keyboardType="number-pad" maxLength={6} />
      <Button title="Verify" onPress={submit} loading={loading} disabled={otp.trim().length !== 6} />
      <Button title="Resend code" onPress={resend} variant="outline" style={{ marginTop: 12 }} />
    </ScrollView>
  );
}
