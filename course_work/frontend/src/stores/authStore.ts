import { create } from 'zustand';

import apiClient from '@/api/client';
import type { Invitation, OrganizationMembership } from '@/shared/types/domain';
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

interface RegisterPayload {
  username: string;
  email: string;
  password: string;
  first_name?: string;
  last_name?: string;
}

interface AuthState {
  user: User | null;
  permissions: PermissionMap | null;
  organizations: OrganizationMembership[];
  invitations: Invitation[];
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  register: (payload: RegisterPayload) => Promise<void>;
  logout: () => void;
  fetchUser: () => Promise<void>;
  switchOrganization: (organizationId: number) => Promise<void>;
  refreshInvitations: () => Promise<void>;
}

async function fetchBootstrapData() {
  const [userResponse, permissionsResponse, organizationsResponse, invitationsResponse] = await Promise.all([
    apiClient.get('/users/me/'),
    apiClient.get('/users/permissions/'),
    apiClient.get('/users/my_organizations/'),
    apiClient.get('/invitations/my/'),
  ]);

  return {
    user: userResponse.data,
    permissions: permissionsResponse.data.permissions,
    organizations: organizationsResponse.data,
    invitations: invitationsResponse.data,
  };
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  permissions: null,
  organizations: [],
  invitations: [],
  isAuthenticated: !!localStorage.getItem('access_token'),
  isLoading: false,

  login: async (username: string, password: string) => {
    const { data } = await apiClient.post('/auth/login/', { username, password });
    localStorage.setItem('access_token', data.access);
    localStorage.setItem('refresh_token', data.refresh);
    const bootstrap = await fetchBootstrapData();
    set({
      isAuthenticated: true,
      user: bootstrap.user,
      permissions: bootstrap.permissions,
      organizations: bootstrap.organizations,
      invitations: bootstrap.invitations,
    });
  },

  register: async (payload: RegisterPayload) => {
    await apiClient.post('/auth/register/', payload);
  },

  switchOrganization: async (organizationId: number) => {
    await apiClient.post('/users/switch_organization/', { organization_id: organizationId });
    const bootstrap = await fetchBootstrapData();
    set({
      user: bootstrap.user,
      permissions: bootstrap.permissions,
      organizations: bootstrap.organizations,
      invitations: bootstrap.invitations,
      isAuthenticated: true,
    });
  },

  refreshInvitations: async () => {
    const { data } = await apiClient.get('/invitations/my/');
    set({ invitations: data });
  },

  logout: () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    set({ user: null, permissions: null, organizations: [], invitations: [], isAuthenticated: false });
  },

  fetchUser: async () => {
    if (!localStorage.getItem('access_token')) return;
    set({ isLoading: true });
    try {
      const bootstrap = await fetchBootstrapData();
      set({
        user: bootstrap.user,
        permissions: bootstrap.permissions,
        organizations: bootstrap.organizations,
        invitations: bootstrap.invitations,
        isAuthenticated: true,
      });
    } catch {
      set({ user: null, permissions: null, organizations: [], invitations: [], isAuthenticated: false });
    } finally {
      set({ isLoading: false });
    }
  },
}));
