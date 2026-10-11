import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View, useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Sharing from 'expo-sharing';
import * as Clipboard from 'expo-clipboard';
import * as MediaLibrary from 'expo-media-library/legacy';
import { File, Paths } from 'expo-file-system';
import { captureRef } from 'react-native-view-shot';
import { Button, Chip, Field, SearchBar } from '../../src/components/ui';
import StoryCard, { STORY_H, STORY_W } from '../../src/components/StoryCard';
import { API_URL, api, errorMessage, tokens } from '../../src/lib/api';
import { useAuth } from '../../src/store/auth';
import {
  CvForm, MIN_COMPLETE, Row, SPORTS, absoluteUrl, buildStoryData, emptyForm, fromProfile, logEvent, shareUrlFor, toPayload,
} from '../../src/lib/cv';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, gradients, radius, shadow } from '../../src/theme';

const SECTIONS = ['Basic info', 'Team / Academy', 'Tournaments', 'Achievements', 'Photo & media'];
const SECTION_ICONS = ['person-outline', 'people-outline', 'trophy-outline', 'medal-outline', 'camera-outline'] as const;
const STEP_TITLES: Record<number, string> = { 2: 'Choose your sport', 3: 'Build your CV', 4: 'Share your CV' };

export default function CvScreen() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<2 | 3 | 4>(2);
  const [section, setSection] = useState(0);
  const [sport, setSport] = useState('');
  const [form, setForm] = useState<CvForm>(emptyForm);
  const [profile, setProfile] = useState<Record<string, any> | null>(null);
  const [saving, setSaving] = useState(false);

  // restore an existing CV and jump to the right step
  useEffect(() => {
    (async () => {
      if (user?._id === 'guest') return setLoading(false); // nothing saved for a guest
      try {
        const res = await api.get('/profiles/athlete/me');
        const p = res.data.data?.profile || res.data.data;
        setProfile(p);
        setForm(fromProfile(p));
        setSport(p.primarySport || '');
        setStep(!p.primarySport ? 2 : (p.profileCompletion || 0) >= MIN_COMPLETE ? 4 : 3);
      } catch {
        setStep(2); // no CV yet
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const set = <K extends keyof CvForm>(k: K, v: CvForm[K]) => setForm((f) => ({ ...f, [k]: v }));

  // Guest mode (login bypassed): there is no session to save to, so keep the CV in memory
  // and let every step of the flow work for UI work.
  const isGuest = user?._id === 'guest';
  const localProfile = (s: string, f: CvForm) => ({ _id: 'guest', ...toPayload(s, f), profileCompletion: 100 });

  const save = useCallback(async () => {
    if (isGuest) {
      const p = localProfile(sport, form);
      setProfile(p);
      return p as Record<string, any>;
    }
    setSaving(true);
    try {
      const res = await api.patch('/profiles/athlete', toPayload(sport, form));
      setProfile(res.data.data);
      return res.data.data as Record<string, any>;
    } catch (e) {
      Alert.alert('Could not save', errorMessage(e));
      return null;
    } finally {
      setSaving(false);
    }
  }, [sport, form, isGuest]);

  const pickSport = async (name: string) => {
    setSport(name);
    if (isGuest) {
      setProfile(localProfile(name, form));
      setStep(3);
      setSection(0);
      return;
    }
    setSaving(true);
    try {
      const res = await api.patch('/profiles/athlete', { primarySport: name });
      setProfile(res.data.data);
      void logEvent('SPORT_SELECTED', { sport: name });
      setStep(3);
      setSection(0);
    } catch (e) {
      Alert.alert('Could not save your sport', errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const next = async () => {
    if (section === 0) {
      if (form.fullName.trim().length < 2) return Alert.alert('Enter your full name');
      if (form.dob && !/^\d{4}-\d{2}-\d{2}$/.test(form.dob)) return Alert.alert('Date of birth', 'Use the format YYYY-MM-DD, e.g. 2008-04-21');
    }
    const p = await save(); // autosave on every Next
    if (!p) return;
    if (section < SECTIONS.length - 1) setSection(section + 1);
    else setStep(4);
  };

  if (user?.role !== 'athlete') {
    return <Center><Text style={{ textAlign: 'center', color: colors.muted }}>The CV creator is for player accounts.</Text></Center>;
  }
  if (loading) return <Center><ActivityIndicator size="large" color={colors.primary} /></Center>;

  const back = step === 4 ? () => setStep(3) : step === 3 ? () => (section > 0 ? setSection(section - 1) : setStep(2)) : undefined;

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <LinearGradient colors={gradients.hero} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={{ paddingTop: insets.top + 8, paddingHorizontal: 16, paddingBottom: 16, borderBottomLeftRadius: radius.xl, borderBottomRightRadius: radius.xl }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          {back ? (
            <Pressable onPress={back} hitSlop={12} style={{ width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.15)', marginRight: 10 }}>
              <Ionicons name="arrow-back" size={20} color="#fff" />
            </Pressable>
          ) : null}
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 11, fontWeight: '800', letterSpacing: 1, color: colors.accent }}>STEP {step - 1} OF 3</Text>
            <Text style={{ fontSize: 22, fontWeight: '800', color: '#fff' }}>{STEP_TITLES[step]}</Text>
          </View>
          <Ionicons name="id-card" size={26} color="rgba(255,255,255,0.35)" />
        </View>
        <View style={{ flexDirection: 'row', gap: 6, marginTop: 14 }}>
          {[2, 3, 4].map((n) => (
            <View key={n} style={{ flex: 1, height: 5, borderRadius: 3, backgroundColor: n <= step ? colors.accent : 'rgba(255,255,255,0.2)' }} />
          ))}
        </View>
      </LinearGradient>

      {step === 2 && <SportStep selected={sport} busy={saving} onPick={pickSport} />}
      {step === 3 && <FormStep section={section} setSection={setSection} form={form} set={set} saving={saving} onNext={next} />}
      {step === 4 && profile && <ExportStep profile={profile} onEdit={() => { setStep(3); setSection(0); }} onChangeSport={() => setStep(2)} />}
    </KeyboardAvoidingView>
  );
}

const Center = ({ children }: { children: React.ReactNode }) => (
  <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>{children}</View>
);

// ── Step 2 ───────────────────────────────────────────────────────────────────
function SportStep({ selected, busy, onPick }: { selected: string; busy: boolean; onPick: (s: string) => void }) {
  const [q, setQ] = useState('');
  const list = useMemo(() => SPORTS.filter((s) => s.name.toLowerCase().includes(q.trim().toLowerCase())), [q]);
  return (
    <ScrollView contentContainerStyle={{ padding: 16 }} keyboardShouldPersistTaps="handled">
      <Text style={{ fontSize: 20, fontWeight: '800', color: colors.text }}>What do you play?</Text>
      <Text style={{ color: colors.muted, marginTop: 4, marginBottom: 14 }}>Pick your main sport — your CV is built around it.</Text>
      <SearchBar value={q} onChangeText={setQ} placeholder="Search sport" style={{ marginBottom: 16 }} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
        {list.map((s) => {
          const on = selected === s.name;
          return (
            <Pressable key={s.name} disabled={busy} onPress={() => onPick(s.name)}
              style={({ pressed }) => [{
                width: '31.5%', aspectRatio: 0.95, marginBottom: 10, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center',
                backgroundColor: on ? colors.primary : '#fff', borderWidth: on ? 0 : 1, borderColor: colors.border,
                opacity: busy ? 0.6 : 1, transform: [{ scale: pressed ? 0.96 : 1 }],
              }, shadow(on ? 3 : 1)]}>
              <View style={{ width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? 'rgba(255,255,255,0.18)' : colors.bg }}>
                <Text style={{ fontSize: 28 }}>{s.emoji}</Text>
              </View>
              <Text style={{ fontWeight: '700', fontSize: 13, marginTop: 8, color: on ? '#fff' : colors.text }} numberOfLines={1}>{s.name}</Text>
            </Pressable>
          );
        })}
      </View>
      {list.length === 0 && <Text style={{ textAlign: 'center', color: colors.muted }}>No match. Choose "Other".</Text>}
    </ScrollView>
  );
}

// ── Step 3 ───────────────────────────────────────────────────────────────────
function FormStep({ section, setSection, form, set, saving, onNext }: {
  section: number; setSection: (n: number) => void; form: CvForm;
  set: <K extends keyof CvForm>(k: K, v: CvForm[K]) => void; saving: boolean; onNext: () => void;
}) {
  const last = section === SECTIONS.length - 1;
  return (
    <>
      <ScrollView contentContainerStyle={{ padding: 16 }} keyboardShouldPersistTaps="handled">
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
          {SECTIONS.map((s, i) => <Chip key={s} label={s} icon={SECTION_ICONS[i]} active={i === section} onPress={() => setSection(i)} />)}
        </ScrollView>
        <Text style={{ fontSize: 18, fontWeight: '800', color: colors.text, marginBottom: 12 }}>{SECTIONS[section]}</Text>

        {section === 0 && (
          <>
            <Field label="Full name *" icon="person-outline" value={form.fullName} onChangeText={(v) => set('fullName', v)} />
            <Field label="Date of birth (YYYY-MM-DD)" icon="calendar-outline" value={form.dob} onChangeText={(v) => set('dob', v)} keyboardType="numbers-and-punctuation" maxLength={10} placeholder="2008-04-21" />
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}><Field label="City" value={form.city} onChangeText={(v) => set('city', v)} /></View>
              <View style={{ flex: 1 }}><Field label="State" value={form.state} onChangeText={(v) => set('state', v)} /></View>
            </View>
            <Field label="Playing position" value={form.position} onChangeText={(v) => set('position', v)} placeholder="e.g. Striker, Opening batter" />
            <Text style={{ fontWeight: '600', fontSize: 13, marginBottom: 6 }}>Gender</Text>
            <View style={{ flexDirection: 'row', marginBottom: 14 }}>
              {['male', 'female', 'other'].map((g) => <Chip key={g} label={g[0].toUpperCase() + g.slice(1)} active={form.gender === g} onPress={() => set('gender', form.gender === g ? '' : g)} />)}
            </View>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}><Field label="Height (cm)" value={form.height} onChangeText={(v) => set('height', v)} keyboardType="decimal-pad" /></View>
              <View style={{ flex: 1 }}><Field label="Weight (kg)" value={form.weight} onChangeText={(v) => set('weight', v)} keyboardType="decimal-pad" /></View>
            </View>
            <Field label="Phone" icon="call-outline" value={form.phone} onChangeText={(v) => set('phone', v)} keyboardType="phone-pad" />
            <Field label="One-line bio" icon="chatbubble-ellipses-outline" value={form.tagline} onChangeText={(v) => set('tagline', v)} maxLength={120} />
          </>
        )}

        {section === 1 && (
          <Rows rows={form.teams} onChange={(r) => set('teams', r)} blank={{ organization: '', role: '' }} addLabel="Add team / academy"
            fields={[{ key: 'organization', placeholder: 'Team / Academy / Club name' }, { key: 'role', placeholder: 'Your role (optional)' }]} />
        )}
        {section === 2 && (
          <Rows rows={form.tournaments} onChange={(r) => set('tournaments', r)} blank={{ name: '', year: '', result: '' }} addLabel="Add tournament"
            fields={[{ key: 'name', placeholder: 'Tournament name' }, { key: 'year', placeholder: 'Year', numeric: true }, { key: 'result', placeholder: 'Result (e.g. Winner)' }]} />
        )}
        {section === 3 && (
          <Rows rows={form.achievements} onChange={(r) => set('achievements', r)} blank={{ title: '', year: '', level: '' }} addLabel="Add achievement"
            fields={[{ key: 'title', placeholder: 'Achievement / medal' }, { key: 'year', placeholder: 'Year', numeric: true }, { key: 'level', placeholder: 'Level (District / State / National)' }]} />
        )}
        {section === 4 && <MediaSection form={form} set={set} />}
      </ScrollView>
      <BottomBar>
        <Button title={last ? 'Save & preview' : 'Next'} onPress={onNext} loading={saving} style={{ flex: 1, minHeight: 50 }} />
      </BottomBar>
    </>
  );
}

function BottomBar({ children }: { children: React.ReactNode }) {
  return <View style={{ flexDirection: 'row', gap: 10, padding: 12, backgroundColor: '#fff', borderTopWidth: 1, borderColor: colors.border }}>{children}</View>;
}

function Rows({ rows, onChange, blank, addLabel, fields }: {
  rows: Row[]; onChange: (r: Row[]) => void; blank: Row; addLabel: string;
  fields: { key: string; placeholder: string; numeric?: boolean }[];
}) {
  return (
    <>
      {rows.map((row, i) => (
        <View key={i} style={[{ backgroundColor: '#fff', borderRadius: radius.lg, padding: 14, marginBottom: 12, borderLeftWidth: 4, borderLeftColor: colors.primary }, shadow(1)]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
            <Text style={{ fontSize: 11, fontWeight: '800', letterSpacing: 1, color: colors.primary }}>#{i + 1}</Text>
            {rows.length > 1 && (
              <Pressable onPress={() => onChange(rows.filter((_, j) => j !== i))} hitSlop={10} style={{ marginLeft: 'auto', flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="trash-outline" size={15} color={colors.danger} />
                <Text style={{ color: colors.danger, fontWeight: '700', marginLeft: 4, fontSize: 13 }}>Remove</Text>
              </Pressable>
            )}
          </View>
          {fields.map((f) => (
            <TextInput key={f.key} value={row[f.key]} placeholder={f.placeholder} placeholderTextColor={colors.subtle}
              keyboardType={f.numeric ? 'number-pad' : 'default'}
              onChangeText={(v) => onChange(rows.map((r, j) => (j === i ? { ...r, [f.key]: v } : r)))}
              style={{ backgroundColor: colors.bg, borderRadius: radius.sm, padding: 12, fontSize: 15, marginBottom: 8, color: colors.text }} />
          ))}
        </View>
      ))}
      <Button title={addLabel} icon="add-circle-outline" variant="ghost" onPress={() => onChange([...rows, { ...blank }])} />
    </>
  );
}

function MediaSection({ form, set }: { form: CvForm; set: <K extends keyof CvForm>(k: K, v: CvForm[K]) => void }) {
  const [uploading, setUploading] = useState(false);

  const pick = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.8 });
    if (res.canceled || !res.assets[0]) return;
    const a = res.assets[0];
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('image', { uri: a.uri, name: a.fileName || 'photo.jpg', type: a.mimeType || 'image/jpeg' } as any);
      const r = await api.post('/upload/image', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      set('photo', r.data.data.url);
    } catch (e) {
      Alert.alert('Photo upload failed', errorMessage(e));
    } finally {
      setUploading(false);
    }
  };

  const photo = absoluteUrl(form.photo);
  return (
    <>
      <View style={{ alignItems: 'center', marginBottom: 20 }}>
        <View style={{ width: 120, height: 120, borderRadius: 60, backgroundColor: colors.border, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
          {photo ? <Image source={{ uri: photo }} style={{ width: 120, height: 120 }} /> : <Ionicons name="camera" size={32} color={colors.muted} />}
        </View>
        <Button title={photo ? 'Change photo' : 'Add headshot / action photo'} variant="outline" onPress={pick} loading={uploading} />
        <Text style={{ color: colors.muted, fontSize: 12, marginTop: 8, textAlign: 'center' }}>Shown on your Story card. A clear face photo works best.</Text>
      </View>
      <Field label="Instagram (optional)" value={form.instagram} onChangeText={(v) => set('instagram', v)} autoCapitalize="none" placeholder="https://instagram.com/yourname" />
      <Text style={{ fontWeight: '600', fontSize: 13, marginBottom: 6 }}>Highlight video links (YouTube / Instagram)</Text>
      <Rows rows={form.videos} onChange={(r) => set('videos', r)} blank={{ url: '' }} addLabel="Add video link" fields={[{ key: 'url', placeholder: 'https://…' }]} />
    </>
  );
}

// ── Step 4 ───────────────────────────────────────────────────────────────────
function ExportStep({ profile, onEdit, onChangeSport }: { profile: Record<string, any>; onEdit: () => void; onChangeSport: () => void }) {
  const { width } = useWindowDimensions();
  const previewW = Math.min(width - 32, 360);
  const cardRef = useRef<View>(null);
  const [fmt, setFmt] = useState<'png' | 'jpg'>('png');
  const [busy, setBusy] = useState<null | 'pdf' | 'save' | 'share'>(null);
  const [photoReady, setPhotoReady] = useState(!profile.photo);
  const data = useMemo(() => buildStoryData(profile, absoluteUrl(profile.photo)), [profile]);
  const link = shareUrlFor(profile.profileUrl);

  // capture at the exact Story size regardless of screen density
  const capture = async () => {
    if (!photoReady) throw new Error('Photo is still loading');
    return captureRef(cardRef, { format: fmt, quality: 0.95, result: 'tmpfile', width: STORY_W, height: STORY_H });
  };

  const saveStory = async () => {
    setBusy('save');
    try {
      const perm = await MediaLibrary.requestPermissionsAsync(true); // write-only: no need to read the user's gallery
      if (!perm.granted) return Alert.alert('Permission needed', 'Allow photo access in Settings to save your Story card, or use Share instead.');
      const uri = await capture();
      await MediaLibrary.saveToLibraryAsync(uri);
      void logEvent('STORY_CARD_EXPORTED', { sport: profile.primarySport, format: fmt });
      Alert.alert('Saved', 'Your Story card is in your gallery.');
    } catch (e: any) {
      Alert.alert('Could not save the image', e?.message || 'Please try again.');
    } finally { setBusy(null); }
  };

  const shareStory = async () => {
    setBusy('share');
    try {
      const uri = await capture();
      if (!(await Sharing.isAvailableAsync())) return Alert.alert('Sharing isn\'t available on this device');
      await Sharing.shareAsync(uri, { mimeType: fmt === 'png' ? 'image/png' : 'image/jpeg', dialogTitle: 'Share your Sports CV' });
      void logEvent('STORY_CARD_EXPORTED', { sport: profile.primarySport, format: fmt });
    } catch (e: any) {
      Alert.alert('Could not share the image', e?.message || 'Please try again.');
    } finally { setBusy(null); }
  };

  const downloadPdf = async () => {
    setBusy('pdf');
    try {
      await api.get('/auth/me'); // refreshes the access token if it has expired
      const token = await tokens.getAccess();
      const dest = new File(Paths.cache, `${(profile.fullName || 'player').replace(/\s+/g, '_')}_Sports_CV.pdf`);
      if (dest.exists) dest.delete();
      const file = await File.downloadFileAsync(`${API_URL}/profiles/athlete/${profile._id}/cv`, dest, { headers: { Authorization: `Bearer ${token}` } });
      await Sharing.shareAsync(file.uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: 'Your Sports CV' });
      void logEvent('PDF_DOWNLOADED', { sport: profile.primarySport });
    } catch {
      Alert.alert('Could not download the PDF', 'Check your connection and try again.');
    } finally { setBusy(null); }
  };

  return (
    <>
      <ScrollView contentContainerStyle={{ padding: 16, alignItems: 'center' }}>
        <Text style={{ fontSize: 22, fontWeight: '800', alignSelf: 'flex-start' }}>Your CV is ready 🎉</Text>
        <Text style={{ color: colors.muted, alignSelf: 'flex-start', marginTop: 4, marginBottom: 14 }}>Share your Story card on Instagram and WhatsApp.</Text>

        <View style={{ borderRadius: 14, overflow: 'hidden', elevation: 4, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 10 }}>
          <StoryCard ref={cardRef} data={data} width={previewW} onPhotoLoaded={() => setPhotoReady(true)} />
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 14, alignSelf: 'flex-start' }}>
          <Text style={{ color: colors.muted, marginRight: 10 }}>Image format</Text>
          <Chip label="PNG" active={fmt === 'png'} onPress={() => setFmt('png')} />
          <Chip label="JPG" active={fmt === 'jpg'} onPress={() => setFmt('jpg')} />
        </View>

        <View style={{ width: '100%', marginTop: 12, gap: 10 }}>
          <Button title="Share Story" variant="outline" onPress={shareStory} loading={busy === 'share'} disabled={!photoReady || busy !== null} />
          <Button title="Copy my profile link" variant="outline" onPress={async () => { await Clipboard.setStringAsync(link); Alert.alert('Link copied', link); }} />
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Button title="Edit CV" variant="outline" onPress={onEdit} style={{ flex: 1 }} />
            <Button title="Change sport" variant="outline" onPress={onChangeSport} style={{ flex: 1 }} />
          </View>
        </View>
        <Text style={{ color: colors.muted, fontSize: 12, marginTop: 12 }}>{link}</Text>
      </ScrollView>
      <BottomBar>
        <Button title="PDF CV" onPress={downloadPdf} loading={busy === 'pdf'} disabled={busy !== null} style={{ flex: 1, minHeight: 50 }} />
        <Button title="Save Story" onPress={saveStory} loading={busy === 'save'} disabled={!photoReady || busy !== null} style={{ flex: 1, minHeight: 50 }} />
      </BottomBar>
    </>
  );
}
