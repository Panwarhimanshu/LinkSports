import { useState } from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Avatar, Badge, Button, Card, ErrorState, Field, InfoRow, Loading, fmtDate, titleCase } from '../../src/components/ui';
import { api, errorMessage } from '../../src/lib/api';
import { useAuth } from '../../src/store/auth';
import { colors, gradients, radius, statusColor, statusSoft } from '../../src/theme';

export default function JobDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const role = useAuth((s) => s.user?.role);
  const isGuest = useAuth((s) => s.user?._id === 'guest');
  const [coverLetter, setCoverLetter] = useState('');

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['job', id],
    queryFn: async () => (await api.get(`/jobs/${id}`)).data.data as { job: any; userApplication: any },
  });

  const apply = useMutation({
    mutationFn: () => api.post(`/jobs/${id}/apply`, { coverLetter: coverLetter.trim() || undefined }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['job', id] });
      qc.invalidateQueries({ queryKey: ['my-applications'] });
      Alert.alert('Applied', 'Your application has been submitted.');
    },
    onError: (e) => Alert.alert('Could not apply', errorMessage(e)),
  });

  if (isLoading) return <Loading />;
  if (error || !data) return <ErrorState message={errorMessage(error)} onRetry={refetch} />;

  const { job, userApplication } = data;
  const org = job.organizationId;
  const canApply = role && role !== 'organization' && role !== 'admin';
  const expired = job.applicationDeadline && new Date(job.applicationDeadline) < new Date();
  const pay = job.salaryMin || job.salaryMax ? `₹${job.salaryMin ?? '—'} – ₹${job.salaryMax ?? '—'}` : '';

  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={{ paddingBottom: 32 }} keyboardShouldPersistTaps="handled">
      <LinearGradient colors={gradients.hero} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={{ paddingHorizontal: 18, paddingTop: 8, paddingBottom: 44, borderBottomLeftRadius: radius.xl, borderBottomRightRadius: radius.xl }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Avatar uri={org?.logo} name={org?.name || job.title} size={52} ring />
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={{ fontSize: 22, fontWeight: '800', color: '#fff', letterSpacing: -0.3 }}>{job.title}</Text>
            {org?.name && (
              <Text style={{ color: '#c7d2fe', marginTop: 4, fontWeight: '600' }} onPress={() => router.push(`/profile/organization/${org._id}`)}>
                {org.name}  ›
              </Text>
            )}
          </View>
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 14 }}>
          {job.category ? <Badge label={titleCase(job.category)} color="#fff" soft="rgba(255,255,255,0.18)" /> : null}
          {job.jobType ? <Badge label={titleCase(job.jobType)} color="#fff" soft="rgba(255,255,255,0.18)" /> : null}
        </View>
      </LinearGradient>

      <View style={{ paddingHorizontal: 16, marginTop: -28 }}>
        <Card>
          <InfoRow icon="location-outline" label="Location" value={job.location} />
          <InfoRow icon="cash-outline" label="Salary" value={pay} />
          <InfoRow icon="ribbon-outline" label="Experience" value={titleCase(job.experienceLevel)} />
          <InfoRow icon="alarm-outline" label="Apply by" value={fmtDate(job.applicationDeadline)} />
        </Card>

        <Card>
          <Text style={{ fontWeight: '800', fontSize: 16, color: colors.text }}>Description</Text>
          <Text style={{ marginTop: 8, lineHeight: 22, color: colors.text }}>{job.description}</Text>
        </Card>

        {job.requiredQualifications?.length ? (
          <Card>
            <Text style={{ fontWeight: '800', fontSize: 16, color: colors.text }}>Qualifications</Text>
            {job.requiredQualifications.map((q: string, i: number) => (
              <View key={i} style={{ flexDirection: 'row', marginTop: 8 }}>
                <Ionicons name="checkmark-circle" size={18} color={colors.success} style={{ marginRight: 8 }} />
                <Text style={{ flex: 1, color: colors.text, lineHeight: 20 }}>{q}</Text>
              </View>
            ))}
          </Card>
        ) : null}

        <View style={{ marginTop: 8 }}>
          {userApplication && userApplication.status ? (
            <Card style={{ backgroundColor: statusSoft(userApplication.status) }}>
              <Text style={{ fontWeight: '800', color: colors.text }}>You've applied</Text>
              <Text style={{ color: statusColor(userApplication.status), marginTop: 4, fontWeight: '700' }}>
                Status: {titleCase(userApplication.status)}
              </Text>
            </Card>
          ) : !canApply ? (
            <Text style={{ color: colors.muted }}>Only athletes, coaches and professionals can apply.</Text>
          ) : expired ? (
            <Text style={{ color: colors.danger, fontWeight: '600' }}>The application deadline has passed.</Text>
          ) : isGuest ? (
            <>
              <Text style={{ color: colors.muted, marginBottom: 12 }}>Applying will be available once login is enabled.</Text>
              <Button title="Apply now" icon="paper-plane-outline" disabled onPress={() => {}} />
            </>
          ) : (
            <>
              <Field label="Cover letter (optional)" value={coverLetter} onChangeText={setCoverLetter} multiline numberOfLines={5} style={{ minHeight: 100, textAlignVertical: 'top' }} />
              <Button title="Apply now" icon="paper-plane-outline" onPress={() => apply.mutate()} loading={apply.isPending} />
            </>
          )}
        </View>
      </View>
    </ScrollView>
  );
}
