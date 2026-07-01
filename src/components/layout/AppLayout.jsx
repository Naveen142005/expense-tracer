import { Outlet, useLocation } from "react-router-dom";
import Navbar from "./Navbar";
import AiChatbotWidget from "../ai/AiChatbotWidget";

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

      <AiChatbotWidget />
    </div>
  );
}

export default AppLayout;
