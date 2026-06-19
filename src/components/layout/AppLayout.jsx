import { Outlet } from "react-router-dom";
import Navbar from "./Navbar";

function AppLayout() {
  return (
    <div className="app">
      <Navbar />

      <main className="page-container">
        <Outlet />
      </main>
    </div>
  );
}

export default AppLayout;