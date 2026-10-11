import { Redirect } from 'expo-router';
import { useAuth } from '../src/store/auth';

export default function Index() {
  const user = useAuth((s) => s.user);
  return <Redirect href={user ? (user.role === 'athlete' ? '/(tabs)/cv' : '/(tabs)') : '/(auth)/login'} />;
}
