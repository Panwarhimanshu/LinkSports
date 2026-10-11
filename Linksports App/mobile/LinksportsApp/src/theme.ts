import { Platform, ViewStyle } from 'react-native';

export const colors = {
  primary: '#1d4ed8',
  primaryDark: '#1e3a8a',
  primarySoft: '#e8efff',
  navy: '#0b1736',
  accent: '#ff6b2c', // energetic orange for highlights (fees, "new", CTAs on dark)
  accentSoft: '#fff1ea',
  bg: '#f2f4f9',
  card: '#ffffff',
  text: '#0f172a',
  muted: '#64748b',
  subtle: '#94a3b8',
  border: '#e2e8f0',
  danger: '#dc2626',
  dangerSoft: '#fdecec',
  success: '#16a34a',
  successSoft: '#e7f7ed',
  warn: '#d97706',
  warnSoft: '#fdf3e2',
};

// expo-linear-gradient needs readonly tuples of at least two stops
export const gradients = {
  hero: ['#0b1736', '#1e3a8a', '#1d4ed8'] as const,
  primary: ['#2563eb', '#1d4ed8'] as const,
  accent: ['#ff8a3d', '#ff5a1f'] as const,
};

export const radius = { sm: 10, md: 14, lg: 20, xl: 28, pill: 999 };
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 };

export const type = {
  hero: { fontSize: 28, fontWeight: '800' as const, letterSpacing: -0.5 },
  h1: { fontSize: 22, fontWeight: '800' as const, letterSpacing: -0.3 },
  h2: { fontSize: 17, fontWeight: '700' as const },
  body: { fontSize: 15 },
  small: { fontSize: 13 },
  overline: { fontSize: 11, fontWeight: '800' as const, letterSpacing: 1 },
};

export const shadow = (level: 1 | 2 | 3 = 1): ViewStyle =>
  Platform.select({
    android: { elevation: level * 2 },
    default: { shadowColor: '#0b1736', shadowOpacity: 0.06 * level, shadowRadius: 4 * level, shadowOffset: { width: 0, height: level } },
  }) as ViewStyle;

export const statusColor = (s?: string) => {
  switch (s) {
    case 'shortlisted':
    case 'selected':
    case 'accepted':
      return colors.success;
    case 'rejected':
    case 'withdrawn':
      return colors.danger;
    default:
      return colors.warn;
  }
};

export const statusSoft = (s?: string) => {
  const c = statusColor(s);
  return c === colors.success ? colors.successSoft : c === colors.danger ? colors.dangerSoft : colors.warnSoft;
};

// One accent per listing type so the feed is scannable at a glance
export const typeColor = (t?: string) =>
  ({
    trial: '#1d4ed8',
    event: '#7c3aed',
    tournament: '#ff5a1f',
    admission: '#0891b2',
    training_camp: '#16a34a',
  })[t || ''] || colors.primary;
