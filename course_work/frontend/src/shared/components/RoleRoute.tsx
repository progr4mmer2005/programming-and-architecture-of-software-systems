import { Navigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { getFirstAllowedPath, hasPermission } from '@/shared/lib/access';

export function RoleRoute({
  permission,
  children,
}: {
  permission: string;
  children: React.ReactNode;
}) {
  const { isAuthenticated, permissions } = useAuthStore();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (!permissions) {
    return null;
  }

  if (!hasPermission(permissions, permission)) {
    return <Navigate to={getFirstAllowedPath(permissions)} replace />;
  }

  return <>{children}</>;
}
