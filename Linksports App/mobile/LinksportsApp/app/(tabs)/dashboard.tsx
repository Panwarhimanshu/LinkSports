import { useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { Badge, Card, EmptyState, ErrorState, Hero, IconText, Loading, fmtDate, titleCase } from '../../src/components/ui';
import { api, errorMessage } from '../../src/lib/api';
import { useAuth } from '../../src/store/auth';
import { colors, radius, statusColor, statusSoft } from '../../src/theme';

type Tab = 'listings' | 'jobs';

export default function Dashboard() {
  const role = useAuth((s) => s.user?.role);
  return role === 'organization' ? <OrgDashboard /> : <MyApplications />;
}

function Segmented({ tab, setTab }: { tab: Tab; setTab: (t: Tab) => void }) {
  const opts: { key: Tab; label: string }[] = [{ key: 'listings', label: 'Trials & events' }, { key: 'jobs', label: 'Jobs' }];
  return (
    <View style={{ flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: radius.pill, padding: 4 }}>
      {opts.map((o) => {
        const on = tab === o.key;
        return (
          <Pressable key={o.key} onPress={() => setTab(o.key)}
            style={{ flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: radius.pill, backgroundColor: on ? '#fff' : 'transparent' }}>
            <Text style={{ fontWeight: '700', fontSize: 13, color: on ? colors.primary : '#e0e7ff' }}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// ── Athlete / coach: everything I've applied to ─────────────────────────────
function MyApplications() {
  const router = useRouter();
  const isGuest = useAuth((s) => s.user?._id === 'guest');
  const [tab, setTab] = useState<Tab>('listings');

  const listings = useQuery({
    queryKey: ['my-applications', 'listings'],
    enabled: !isGuest,
    queryFn: async () => (await api.get('/listings/applications/mine')).data.data as any[],
  });
  const jobs = useQuery({
    queryKey: ['my-applications', 'jobs'],
    enabled: !isGuest,
    queryFn: async () => (await api.get('/jobs/mine/applications')).data.data as any[],
  });
  const q = tab === 'listings' ? listings : jobs;
  const data = (q.data || []).filter((a) => (tab === 'listings' ? a.listingId : a.jobId));

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Hero overline="MY JOURNEY" title="Applications" subtitle="Track every trial and job you've applied to">
        <Segmented tab={tab} setTab={setTab} />
      </Hero>

      {isGuest ? (
        <EmptyState icon="lock-closed-outline" title="Log in to track applications"
          text="Once login is enabled, every trial and job you apply to will show up here with its live status." />
      ) : q.isLoading ? <Loading /> : q.error ? (
        <ErrorState message={errorMessage(q.error)} onRetry={q.refetch} />
      ) : (
        <FlatList
          data={data}
          keyExtractor={(a) => a._id}
          contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
          refreshing={q.isRefetching}
          onRefresh={q.refetch}
          ListEmptyComponent={
            <EmptyState icon="paper-plane-outline" title="Nothing yet" text="You haven't applied to anything yet."
              action={tab === 'listings' ? 'Browse trials' : 'Browse jobs'}
              onAction={() => router.push(tab === 'listings' ? '/(tabs)' : '/(tabs)/jobs')} />
          }
          renderItem={({ item }) => {
            const target = tab === 'listings' ? item.listingId : item.jobId;
            const orgName = tab === 'listings' ? item.organization?.name : target?.organizationId?.name;
            return (
              <Card onPress={() => router.push(tab === 'listings' ? `/listing/${target._id}` : `/job/${target._id}`)}
                style={{ borderLeftWidth: 4, borderLeftColor: statusColor(item.status) }}>
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                  <Text style={{ fontWeight: '800', fontSize: 16, color: colors.text, flex: 1, marginRight: 8 }} numberOfLines={2}>{target?.title}</Text>
                  <Badge label={titleCase(item.status).toUpperCase()} color={statusColor(item.status)} soft={statusSoft(item.status)} />
                </View>
                {orgName ? <IconText icon="shield-checkmark-outline" text={orgName} /> : null}
                <IconText icon="calendar-outline" text={`Applied ${fmtDate(item.appliedAt || item.createdAt)}`} />
              </Card>
            );
          }}
        />
      )}
    </View>
  );
}

// ── Organization: my listings & jobs with applicant counts ──────────────────
function OrgDashboard() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('listings');

  const q = useQuery({
    queryKey: ['org-items', tab],
    queryFn: async () => (await api.get(tab === 'listings' ? '/listings/my' : '/jobs/mine/listings')).data.data as any[],
  });

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Hero overline="ORGANIZATION" title="Dashboard" subtitle="Your listings and applicants">
        <Segmented tab={tab} setTab={setTab} />
      </Hero>
      {q.isLoading ? <Loading /> : q.error ? (
        <ErrorState message={errorMessage(q.error)} onRetry={q.refetch} />
      ) : (
        <FlatList
          data={q.data || []}
          keyExtractor={(i) => i._id}
          contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
          refreshing={q.isRefetching}
          onRefresh={q.refetch}
          ListEmptyComponent={<EmptyState icon="add-circle-outline" title="Nothing posted yet" text={`No ${tab === 'listings' ? 'trials or events' : 'jobs'} yet. Create them on linksports.in.`} />}
          renderItem={({ item }) => {
            const count = tab === 'listings' ? item.participantCount : item.applicantCount;
            return (
              <Card onPress={() => router.push({ pathname: '/org/applicants', params: { kind: tab, id: item._id, title: item.title } })}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontWeight: '800', fontSize: 16, color: colors.text }}>{item.title}</Text>
                    <View style={{ marginTop: 6 }}><Badge label={titleCase(item.status).toUpperCase()} color={colors.muted} /></View>
                  </View>
                  <View style={{ alignItems: 'center', backgroundColor: colors.primarySoft, borderRadius: radius.md, paddingVertical: 8, paddingHorizontal: 14 }}>
                    <Text style={{ fontSize: 20, fontWeight: '800', color: colors.primary }}>{count || 0}</Text>
                    <Text style={{ fontSize: 11, fontWeight: '700', color: colors.primary }}>applicant{count === 1 ? '' : 's'}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.subtle} style={{ marginLeft: 8 }} />
                </View>
              </Card>
            );
          }}
        />
      )}
    </View>
  );
}
