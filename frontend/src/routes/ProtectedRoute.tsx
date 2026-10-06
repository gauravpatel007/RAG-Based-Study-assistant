import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/features/auth/AuthContext';
import { CircleBuffer } from '@/components/CircleBuffer';

/**
 * Authentication boundary – checks session before rendering protected routes.
 * Shows loading state during check, redirects to /login if expired.
 */
export default function ProtectedRoute() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg-canvas)',
      }}>
        <CircleBuffer minHeight="auto" size={44} />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
