import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/features/auth/AuthContext';
import { LoadingSpin } from '@/components/PageState';

interface RoleRouteProps {
  role: 'parent' | 'child';
}

export function RoleRoute({ role }: RoleRouteProps) {
  const { isAuthenticated, isLoading, me } = useAuth();

  if (isLoading) return <LoadingSpin />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (me?.role !== role) {
    const redirect = me?.role === 'parent' ? '/parent' : '/child';
    return <Navigate to={redirect} replace />;
  }
  return <Outlet />;
}

export function PublicRoute() {
  const { isAuthenticated, isLoading, me } = useAuth();
  if (isLoading) return <LoadingSpin />;
  if (isAuthenticated && me) {
    return <Navigate to={me.role === 'parent' ? '/parent' : '/child'} replace />;
  }
  return <Outlet />;
}
