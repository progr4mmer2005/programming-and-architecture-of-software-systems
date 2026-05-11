import { create } from 'zustand';
import apiClient from '@/api/client';
import type { PermissionMap } from '@/shared/lib/access';

interface User {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  full_name: string;
  role: string;
  organization: number | null;
}

interface AuthState {
  user: User | null;
  permissions: PermissionMap | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  fetchUser: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  permissions: null,
  isAuthenticated: !!localStorage.getItem('access_token'),
  isLoading: false,

  login: async (username: string, password: string) => {
    const { data } = await apiClient.post('/auth/login/', { username, password });
    localStorage.setItem('access_token', data.access);
    localStorage.setItem('refresh_token', data.refresh);
    set({ isAuthenticated: true });
    const [userResponse, permissionsResponse] = await Promise.all([
      apiClient.get('/users/me/'),
      apiClient.get('/users/permissions/'),
    ]);
    set({ user: userResponse.data, permissions: permissionsResponse.data.permissions });
  },

  logout: () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    set({ user: null, permissions: null, isAuthenticated: false });
  },

  fetchUser: async () => {
    if (!localStorage.getItem('access_token')) return;
    set({ isLoading: true });
    try {
      const [userResponse, permissionsResponse] = await Promise.all([
        apiClient.get('/users/me/'),
        apiClient.get('/users/permissions/'),
      ]);
      set({ user: userResponse.data, permissions: permissionsResponse.data.permissions, isAuthenticated: true });
    } catch {
      set({ user: null, permissions: null, isAuthenticated: false });
    } finally {
      set({ isLoading: false });
    }
  },
}));
