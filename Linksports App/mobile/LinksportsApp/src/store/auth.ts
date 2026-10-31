import { create } from 'zustand';
import { api, tokens, setSessionExpiredHandler } from '../lib/api';

export type Role = 'athlete' | 'coach' | 'professional' | 'organization' | 'admin';

export interface SessionUser {
  _id: string;
  email: string;
  role: Role;
  isVerified: boolean;
}

// TEMPORARY: login is skipped while the UI is being built. The app runs as a guest athlete;
// endpoints that need a real session will 401 and screens show a "log in later" state.
// Set to false to bring back the login flow.
export const AUTH_BYPASS = false;

const GUEST_USER: SessionUser = { _id: 'guest', email: 'guest@linksports.in', role: 'athlete', isVerified: true };
const GUEST_PROFILE = { _id: 'guest', fullName: 'Guest Athlete' };

interface AuthState {
  user: SessionUser | null;
  profile: any | null;
  ready: boolean;
  bootstrap: () => Promise<void>;
  login: (identifier: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  reloadMe: () => Promise<void>;
}

export const useAuth = create<AuthState>((set, get) => ({
  user: null,
  profile: null,
  ready: false,

  async reloadMe() {
    const res = await api.get('/auth/me');
    set({ user: res.data.data.user, profile: res.data.data.profile });
  },

  async bootstrap() {
    if (AUTH_BYPASS) {
      // a 401 on a protected endpoint must not kick the guest back to the login screen
      setSessionExpiredHandler(() => {});
      set({ user: GUEST_USER, profile: GUEST_PROFILE, ready: true });
      return;
    }
    setSessionExpiredHandler(() => set({ user: null, profile: null }));
    try {
      if (await tokens.getAccess()) await get().reloadMe();
    } catch {
      await tokens.clear();
    } finally {
      set({ ready: true });
    }
  },

  async login(identifier, password) {
    const res = await api.post('/auth/login', { email: identifier.trim(), password });
    const { accessToken, refreshToken } = res.data.data;
    await tokens.set(accessToken, refreshToken);
    await get().reloadMe();
  },

  async logout() {
    try {
      const refreshToken = await tokens.getRefresh();
      await api.post('/auth/logout', { refreshToken });
    } catch {
      // best effort — always clear locally
    }
    await tokens.clear();
    set(AUTH_BYPASS ? { user: GUEST_USER, profile: GUEST_PROFILE } : { user: null, profile: null });
  },
}));
