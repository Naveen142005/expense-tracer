import { Navigate, Route, Routes } from "react-router-dom";
import { GuestRoute, ProtectedRoute } from "../components/auth/RouteGuards";
import AppLayout from "../components/layout/AppLayout";
import AddTodayPage from "../pages/AddTodayPage";
import EditPage from "../pages/EditPage";
import ForgotPasswordPage from "../pages/ForgotPasswordPage";
import LoginPage from "../pages/LoginPage";
import ReportsPage from "../pages/ReportsPage";
import SignupPage from "../pages/SignupPage";

function AppRouter() {
  return (
    <Routes>
      <Route element={<GuestRoute />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      </Route>

      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route path="/" element={<AddTodayPage />} />
          <Route path="/edit" element={<EditPage />} />
          <Route path="/reports" element={<ReportsPage />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default AppRouter;
