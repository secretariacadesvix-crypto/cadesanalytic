import { Navigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
  role?: 'admin' | 'client';
}

export function ProtectedRoute({ children, role }: ProtectedRouteProps) {
  const { user, profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (role && profile?.role !== role) {
    const dest = profile?.role === 'admin' ? '/admin' : '/portal';
    return <Navigate to={dest} replace />;
  }

  return <>{children}</>;
}
