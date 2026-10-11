import { useState } from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Badge, Button, Card, Chip, ErrorState, Field, InfoRow, Loading, fmtDate, titleCase } from '../../src/components/ui';
import { api, errorMessage } from '../../src/lib/api';
import { useAuth } from '../../src/store/auth';
import { colors, gradients, radius, statusColor, statusSoft, typeColor } from '../../src/theme';

export default function ListingDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const role = useAuth((s) => s.user?.role);
  const isGuest = useAuth((s) => s.user?._id === 'guest');
  const [answers, setAnswers] = useState<Record<string, string>>({});

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['listing', id],
    queryFn: async () => (await api.get(`/listings/${id}`)).data.data as { listing: any; userApplication: any },
  });

  const apply = useMutation({
    mutationFn: async () => {
      const questions: any[] = data!.listing.customQuestions || [];
      const missing = questions.find((q) => q.required && !answers[q.id]?.trim());
      if (missing) throw new Error(`Please answer: ${missing.question}`);
      return api.post(`/listings/${id}/apply`, {
        answers: questions.map((q) => ({ questionId: q.id, answer: answers[q.id] || '' })),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['listing', id] });
      qc.invalidateQueries({ queryKey: ['my-applications'] });
      Alert.alert('Applied', 'Your application has been submitted.');
    },
    onError: (e: any) => Alert.alert('Could not apply', e.response ? errorMessage(e) : e.message),
  });

  if (isLoading) return <Loading />;
  if (error || !data) return <ErrorState message={errorMessage(error)} onRetry={refetch} />;

  const { listing, userApplication } = data;
  const accent = typeColor(listing.type);
  const canApply = role === 'athlete' || role === 'coach' || role === 'professional';
  const closed = listing.status !== 'published' || (listing.registrationDeadline && new Date(listing.registrationDeadline) < new Date());
  const full = listing.participantLimit && listing.participantCount >= listing.participantLimit;
  const org = listing.organizationId;
  const loc = [listing.location?.address, listing.location?.city, listing.location?.state].filter(Boolean).join(', ');
  const spotsPct = listing.participantLimit ? Math.min(100, Math.round((listing.participantCount / listing.participantLimit) * 100)) : null;
  const elig = listing.eligibility || {};
  const eligText = [
    elig.ageMin || elig.ageMax ? `Age ${elig.ageMin ?? '—'}–${elig.ageMax ?? '—'}` : null,
    elig.gender ? titleCase(elig.gender) : null,
    elig.experienceLevel ? titleCase(elig.experienceLevel) : null,
  ].filter(Boolean).join(' · ');

  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={{ paddingBottom: 32 }} keyboardShouldPersistTaps="handled">
      <LinearGradient colors={gradients.hero} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={{ paddingHorizontal: 18, paddingTop: 8, paddingBottom: 44, borderBottomLeftRadius: radius.xl, borderBottomRightRadius: radius.xl }}>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          <Badge label={titleCase(listing.type).toUpperCase()} color="#fff" soft={accent} />
          <Badge label={listing.participantFee ? `₹${listing.participantFee}` : 'FREE'} color="#fff" soft="rgba(255,255,255,0.18)" />
        </View>
        <Text style={{ fontSize: 24, fontWeight: '800', color: '#fff', marginTop: 12, letterSpacing: -0.3 }}>{listing.title}</Text>
        {org?.name && (
          <Text style={{ color: '#c7d2fe', marginTop: 6, fontWeight: '600' }} onPress={() => router.push(`/profile/organization/${org._id}`)}>
            <Ionicons name="shield-checkmark" size={14} color="#c7d2fe" /> {org.name}  ›
          </Text>
        )}
      </LinearGradient>

      <View style={{ paddingHorizontal: 16, marginTop: -28 }}>
        <Card>
          <InfoRow icon="calendar-outline" label="Starts" value={`${fmtDate(listing.startDate)}${listing.endDate ? `  →  ${fmtDate(listing.endDate)}` : ''}`} />
          <InfoRow icon="alarm-outline" label="Register by" value={fmtDate(listing.registrationDeadline)} />
          <InfoRow icon="location-outline" label="Location" value={listing.location?.isOnline ? 'Online' : loc || '—'} />
          <InfoRow icon="wallet-outline" label="Fee" value={listing.participantFee ? `₹${listing.participantFee}` : 'Free'} />
          {spotsPct !== null ? (
            <View style={{ marginTop: 8 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ color: colors.muted, fontSize: 12 }}>Spots filled</Text>
                <Text style={{ color: colors.text, fontWeight: '700', fontSize: 12 }}>{listing.participantCount}/{listing.participantLimit}</Text>
              </View>
              <View style={{ height: 6, borderRadius: 3, backgroundColor: colors.primarySoft, marginTop: 6, overflow: 'hidden' }}>
                <View style={{ width: `${spotsPct}%`, height: 6, backgroundColor: spotsPct >= 85 ? colors.accent : colors.primary }} />
              </View>
            </View>
          ) : null}
        </Card>

        {(listing.sports || []).length ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 6 }}>
            {(listing.sports || []).map((s: string) => <View key={s} style={{ marginBottom: 8 }}><Chip label={s} icon="football-outline" /></View>)}
          </View>
        ) : null}

        <Card>
          <Text style={{ fontWeight: '800', fontSize: 16, color: colors.text }}>About</Text>
          <Text style={{ color: colors.text, marginTop: 8, lineHeight: 22 }}>{listing.description}</Text>
        </Card>

        {eligText ? (
          <Card>
            <Text style={{ fontWeight: '800', fontSize: 16, color: colors.text }}>Eligibility</Text>
            <Text style={{ color: colors.text, marginTop: 8 }}>{eligText}</Text>
          </Card>
        ) : null}

        <View style={{ marginTop: 8 }}>
          {userApplication ? (
            <Card style={{ backgroundColor: statusSoft(userApplication.status) }}>
              <Text style={{ fontWeight: '800', color: colors.text }}>You've applied</Text>
              <Text style={{ color: statusColor(userApplication.status), marginTop: 4, fontWeight: '700' }}>
                Status: {titleCase(userApplication.status)}
              </Text>
            </Card>
          ) : !canApply ? (
            <Notice icon="information-circle-outline" text="Only athletes and coaches can apply." />
          ) : closed || full ? (
            <Notice icon="close-circle-outline" color={colors.danger} text={full ? 'Participant limit reached.' : 'Registration is closed.'} />
          ) : isGuest ? (
            <>
              <Notice icon="lock-closed-outline" text="Applying will be available once login is enabled." />
              <Button title="Apply now" icon="paper-plane-outline" disabled onPress={() => {}} />
            </>
          ) : (
            <>
              {(listing.customQuestions || []).map((q: any) => (
                <Field
                  key={q.id}
                  label={`${q.question}${q.required ? ' *' : ''}`}
                  value={answers[q.id] || ''}
                  onChangeText={(t) => setAnswers((a) => ({ ...a, [q.id]: t }))}
                  placeholder={q.type === 'yes_no' ? 'Yes / No' : q.options?.length ? q.options.join(' / ') : ''}
                />
              ))}
              {listing.documentRequired && (
                <Notice icon="document-attach-outline" color={colors.warn}
                  text={`This listing asks for documents (${listing.documentDescription || 'see description'}). Document upload isn't in the app yet — you can attach them from the website after applying.`} />
              )}
              <Button title={listing.participantFee ? `Apply · ₹${listing.participantFee}` : 'Apply now'} icon="paper-plane-outline"
                onPress={() => apply.mutate()} loading={apply.isPending} />
            </>
          )}
        </View>
      </View>
    </ScrollView>
  );
}

function Notice({ icon, text, color = colors.muted }: { icon: keyof typeof Ionicons.glyphMap; text: string; color?: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', backgroundColor: '#fff', borderRadius: radius.md, padding: 12, marginBottom: 12 }}>
      <Ionicons name={icon} size={18} color={color} style={{ marginRight: 8, marginTop: 1 }} />
      <Text style={{ color, flex: 1, lineHeight: 20 }}>{text}</Text>
    </View>
  );
}
