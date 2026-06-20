import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

function AuthLoadingScreen() {
  return (
    <div className="auth-route-loading" role="status">
      Checking your account...
    </div>
  );
}

export function ProtectedRoute() {
  const { user, authLoading } = useAuth();
  const location = useLocation();

  if (authLoading) return <AuthLoadingScreen />;

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <Outlet />;
}

export function GuestRoute() {
  const { user, authLoading } = useAuth();

  if (authLoading) return <AuthLoadingScreen />;
  if (user) return <Navigate to="/" replace />;

  return <Outlet />;
}
