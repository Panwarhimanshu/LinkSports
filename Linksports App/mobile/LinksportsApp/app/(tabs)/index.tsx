import { useState } from 'react';
import { ActivityIndicator, FlatList, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  Badge, Card, Chip, EmptyState, ErrorState, Hero, IconText, Loading, SearchBar, dateParts, fmtDate, titleCase,
} from '../../src/components/ui';
import { usePaged } from '../../src/lib/usePaged';
import { errorMessage } from '../../src/lib/api';
import { colors, radius, typeColor } from '../../src/theme';

const TYPES = ['', 'trial', 'event', 'tournament', 'admission', 'training_camp'];

export default function Listings() {
  const router = useRouter();
  const [type, setType] = useState('');
  const [q, setQ] = useState('');
  const [free, setFree] = useState(false);
  const { items, isLoading, error, refetch, isRefetching, fetchNextPage, hasNextPage, isFetchingNextPage } =
    usePaged<any>(['listings'], '/listings', { type, q: q.trim(), free: free ? 'true' : '' });

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Hero overline="LINKSPORTS" title="Find your next trial" subtitle="Trials, tournaments & camps across India">
        <SearchBar value={q} onChangeText={setQ} placeholder="Search trials, sports, cities…" />
      </Hero>

      <View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 14 }}>
          {TYPES.map((t) => (
            <Chip key={t || 'all'} label={t ? titleCase(t) : 'All'} active={type === t} onPress={() => setType(t)} />
          ))}
          <Chip label="Free" icon="pricetag-outline" active={free} onPress={() => setFree(!free)} />
        </ScrollView>
      </View>

      {isLoading ? <Loading /> : error ? (
        <ErrorState message={errorMessage(error)} onRetry={refetch} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(i) => i._id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
          refreshing={isRefetching}
          onRefresh={refetch}
          onEndReached={() => hasNextPage && fetchNextPage()}
          onEndReachedThreshold={0.4}
          ListHeaderComponent={items.length ? (
            <Text style={{ color: colors.muted, fontWeight: '600', marginBottom: 10 }}>
              {items.length} {items.length === 1 ? 'opportunity' : 'opportunities'}
            </Text>
          ) : null}
          ListEmptyComponent={<EmptyState icon="trophy-outline" title="No trials found" text="Try another sport, city or filter." />}
          ListFooterComponent={isFetchingNextPage ? <ActivityIndicator color={colors.primary} /> : null}
          renderItem={({ item }) => <ListingCard item={item} onPress={() => router.push(`/listing/${item._id}`)} />}
        />
      )}
    </View>
  );
}

function ListingCard({ item, onPress }: { item: any; onPress: () => void }) {
  const accent = typeColor(item.type);
  const date = dateParts(item.startDate);
  const place = item.location?.isOnline ? 'Online' : [item.location?.city, item.location?.state].filter(Boolean).join(', ') || 'Online';
  const deadline = item.registrationDeadline ? new Date(item.registrationDeadline) : null;
  const daysLeft = deadline ? Math.ceil((deadline.getTime() - Date.now()) / 86_400_000) : null;

  return (
    <Card onPress={onPress} style={{ padding: 0, overflow: 'hidden' }}>
      <View style={{ height: 4, backgroundColor: accent }} />
      <View style={{ flexDirection: 'row', padding: 14 }}>
        <View style={{
          width: 56, borderRadius: radius.md, backgroundColor: `${accent}12`, alignItems: 'center', justifyContent: 'center',
          paddingVertical: 8, marginRight: 14, alignSelf: 'flex-start',
        }}>
          <Text style={{ fontSize: 22, fontWeight: '800', color: accent }}>{date?.day ?? '—'}</Text>
          <Text style={{ fontSize: 11, fontWeight: '800', color: accent, letterSpacing: 0.5 }}>{date?.month ?? ''}</Text>
        </View>

        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Badge label={titleCase(item.type).toUpperCase()} color={accent} />
            {item.participantFee ? (
              <Text style={{ fontWeight: '800', color: colors.text }}>₹{item.participantFee}</Text>
            ) : (
              <Badge label="FREE" color={colors.success} />
            )}
          </View>
          <Text style={{ fontSize: 17, fontWeight: '800', color: colors.text, marginTop: 8 }} numberOfLines={2}>{item.title}</Text>
          {item.organizationId?.name ? (
            <IconText icon="shield-checkmark-outline" text={item.organizationId.name} color={colors.primary} style={{ fontWeight: '600' }} />
          ) : null}
          <IconText icon="location-outline" text={place} />
          {(item.sports || []).length ? <IconText icon="football-outline" text={(item.sports || []).join(' · ')} /> : null}
        </View>
      </View>

      {daysLeft !== null && daysLeft >= 0 ? (
        <View style={{
          flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10,
          borderTopWidth: 1, borderColor: colors.border, backgroundColor: daysLeft <= 3 ? colors.accentSoft : '#fafbfd',
        }}>
          <Ionicons name="time-outline" size={14} color={daysLeft <= 3 ? colors.accent : colors.muted} />
          <Text style={{ marginLeft: 6, fontSize: 12, fontWeight: '700', color: daysLeft <= 3 ? colors.accent : colors.muted }}>
            {daysLeft === 0 ? 'Registration closes today' : `Register by ${fmtDate(item.registrationDeadline)} · ${daysLeft}d left`}
          </Text>
          <Ionicons name="chevron-forward" size={16} color={colors.subtle} style={{ marginLeft: 'auto' }} />
        </View>
      ) : null}
    </Card>
  );
}
