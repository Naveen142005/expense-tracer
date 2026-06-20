import { useState } from "react";
import { NavLink } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../hooks/useTheme";

function Navbar() {
  const { theme, toggleTheme } = useTheme();
  const { user, logout } = useAuth();
  const [logoutLoading, setLogoutLoading] = useState(false);

  async function handleLogout() {
    try {
      setLogoutLoading(true);
      await logout();
    } catch (error) {
      console.error(error);
      alert("Failed to log out. Please try again.");
      setLogoutLoading(false);
    }
  }

  return (
    <header className="navbar">
      <div className="navbar__brand">
        <h1>Mass Madasamy</h1>
        <p>{user?.displayName || user?.email || "Daily spending manager"}</p>
      </div>

      <nav className="navbar__links" aria-label="Main navigation">
        <NavLink to="/" end>
          Add Today
        </NavLink>

        <NavLink to="/edit">Edit</NavLink>
        <NavLink to="/reports">Reports</NavLink>

        <button type="button" className="theme-toggle" onClick={toggleTheme}>
          {theme === "light" ? "Dark" : "Light"}
        </button>

        <button
          type="button"
          className="navbar__logout"
          onClick={handleLogout}
          disabled={logoutLoading}
        >
          {logoutLoading ? "Logging out..." : "Logout"}
        </button>
      </nav>
    </header>
  );
}

export default Navbar;
