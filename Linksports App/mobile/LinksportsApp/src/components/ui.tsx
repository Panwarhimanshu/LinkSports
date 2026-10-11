import React, { useState } from 'react';
import {
  ActivityIndicator, Image, Pressable, StyleSheet, Text, TextInput, TextInputProps, TextStyle, View, ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, gradients, radius, shadow, type } from '../theme';

type IconName = keyof typeof Ionicons.glyphMap;

export function Button({
  title, onPress, loading, disabled, variant = 'primary', icon, size = 'md', style,
}: {
  title: string; onPress: () => void; loading?: boolean; disabled?: boolean;
  variant?: 'primary' | 'outline' | 'danger' | 'ghost' | 'accent'; icon?: IconName; size?: 'sm' | 'md'; style?: ViewStyle;
}) {
  const off = disabled || loading;
  const filled = variant === 'primary' || variant === 'accent' || variant === 'danger';
  const fg = filled ? '#fff' : colors.primary;
  const pad = size === 'sm' ? s.btnSm : s.btnMd;

  const content = loading ? (
    <ActivityIndicator color={fg} />
  ) : (
    <View style={s.btnRow}>
      {icon ? <Ionicons name={icon} size={size === 'sm' ? 16 : 18} color={fg} style={{ marginRight: 8 }} /> : null}
      <Text style={[s.btnText, size === 'sm' && { fontSize: 14 }, { color: fg }]}>{title}</Text>
    </View>
  );

  return (
    <Pressable
      onPress={onPress}
      disabled={off}
      style={({ pressed }) => [
        s.btn,
        variant === 'outline' && s.btnOutline,
        variant === 'ghost' && { backgroundColor: colors.primarySoft },
        variant === 'danger' && { backgroundColor: colors.danger },
        filled && variant !== 'danger' && shadow(2),
        off && { opacity: 0.55 },
        pressed && { transform: [{ scale: 0.98 }] },
        style,
      ]}
    >
      {variant === 'primary' || variant === 'accent' ? (
        <LinearGradient
          colors={variant === 'accent' ? gradients.accent : gradients.primary}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={[s.btnInner, pad]}
        >
          {content}
        </LinearGradient>
      ) : (
        <View style={[s.btnInner, pad]}>{content}</View>
      )}
    </Pressable>
  );
}

export function Field({ label, icon, style, ...props }: TextInputProps & { label: string; icon?: IconName }) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={s.label}>{label}</Text>
      <View style={[s.inputWrap, focused && s.inputFocused]}>
        {icon ? <Ionicons name={icon} size={18} color={focused ? colors.primary : colors.subtle} style={{ marginRight: 8 }} /> : null}
        <TextInput
          placeholderTextColor={colors.subtle}
          {...props}
          style={[s.input, style]}
          onFocus={(e) => { setFocused(true); props.onFocus?.(e); }}
          onBlur={(e) => { setFocused(false); props.onBlur?.(e); }}
        />
      </View>
    </View>
  );
}

/** Rounded search input with a leading icon and a clear button. */
export function SearchBar({ value, onChangeText, placeholder, style }: {
  value: string; onChangeText: (v: string) => void; placeholder: string; style?: ViewStyle;
}) {
  return (
    <View style={[s.search, style]}>
      <Ionicons name="search" size={18} color={colors.subtle} />
      <TextInput
        value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor={colors.subtle}
        style={s.searchInput} returnKeyType="search"
      />
      {value ? (
        <Pressable onPress={() => onChangeText('')} hitSlop={10}>
          <Ionicons name="close-circle" size={18} color={colors.subtle} />
        </Pressable>
      ) : null}
    </View>
  );
}

export function Card({ children, onPress, style }: { children: React.ReactNode; onPress?: () => void; style?: ViewStyle }) {
  if (onPress) {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => [s.card, shadow(1), pressed && { opacity: 0.92, transform: [{ scale: 0.99 }] }, style]}>
        {children}
      </Pressable>
    );
  }
  return <View style={[s.card, shadow(1), style]}>{children}</View>;
}

export function Chip({ label, active, onPress, color, icon }: {
  label: string; active?: boolean; onPress?: () => void; color?: string; icon?: IconName;
}) {
  const fg = active ? '#fff' : color || colors.text;
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={[s.chip, active && { backgroundColor: colors.primary, borderColor: colors.primary }, color && !active ? { borderColor: color } : null]}
    >
      {icon ? <Ionicons name={icon} size={14} color={fg} style={{ marginRight: 5 }} /> : null}
      <Text style={[s.chipText, { color: fg }]}>{label}</Text>
    </Pressable>
  );
}

/** Small filled label, e.g. listing type or application status. */
export function Badge({ label, color = colors.primary, soft, icon }: { label: string; color?: string; soft?: string; icon?: IconName }) {
  return (
    <View style={[s.badge, { backgroundColor: soft || `${color}1A` }]}>
      {icon ? <Ionicons name={icon} size={12} color={color} style={{ marginRight: 4 }} /> : null}
      <Text style={[s.badgeText, { color }]}>{label}</Text>
    </View>
  );
}

export function Avatar({ uri, name, size = 48, ring }: { uri?: string; name?: string; size?: number; ring?: boolean }) {
  const dim = { width: size, height: size, borderRadius: size / 2 };
  const ringStyle = ring ? { borderWidth: 3, borderColor: '#fff' } : null;
  if (uri) return <Image source={{ uri }} style={[dim, ringStyle]} />;
  return (
    <LinearGradient colors={gradients.primary} style={[dim, ringStyle, { alignItems: 'center', justifyContent: 'center' }]}>
      <Text style={{ color: '#fff', fontWeight: '800', fontSize: size * 0.4 }}>{name?.trim()?.[0]?.toUpperCase() || '?'}</Text>
    </LinearGradient>
  );
}

/** Icon + text on one line, used for meta info like date, place, fee. */
export function IconText({ icon, text, color = colors.muted, style }: { icon: IconName; text: string; color?: string; style?: TextStyle }) {
  return (
    <View style={s.iconText}>
      <Ionicons name={icon} size={14} color={color} style={{ marginRight: 5 }} />
      <Text style={[{ color, fontSize: 13, flexShrink: 1 }, style]} numberOfLines={1}>{text}</Text>
    </View>
  );
}

export function SectionTitle({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <View style={s.sectionTitle}>
      <Text style={[type.h2, { color: colors.text }]}>{title}</Text>
      {action ? <Text onPress={onAction} style={{ color: colors.primary, fontWeight: '700', fontSize: 13 }}>{action}</Text> : null}
    </View>
  );
}

export function InfoRow({ icon, label, value }: { icon: IconName; label: string; value?: string }) {
  if (!value) return null;
  return (
    <View style={s.infoRow}>
      <View style={s.infoIcon}><Ionicons name={icon} size={16} color={colors.primary} /></View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.muted, fontSize: 12 }}>{label}</Text>
        <Text style={{ color: colors.text, fontWeight: '600', fontSize: 15, marginTop: 1 }}>{value}</Text>
      </View>
    </View>
  );
}

/**
 * Gradient header that sits under the status bar. Screens using it should hide the
 * navigator header. `children` renders inside the hero (e.g. a search bar).
 */
export function Hero({ title, subtitle, overline, right, children, compact }: {
  title: string; subtitle?: string; overline?: string; right?: React.ReactNode; children?: React.ReactNode; compact?: boolean;
}) {
  const insets = useSafeAreaInsets();
  return (
    <LinearGradient colors={gradients.hero} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
      style={[s.hero, { paddingTop: insets.top + (compact ? 8 : 14) }]}>
      {/* decorative rings for a sporty feel */}
      <View style={[s.ring, { width: 220, height: 220, top: -70, right: -60 }]} />
      <View style={[s.ring, { width: 120, height: 120, top: 40, right: 40, opacity: 0.5 }]} />
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <View style={{ flex: 1 }}>
          {overline ? <Text style={[type.overline, { color: colors.accent, marginBottom: 4 }]}>{overline}</Text> : null}
          <Text style={[compact ? type.h1 : type.hero, { color: '#fff' }]}>{title}</Text>
          {subtitle ? <Text style={{ color: '#c7d2fe', marginTop: 4, fontSize: 14 }}>{subtitle}</Text> : null}
        </View>
        {right}
      </View>
      {children ? <View style={{ marginTop: 14 }}>{children}</View> : null}
    </LinearGradient>
  );
}

export function Centered({ children }: { children: React.ReactNode }) {
  return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>{children}</View>;
}

export function Loading() {
  return <Centered><ActivityIndicator size="large" color={colors.primary} /></Centered>;
}

export function EmptyState({ text, title, icon = 'albums-outline', action, onAction }: {
  text: string; title?: string; icon?: IconName; action?: string; onAction?: () => void;
}) {
  return (
    <View style={s.empty}>
      <View style={s.emptyIcon}><Ionicons name={icon} size={30} color={colors.primary} /></View>
      {title ? <Text style={[type.h2, { color: colors.text, marginBottom: 4, textAlign: 'center' }]}>{title}</Text> : null}
      <Text style={{ color: colors.muted, textAlign: 'center', lineHeight: 20 }}>{text}</Text>
      {action && onAction ? <Button title={action} onPress={onAction} variant="ghost" size="sm" style={{ marginTop: 14 }} /> : null}
    </View>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <View style={s.empty}>
      <View style={[s.emptyIcon, { backgroundColor: colors.dangerSoft }]}><Ionicons name="cloud-offline-outline" size={30} color={colors.danger} /></View>
      <Text style={{ color: colors.text, textAlign: 'center', marginBottom: 12, lineHeight: 20 }}>{message}</Text>
      {onRetry && <Button title="Try again" icon="refresh" onPress={onRetry} variant="ghost" size="sm" />}
    </View>
  );
}

export const fmtDate = (d?: string) =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '';

/** { day: '12', month: 'OCT' } for calendar-style date blocks */
export const dateParts = (d?: string) => {
  if (!d) return null;
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return null;
  return { day: String(dt.getDate()), month: dt.toLocaleDateString('en-IN', { month: 'short' }).toUpperCase() };
};

export const titleCase = (v?: string) => (v || '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

const s = StyleSheet.create({
  btn: { borderRadius: radius.md, overflow: 'hidden' },
  btnInner: { alignItems: 'center', justifyContent: 'center', borderRadius: radius.md },
  btnMd: { paddingVertical: 14, paddingHorizontal: 18 },
  btnSm: { paddingVertical: 9, paddingHorizontal: 14 },
  btnRow: { flexDirection: 'row', alignItems: 'center' },
  btnOutline: { backgroundColor: colors.card, borderWidth: 1.5, borderColor: colors.primary },
  btnText: { fontWeight: '700', fontSize: 15 },
  label: { color: colors.text, fontWeight: '600', marginBottom: 6, fontSize: 13 },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, borderWidth: 1.5,
    borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 14,
  },
  inputFocused: { borderColor: colors.primary, backgroundColor: '#fbfcff' },
  input: { flex: 1, paddingVertical: 12, fontSize: 15, color: colors.text },
  search: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, borderRadius: radius.pill,
    paddingHorizontal: 16, height: 48, ...shadow(1),
  },
  searchInput: { flex: 1, marginLeft: 10, fontSize: 15, color: colors.text, paddingVertical: 0 },
  card: { backgroundColor: colors.card, borderRadius: radius.lg, padding: 16, marginBottom: 14 },
  chip: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.pill,
    borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, marginRight: 8,
  },
  chipText: { fontSize: 13, fontWeight: '600' },
  badge: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', paddingHorizontal: 9, paddingVertical: 4, borderRadius: radius.pill },
  badgeText: { fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
  iconText: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  sectionTitle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8, marginBottom: 10 },
  infoRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  infoIcon: { width: 34, height: 34, borderRadius: 10, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  hero: { paddingHorizontal: 18, paddingBottom: 20, borderBottomLeftRadius: radius.xl, borderBottomRightRadius: radius.xl, overflow: 'hidden' },
  ring: { position: 'absolute', borderRadius: 999, borderWidth: 18, borderColor: 'rgba(255,255,255,0.06)' },
  empty: { alignItems: 'center', justifyContent: 'center', paddingVertical: 48, paddingHorizontal: 32 },
  emptyIcon: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
});
