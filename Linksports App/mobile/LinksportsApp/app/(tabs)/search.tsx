import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Avatar, Badge, Card, Chip, EmptyState, ErrorState, Hero, IconText, Loading, SearchBar, titleCase } from '../../src/components/ui';
import { usePaged } from '../../src/lib/usePaged';
import { errorMessage } from '../../src/lib/api';
import { absoluteUrl } from '../../src/lib/cv';
import { colors, radius } from '../../src/theme';

const TYPES = [
  { key: 'athlete', label: 'Athletes', icon: 'body-outline' },
  { key: 'coach', label: 'Coaches', icon: 'clipboard-outline' },
  { key: 'organization', label: 'Academies', icon: 'business-outline' },
] as const;
const GENDERS = ['', 'male', 'female'];

export default function Search() {
  const router = useRouter();
  const [type, setType] = useState<(typeof TYPES)[number]['key']>('athlete');
  const [text, setText] = useState('');
  const [q, setQ] = useState('');
  const [sport, setSport] = useState('');
  const [city, setCity] = useState('');
  const [gender, setGender] = useState('');
  const [ageMin, setAgeMin] = useState('');
  const [ageMax, setAgeMax] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  // debounce the free-text query so we don't hit the (rate-limited) API on every keystroke
  useEffect(() => {
    const t = setTimeout(() => setQ(text.trim()), 400);
    return () => clearTimeout(t);
  }, [text]);

  const isAthlete = type === 'athlete';
  const { items, isLoading, error, refetch, isRefetching, fetchNextPage, hasNextPage, isFetchingNextPage } = usePaged<any>(
    ['profiles'], '/profiles/search',
    { type, q, sport: sport.trim(), city: city.trim(), ...(isAthlete ? { gender, ageMin, ageMax } : {}) },
  );

  const activeFilters = [sport, city, ...(isAthlete ? [gender, ageMin, ageMax] : [])].filter(Boolean).length;
  const nameOf = (p: any) => p.fullName || p.name;
  const sportOf = (p: any) => p.primarySport || (p.sportsSpecialization || []).join(', ') || (p.sports || []).join(', ');
  const placeOf = (p: any) => [p.location?.city, p.location?.state].filter(Boolean).join(', ');

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Hero overline="DISCOVER" title="Find talent" subtitle="Athletes, coaches and academies">
        <View style={{ flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: radius.pill, padding: 4, marginBottom: 12 }}>
          {TYPES.map((t) => {
            const on = type === t.key;
            return (
              <Pressable key={t.key} onPress={() => setType(t.key)}
                style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 8, borderRadius: radius.pill, backgroundColor: on ? '#fff' : 'transparent' }}>
                <Ionicons name={t.icon as any} size={15} color={on ? colors.primary : '#c7d2fe'} />
                <Text style={{ marginLeft: 5, fontWeight: '700', fontSize: 13, color: on ? colors.primary : '#e0e7ff' }}>{t.label}</Text>
              </Pressable>
            );
          })}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <SearchBar value={text} onChangeText={setText} placeholder="Search by name…" style={{ flex: 1 }} />
          <Pressable onPress={() => setShowFilters(!showFilters)}
            style={{ width: 48, height: 48, borderRadius: 24, marginLeft: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: showFilters || activeFilters ? colors.accent : 'rgba(255,255,255,0.15)' }}>
            <Ionicons name="options-outline" size={20} color="#fff" />
            {activeFilters ? (
              <View style={{ position: 'absolute', top: 4, right: 4, minWidth: 16, height: 16, borderRadius: 8, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 10, fontWeight: '800', color: colors.accent }}>{activeFilters}</Text>
              </View>
            ) : null}
          </Pressable>
        </View>
      </Hero>

      {showFilters && (
        <View style={{ paddingHorizontal: 16, paddingTop: 14 }}>
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}>
            <FilterInput icon="football-outline" value={sport} onChangeText={setSport} placeholder="Sport" />
            <FilterInput icon="location-outline" value={city} onChangeText={setCity} placeholder="City" />
          </View>
          {isAthlete && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {GENDERS.map((g) => <Chip key={g || 'any'} label={g ? titleCase(g) : 'Any gender'} active={gender === g} onPress={() => setGender(g)} />)}
              <FilterInput value={ageMin} onChangeText={setAgeMin} placeholder="Min age" numeric width={92} />
              <View style={{ width: 8 }} />
              <FilterInput value={ageMax} onChangeText={setAgeMax} placeholder="Max age" numeric width={92} />
            </ScrollView>
          )}
        </View>
      )}

      {isLoading ? <Loading /> : error ? (
        <ErrorState message={errorMessage(error)} onRetry={refetch} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(i) => i._id}
          contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
          keyboardShouldPersistTaps="handled"
          refreshing={isRefetching}
          onRefresh={refetch}
          onEndReached={() => hasNextPage && fetchNextPage()}
          onEndReachedThreshold={0.4}
          ListEmptyComponent={<EmptyState icon="people-outline" title="No one found" text="Try a different name, sport or city." />}
          ListFooterComponent={isFetchingNextPage ? <ActivityIndicator color={colors.primary} /> : null}
          renderItem={({ item }) => (
            <Card onPress={() => router.push(`/profile/${type}/${item._id}`)} style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Avatar uri={absoluteUrl(item.photo || item.logo)} name={nameOf(item)} size={54} />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={{ fontWeight: '800', fontSize: 16, color: colors.text, flexShrink: 1 }} numberOfLines={1}>{nameOf(item)}</Text>
                  {item.isVerified ? <Ionicons name="checkmark-circle" size={16} color={colors.primary} style={{ marginLeft: 4 }} /> : null}
                </View>
                {sportOf(item) ? <View style={{ marginTop: 6 }}><Badge label={sportOf(item)} /></View> : null}
                {placeOf(item) ? <IconText icon="location-outline" text={placeOf(item)} /> : null}
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.subtle} />
            </Card>
          )}
        />
      )}
    </View>
  );
}

function FilterInput({ icon, value, onChangeText, placeholder, numeric, width }: {
  icon?: keyof typeof Ionicons.glyphMap; value: string; onChangeText: (v: string) => void; placeholder: string; numeric?: boolean; width?: number;
}) {
  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: radius.md, borderWidth: 1,
      borderColor: colors.border, paddingHorizontal: 12, height: 42, ...(width ? { width } : { flex: 1 }),
    }}>
      {icon ? <Ionicons name={icon} size={16} color={colors.subtle} style={{ marginRight: 6 }} /> : null}
      <TextInput value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor={colors.subtle}
        keyboardType={numeric ? 'number-pad' : 'default'} style={{ flex: 1, fontSize: 14, color: colors.text, paddingVertical: 0 }} />
    </View>
  );
}
