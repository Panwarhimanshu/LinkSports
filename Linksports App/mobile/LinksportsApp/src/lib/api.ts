import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import Constants from 'expo-constants';

// Dev default: Android emulator reaches the host PC at 10.0.2.2, iOS simulator at localhost.
// Physical devices (or production) must set EXPO_PUBLIC_API_URL.
const DEV_HOST = Platform.OS === 'android' ? '10.0.2.2' : 'localhost';
// Values come from the shared <repo>/.env via app.config.js (extra), falling back to EXPO_PUBLIC_* env vars.
const extra = (Constants.expoConfig?.extra ?? {}) as { apiUrl?: string; siteUrl?: string };
export const API_URL = extra.apiUrl || process.env.EXPO_PUBLIC_API_URL || `http://${DEV_HOST}:5000/api/v1`;
export const SITE_URL_CONFIG = extra.siteUrl || process.env.EXPO_PUBLIC_SITE_URL || '';

const ACCESS_KEY = 'ls_access';
const REFRESH_KEY = 'ls_refresh';

export const tokens = {
  getAccess: () => SecureStore.getItemAsync(ACCESS_KEY),
  getRefresh: () => SecureStore.getItemAsync(REFRESH_KEY),
  async set(access: string, refresh?: string) {
    await SecureStore.setItemAsync(ACCESS_KEY, access);
    if (refresh) await SecureStore.setItemAsync(REFRESH_KEY, refresh);
  },
  async clear() {
    await SecureStore.deleteItemAsync(ACCESS_KEY);
    await SecureStore.deleteItemAsync(REFRESH_KEY);
  },
};

export const api = axios.create({
  baseURL: API_URL,
  timeout: 20000,
  // lets the admin activity feed label events as coming from the app
  headers: { 'x-app-platform': Platform.OS === 'ios' ? 'iOS' : 'Android' },
});

api.interceptors.request.use(async (config) => {
  const token = await tokens.getAccess();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Access tokens live 15 minutes: on a 401, refresh once (shared across concurrent requests) and replay.
let refreshing: Promise<string | null> | null = null;
let onSessionExpired: (() => void) | null = null;
export const setSessionExpiredHandler = (fn: () => void) => { onSessionExpired = fn; };

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = await tokens.getRefresh();
  if (!refreshToken) return null;
  try {
    const res = await axios.post(`${API_URL}/auth/refresh`, { refreshToken });
    const { accessToken, refreshToken: newRefresh } = res.data.data;
    await tokens.set(accessToken, newRefresh);
    return accessToken;
  } catch {
    return null;
  }
}

api.interceptors.response.use(
  (r) => r,
  async (error: AxiosError) => {
    const original = error.config as (InternalAxiosRequestConfig & { _retried?: boolean }) | undefined;
    const isAuthCall = original?.url?.includes('/auth/login') || original?.url?.includes('/auth/refresh');
    if (error.response?.status === 401 && original && !original._retried && !isAuthCall) {
      original._retried = true;
      refreshing = refreshing ?? refreshAccessToken().finally(() => { refreshing = null; });
      const newToken = await refreshing;
      if (newToken) {
        original.headers.Authorization = `Bearer ${newToken}`;
        return api(original);
      }
      await tokens.clear();
      onSessionExpired?.();
    }
    return Promise.reject(error);
  },
);

export function errorMessage(e: unknown, fallback = 'Something went wrong'): string {
  const err = e as AxiosError<{ error?: { message?: string } }>;
  if (!err.response) return 'Cannot reach the server. Check your connection.';
  return err.response.data?.error?.message || fallback;
}

export function errorCode(e: unknown): string | undefined {
  return (e as AxiosError<{ error?: { code?: string } }>).response?.data?.error?.code;
}
