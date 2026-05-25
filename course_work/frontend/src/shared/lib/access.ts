export type PermissionMap = Record<string, boolean>;

export interface AccessEntry {
  permission: string;
  path: string;
}

export const primaryAccessOrder: AccessEntry[] = [
  { permission: 'can_view_dashboard', path: '/' },
  { permission: 'can_view_contracts', path: '/contracts' },
  { permission: 'can_view_approvals', path: '/approvals' },
  { permission: 'can_view_payments', path: '/payments' },
  { permission: 'can_view_estimates', path: '/estimates' },
  { permission: 'can_view_contractors', path: '/contractors' },
  { permission: 'can_view_organization', path: '/organization' },
  { permission: 'can_view_calendar', path: '/calendar' },
  { permission: 'can_view_reports', path: '/reports' },
  { permission: 'can_view_templates', path: '/templates' },
];

export function hasPermission(permissions: PermissionMap | null | undefined, key: string) {
  return Boolean(permissions?.[key]);
}

export function getFirstAllowedPath(permissions: PermissionMap | null | undefined) {
  return primaryAccessOrder.find((entry) => hasPermission(permissions, entry.permission))?.path || '/workspace';
}
