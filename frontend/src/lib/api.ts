import axios, { AxiosInstance, AxiosError } from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';

const api: AxiosInstance = axios.create({
  baseURL: API_URL,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
  timeout: 30000,
});

// Request interceptor — attach access token
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('accessToken');
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor — handle token refresh with mutex to prevent race conditions
let isRefreshing = false;
let failedQueue: Array<{ resolve: (token: string) => void; reject: (err: unknown) => void }> = [];

const processQueue = (error: unknown, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) prom.reject(error);
    else prom.resolve(token!);
  });
  failedQueue = [];
};

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as (typeof error.config & { _retry?: boolean });

    if (error.response?.status === 401 && !originalRequest._retry) {
      // Only attempt refresh if the user was previously authenticated.
      // Unauthenticated visitors browsing public pages should not trigger session-expired.
      const hadToken = typeof window !== 'undefined' && !!localStorage.getItem('accessToken');
      if (!hadToken) {
        return Promise.reject(error);
      }

      if (isRefreshing) {
        // Queue this request until the ongoing refresh completes
        return new Promise<string>((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            if (originalRequest.headers) originalRequest.headers.Authorization = `Bearer ${token}`;
            return api(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const response = await axios.post(`${API_URL}/auth/refresh`, {}, { withCredentials: true });
        const { accessToken } = response.data.data;
        localStorage.setItem('accessToken', accessToken);
        if (originalRequest.headers) originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        processQueue(null, accessToken);
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        localStorage.removeItem('accessToken');
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('auth:session-expired'));
        }
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }
    return Promise.reject(error);
  }
);

export default api;

// ── Auth ──────────────────────────────────────────────────────────────────────
export const authAPI = {
  login: (data: { email: string; password: string }) => api.post('/auth/login', data),
  logout: () => api.post('/auth/logout'),
  verifyEmail: (data: { email: string; otp: string }) => api.post('/auth/verify-email', data),
  resendOtp: (email: string) => api.post('/auth/resend-otp', { email }),
  forgotPassword: (email: string) => api.post('/auth/forgot-password', { email }),
  resetPassword: (data: Record<string, string>) => api.post('/auth/reset-password', data),
  getMe: () => api.get('/auth/me'),
  refresh: () => api.post('/auth/refresh'),
  updateRole: (role: string) => api.patch('/auth/update-role', { role }),
  devLogin: () => api.post('/auth/dev-login'),
  sendEmailOtp: (email: string) => api.post('/auth/email/send-otp', { email }),
  verifyEmailOtp: (email: string, otp: string) => api.post('/auth/email/verify-otp', { email, otp }),
  sendPhoneOtp: (phone: string) => api.post('/auth/phone/send-otp', { phone }),
  verifyPhoneOtp: (phone: string, otp: string) => api.post('/auth/phone/verify-otp', { phone, otp }),
  changePassword: (data: { currentPassword: string; newPassword: string }) => api.post('/auth/change-password', data),
  deleteAccount: () => api.delete('/auth/account'),
};

// ── Profiles ──────────────────────────────────────────────────────────────────
export const profileAPI = {
  getAthleteProfile: (id: string) => api.get(`/profiles/athlete/${id}`),
  getMyAthleteProfile: () => api.get('/profiles/athlete/me'),
  updateAthleteProfile: (data: Record<string, unknown>) => api.patch('/profiles/athlete', data),
  downloadAthleteCV: (id: string) => api.get(`/profiles/athlete/${id}/cv`, { responseType: 'blob' }),
};

// ── Admin ─────────────────────────────────────────────────────────────────────
export const adminAPI = {
  getDashboard: () => api.get('/admin/dashboard'),
  getUsers: (params?: Record<string, unknown>) => api.get('/admin/users', { params }),
  createUser: (data: Record<string, unknown>) => api.post('/admin/users', data),
  updateUser: (id: string, data: Record<string, unknown>) => api.patch(`/admin/users/${id}`, data),
  deleteUser: (id: string) => api.delete(`/admin/users/${id}`),
  suspendUser: (id: string) => api.patch(`/admin/users/${id}/suspend`),
  getCvStats: () => api.get('/admin/cv/stats'),
  getCvUsers: (params?: Record<string, unknown>) => api.get('/admin/cv/users', { params }),
  exportCvUsers: (params?: Record<string, unknown>) => api.get('/admin/cv/users/export', { params, responseType: 'blob' }),
  updateCvUser: (profileId: string, data: Record<string, unknown>) => api.patch(`/admin/cv/users/${profileId}`, data),
  getCvActivity: (params?: Record<string, unknown>) => api.get('/admin/cv/activity', { params }),

  // full management
  getUser: (id: string) => api.get(`/admin/users/${id}`),
  updateProfile: (kind: 'athlete' | 'coach' | 'organization', id: string, data: Record<string, unknown>) =>
    api.patch(`/admin/profiles/${kind}/${id}`, data),
  getSettings: () => api.get('/admin/settings'),
  updateSettings: (data: Record<string, unknown>) => api.put('/admin/settings', data),
};

/** Public site/app settings managed in the admin panel (banner, maintenance notice, sports list). */
export const settingsAPI = { get: () => api.get('/settings') };

// ── Activity events (CV sprint) ───────────────────────────────────────────────
export const eventAPI = {
  log: (eventType: 'SPORT_SELECTED' | 'PDF_DOWNLOADED' | 'STORY_CARD_EXPORTED' | 'PROFILE_SHARED', data: { sport?: string; format?: string } = {}) =>
    api.post('/events', { eventType, ...data }).catch(() => undefined), // analytics must never block the user
};
// ── Upload ──────────────────────────────────────────────────────────────────
export const uploadAPI = {
  uploadImage: (file: File) => {
    const formData = new FormData();
    formData.append('image', file);
    // Axios 1.x auto-appends the multipart boundary when Content-Type is set this way
    return api.post('/upload/image', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
};
