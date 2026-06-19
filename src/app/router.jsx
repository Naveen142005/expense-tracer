import { Navigate, Route, Routes } from "react-router-dom";
import AppLayout from "../components/layout/AppLayout";
import AddTodayPage from "../pages/AddTodayPage";
import EditPage from "../pages/EditPage";
import ReportsPage from "../pages/ReportsPage";

function AppRouter() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<AddTodayPage />} />
        <Route path="/edit" element={<EditPage />} />
        <Route path="/reports" element={<ReportsPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default AppRouter;