import { Outlet, useLocation } from "react-router-dom";
import Navbar from "./Navbar";

function AppLayout() {
  const location = useLocation();
  const isReportsPage = location.pathname.startsWith("/reports");

  return (
    <div className="app">
      <Navbar />

      <main
        className={
          isReportsPage
            ? "page-container page-container--reports"
            : "page-container"
        }
      >
        <Outlet />
      </main>
    </div>
  );
}

export default AppLayout;
