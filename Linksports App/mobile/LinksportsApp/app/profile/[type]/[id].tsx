import { ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Avatar, Badge, Card, ErrorState, IconText, InfoRow, Loading, fmtDate, titleCase } from '../../../src/components/ui';
import { api, errorMessage } from '../../../src/lib/api';
import { absoluteUrl } from '../../../src/lib/cv';
import { colors, gradients, radius } from '../../../src/theme';

const ENDPOINT: Record<string, string> = { athlete: 'athlete', coach: 'coach', organization: 'organization' };

export default function ProfileDetail() {
  const { type, id } = useLocalSearchParams<{ type: string; id: string }>();
  const router = useRouter();
  const kind = ENDPOINT[type] ? type : 'athlete';

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['profile', kind, id],
    queryFn: async () => (await api.get(`/profiles/${ENDPOINT[kind]}/${id}`)).data.data as any,
  });

  if (isLoading) return <Loading />;
  if (error || !data) return <ErrorState message={errorMessage(error)} onRetry={refetch} />;

  const p = data.profile;
  const name = p.fullName || p.name;
  const loc = [p.location?.city, p.location?.state].filter(Boolean).join(', ');
  const sports = [p.primarySport, ...(p.secondarySports || []), ...(p.sportsSpecialization || []), ...(p.sports || [])].filter(Boolean);
  const stats = kind === 'athlete'
    ? [
      { label: 'Height', value: p.height ? `${p.height}${p.heightUnit || 'cm'}` : '' },
      { label: 'Weight', value: p.weight ? `${p.weight}kg` : '' },
      { label: 'Achievements', value: (p.achievements || []).length ? String(p.achievements.length) : '' },
    ].filter((x) => x.value)
    : [];

  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={{ paddingBottom: 32 }}>
      <LinearGradient colors={gradients.hero} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={{ alignItems: 'center', paddingTop: 8, paddingBottom: stats.length ? 56 : 28, paddingHorizontal: 18, borderBottomLeftRadius: radius.xl, borderBottomRightRadius: radius.xl }}>
        <Avatar uri={absoluteUrl(p.photo || p.logo)} name={name} size={100} ring />
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12 }}>
          <Text style={{ fontSize: 22, fontWeight: '800', color: '#fff' }}>{name}</Text>
          {p.isVerified ? <Ionicons name="checkmark-circle" size={20} color="#60a5fa" style={{ marginLeft: 6 }} /> : null}
        </View>
        {p.tagline ? <Text style={{ color: '#c7d2fe', marginTop: 4, textAlign: 'center' }}>{p.tagline}</Text> : null}
        {loc ? <IconText icon="location-outline" text={loc} color="#c7d2fe" /> : null}
        {sports.length ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 6, marginTop: 12 }}>
            {sports.map((s: string, i: number) => <Badge key={`${s}-${i}`} label={s} color="#fff" soft={i === 0 ? colors.accent : 'rgba(255,255,255,0.18)'} />)}
          </View>
        ) : null}
      </LinearGradient>

      <View style={{ paddingHorizontal: 16, marginTop: stats.length ? -32 : 16 }}>
        {stats.length ? (
          <Card style={{ flexDirection: 'row', paddingVertical: 14 }}>
            {stats.map((st, i) => (
              <View key={st.label} style={{ flex: 1, alignItems: 'center', borderLeftWidth: i ? 1 : 0, borderColor: colors.border }}>
                <Text style={{ fontSize: 20, fontWeight: '800', color: colors.primary }}>{st.value}</Text>
                <Text style={{ fontSize: 12, color: colors.muted, marginTop: 2 }}>{st.label}</Text>
              </View>
            ))}
          </Card>
        ) : null}

        {kind === 'athlete' && (p.position || p.dominantSide || p.isParaAthlete) ? (
          <Card>
            <InfoRow icon="locate-outline" label="Position" value={p.position} />
            <InfoRow icon="hand-left-outline" label="Dominant side" value={titleCase(p.dominantSide)} />
            <InfoRow icon="accessibility-outline" label="Para athlete" value={p.isParaAthlete ? `Yes${p.paraClassification ? ` (${p.paraClassification})` : ''}` : ''} />
          </Card>
        ) : null}

        {kind === 'coach' && (
          <Card>
            <InfoRow icon="time-outline" label="Availability" value={titleCase(p.availability)} />
            <InfoRow icon="people-outline" label="Age groups" value={(p.ageGroupsCoached || []).join(', ')} />
          </Card>
        )}

        {kind === 'organization' && (
          <Card>
            <InfoRow icon="business-outline" label="Type" value={titleCase(p.type)} />
            <InfoRow icon="globe-outline" label="Website" value={p.contact?.website} />
          </Card>
        )}

        {p.bio || p.about || p.description ? (
          <Section title="About"><Text style={{ lineHeight: 22, color: colors.text }}>{p.bio || p.about || p.description}</Text></Section>
        ) : null}

        {(p.achievements || []).length > 0 && (
          <Section title="Achievements">
            {p.achievements.map((a: any, i: number) => (
              <ListItem key={i} icon="medal" color={colors.accent} title={a.title}
                sub={[a.year, a.level ? titleCase(a.level) : null].filter(Boolean).join(' · ')} />
            ))}
          </Section>
        )}

        {(p.qualifications || []).length > 0 && (
          <Section title="Qualifications">
            {p.qualifications.map((q: any, i: number) => (
              <ListItem key={i} icon="school" title={q.name} sub={[q.issuer, q.year].filter(Boolean).join(' · ')} />
            ))}
          </Section>
        )}

        {(p.experience || []).length > 0 && (
          <Section title="Experience">
            {p.experience.map((x: any, i: number) => (
              <ListItem key={i} icon="briefcase" title={x.role || x.organization} sub={x.role ? x.organization : ''} />
            ))}
          </Section>
        )}

        {kind === 'organization' && (data.listings || []).length > 0 && (
          <Section title="Open trials & events">
            {data.listings.map((l: any) => (
              <Card key={l._id} onPress={() => router.push(`/listing/${l._id}`)} style={{ marginBottom: 8, backgroundColor: colors.bg }}>
                <Text style={{ fontWeight: '700', color: colors.text }}>{l.title}</Text>
                <IconText icon="calendar-outline" text={fmtDate(l.startDate)} />
              </Card>
            ))}
          </Section>
        )}

        {kind === 'organization' && (data.jobs || []).length > 0 && (
          <Section title="Open jobs">
            {data.jobs.map((j: any) => (
              <Card key={j._id} onPress={() => router.push(`/job/${j._id}`)} style={{ marginBottom: 8, backgroundColor: colors.bg }}>
                <Text style={{ fontWeight: '700', color: colors.text }}>{j.title}</Text>
                <IconText icon="location-outline" text={j.location} />
              </Card>
            ))}
          </Section>
        )}
      </View>
    </ScrollView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <Text style={{ fontWeight: '800', fontSize: 16, color: colors.text, marginBottom: 8 }}>{title}</Text>
      {children}
    </Card>
  );
}

function ListItem({ icon, title, sub, color = colors.primary }: { icon: keyof typeof Ionicons.glyphMap; title: string; sub?: string; color?: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 6 }}>
      <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: `${color}1A`, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
        <Ionicons name={icon} size={17} color={color} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontWeight: '700', color: colors.text }}>{title}</Text>
        {sub ? <Text style={{ color: colors.muted, fontSize: 13, marginTop: 1 }}>{sub}</Text> : null}
      </View>
    </View>
  );
}
