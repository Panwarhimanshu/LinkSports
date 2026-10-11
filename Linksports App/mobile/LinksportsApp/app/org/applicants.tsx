import { Alert, FlatList, Text, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Card, EmptyState, ErrorState, Loading, fmtDate, titleCase } from '../../src/components/ui';
import { api, errorMessage } from '../../src/lib/api';
import { colors, statusColor } from '../../src/theme';

export default function Applicants() {
  const { kind, id, title } = useLocalSearchParams<{ kind: 'listings' | 'jobs'; id: string; title: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const isListing = kind === 'listings';

  const q = useQuery({
    queryKey: ['applicants', kind, id],
    queryFn: async () => (await api.get(`/${isListing ? 'listings' : 'jobs'}/${id}/applications`)).data.data as any[],
  });

  const setStatus = useMutation({
    mutationFn: ({ appId, status }: { appId: string; status: 'shortlisted' | 'rejected' }) =>
      api.patch(isListing ? `/listings/applications/${appId}/status` : `/jobs/${id}/applications/${appId}/status`, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['applicants', kind, id] }),
    onError: (e) => Alert.alert('Update failed', errorMessage(e)),
  });

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Stack.Screen options={{ title: title || 'Applicants' }} />
      {q.isLoading ? <Loading /> : q.error ? (
        <ErrorState message={errorMessage(q.error)} onRetry={q.refetch} />
      ) : (
        <FlatList
          data={q.data || []}
          keyExtractor={(a) => a._id}
          contentContainerStyle={{ padding: 12 }}
          refreshing={q.isRefetching}
          onRefresh={q.refetch}
          ListEmptyComponent={<EmptyState text="No applicants yet." />}
          renderItem={({ item }) => {
            const user = item.applicantId || {};
            const profile = item.profile;
            const name = profile?.fullName || user.email || 'Applicant';
            const role = user.role || item.applicantProfileType;
            return (
              <Card>
                <Text
                  style={{ fontWeight: '700', fontSize: 16 }}
                  onPress={() => profile?._id && role !== 'professional' && router.push(`/profile/${role}/${profile._id}`)}
                >
                  {name}
                </Text>
                <Text style={{ color: colors.muted }}>
                  {[titleCase(role), profile?.primarySport, profile?.location?.city].filter(Boolean).join(' · ')}
                </Text>
                <Text style={{ color: colors.muted, fontSize: 12, marginTop: 2 }}>Applied {fmtDate(item.appliedAt || item.createdAt)}</Text>
                <Text style={{ marginTop: 6, fontWeight: '600', color: statusColor(item.status) }}>{titleCase(item.status)}</Text>
                {item.status === 'applied' && (
                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
                    <Button title="Shortlist" style={{ flex: 1, paddingVertical: 10 }} onPress={() => setStatus.mutate({ appId: item._id, status: 'shortlisted' })} />
                    <Button title="Reject" variant="danger" style={{ flex: 1, paddingVertical: 10 }} onPress={() => setStatus.mutate({ appId: item._id, status: 'rejected' })} />
                  </View>
                )}
              </Card>
            );
          }}
        />
      )}
    </View>
  );
}
