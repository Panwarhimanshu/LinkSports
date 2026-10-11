import { useState } from 'react';
import { ActivityIndicator, FlatList, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Avatar, Badge, Card, Chip, EmptyState, ErrorState, Hero, IconText, Loading, SearchBar, titleCase } from '../../src/components/ui';
import { usePaged } from '../../src/lib/usePaged';
import { errorMessage } from '../../src/lib/api';
import { colors } from '../../src/theme';

const CATEGORIES = ['', 'coach', 'pe_teacher', 'fitness_trainer', 'sports_physio', 'nutritionist', 'manager', 'admin', 'other'];

const salary = (min?: number, max?: number) => {
  const k = (n: number) => (n >= 1000 ? `${Math.round(n / 1000)}k` : String(n));
  if (min && max) return `₹${k(min)} – ₹${k(max)}`;
  if (min) return `From ₹${k(min)}`;
  if (max) return `Up to ₹${k(max)}`;
  return '';
};

export default function Jobs() {
  const router = useRouter();
  const [category, setCategory] = useState('');
  const [location, setLocation] = useState('');
  const { items, isLoading, error, refetch, isRefetching, fetchNextPage, hasNextPage, isFetchingNextPage } =
    usePaged<any>(['jobs'], '/jobs', { category, location: location.trim() });

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Hero overline="CAREERS IN SPORT" title="Sports jobs" subtitle="Coaching, fitness, physio & more">
        <SearchBar value={location} onChangeText={setLocation} placeholder="Filter by city or state" />
      </Hero>

      <View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 14 }}>
          {CATEGORIES.map((c) => (
            <Chip key={c || 'all'} label={c ? titleCase(c) : 'All roles'} active={category === c} onPress={() => setCategory(c)} />
          ))}
        </ScrollView>
      </View>

      {isLoading ? <Loading /> : error ? (
        <ErrorState message={errorMessage(error)} onRetry={refetch} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(i) => i._id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24, flexGrow: 1 }}
          refreshing={isRefetching}
          onRefresh={refetch}
          onEndReached={() => hasNextPage && fetchNextPage()}
          onEndReachedThreshold={0.4}
          ListEmptyComponent={
            <EmptyState icon="briefcase-outline" title="No jobs right now"
              text="New openings from academies and clubs show up here. Pull down to refresh." />
          }
          ListFooterComponent={isFetchingNextPage ? <ActivityIndicator color={colors.primary} /> : null}
          renderItem={({ item }) => {
            const pay = salary(item.salaryMin, item.salaryMax);
            return (
              <Card onPress={() => router.push(`/job/${item._id}`)}>
                <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                  <Avatar uri={item.organizationId?.logo} name={item.organizationId?.name || item.title} size={46} />
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={{ fontSize: 16, fontWeight: '800', color: colors.text }} numberOfLines={2}>{item.title}</Text>
                    {item.organizationId?.name ? <Text style={{ color: colors.muted, marginTop: 2 }}>{item.organizationId.name}</Text> : null}
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.subtle} />
                </View>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12 }}>
                  {item.category ? <Badge label={titleCase(item.category)} /> : null}
                  {item.jobType ? <Badge label={titleCase(item.jobType)} color={colors.muted} /> : null}
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
                  {item.location ? <IconText icon="location-outline" text={item.location} /> : <View />}
                  {pay ? <Text style={{ fontWeight: '800', color: colors.success, marginTop: 4 }}>{pay}</Text> : null}
                </View>
              </Card>
            );
          }}
        />
      )}
    </View>
  );
}
