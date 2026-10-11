import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Button, Chip, Field } from '../../src/components/ui';
import { api, errorMessage } from '../../src/lib/api';
import { colors } from '../../src/theme';

const ROLES = [
  { id: 'athlete', label: 'Athlete' },
  { id: 'coach', label: 'Coach' },
  { id: 'organization', label: 'Organization' },
] as const;

export default function Register() {
  const router = useRouter();
  const [role, setRole] = useState<'athlete' | 'coach' | 'organization'>('athlete');
  const [fullName, setFullName] = useState('');
  const [organizationName, setOrganizationName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const isOrg = role === 'organization';

  const submit = async () => {
    const name = isOrg ? organizationName : fullName;
    if (!name.trim() || !email.trim() || password.length < 8) {
      return Alert.alert('Missing details', 'Enter your name, email and a password of at least 8 characters.');
    }
    setLoading(true);
    try {
      await api.post('/auth/register', {
        role,
        email: email.trim().toLowerCase(),
        password,
        phone: phone.trim() || undefined,
        ...(isOrg ? { organizationName: organizationName.trim() } : { fullName: fullName.trim() }),
      });
      router.replace({ pathname: '/(auth)/verify', params: { email: email.trim().toLowerCase() } });
    } catch (e) {
      Alert.alert('Registration failed', errorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ padding: 24, paddingTop: 70 }} keyboardShouldPersistTaps="handled">
        <Text style={{ fontSize: 26, fontWeight: '800', color: colors.primaryDark, marginBottom: 20 }}>Create account</Text>
        <Text style={{ fontWeight: '600', marginBottom: 8 }}>I am a</Text>
        <View style={{ flexDirection: 'row', marginBottom: 18 }}>
          {ROLES.map((r) => (
            <Chip key={r.id} label={r.label} active={role === r.id} onPress={() => setRole(r.id)} />
          ))}
        </View>
        {isOrg ? (
          <Field label="Organization name" value={organizationName} onChangeText={setOrganizationName} />
        ) : (
          <Field label="Full name" value={fullName} onChangeText={setFullName} />
        )}
        <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
        <Field label="Phone (optional)" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
        <Field label="Password (min 8 characters)" value={password} onChangeText={setPassword} secureTextEntry />
        <Button title="Sign up" onPress={submit} loading={loading} />
        <Button title="I already have an account" onPress={() => router.replace('/(auth)/login')} variant="outline" style={{ marginTop: 12 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
