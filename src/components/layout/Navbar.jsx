import { useState } from "react";
import { NavLink } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useEditLock } from "../../context/EditLockContext";
import { useTheme } from "../../hooks/useTheme";

function Navbar() {
  const { theme, toggleTheme } = useTheme();
  const { user, logout } = useAuth();
  const {
    pinConfigured,
    canEdit,
    isViewMode,
    openUnlockDialog,
    lockEditing,
    openPinSettings,
    prepareForLogout,
  } = useEditLock();
  const [logoutLoading, setLogoutLoading] = useState(false);

  async function handleLogout() {
    try {
      setLogoutLoading(true);
      prepareForLogout();
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

      <nav
        className={`navbar__links ${
          pinConfigured ? "navbar__links--pin-set" : ""
        }`}
        aria-label="Main navigation"
      >
        <NavLink to="/" end>
          Add Today
        </NavLink>

        <NavLink to="/edit">Edit</NavLink>
        <NavLink to="/reports">Reports</NavLink>

        <span
          className={
            isViewMode
              ? "edit-mode-badge edit-mode-badge--view"
              : "edit-mode-badge edit-mode-badge--editing"
          }
        >
          {isViewMode ? "View Mode" : "Editing Enabled"}
        </span>

        {pinConfigured && (
          <button
            type="button"
            className={
              canEdit
                ? "edit-lock-navbar-btn edit-lock-navbar-btn--lock"
                : "edit-lock-navbar-btn edit-lock-navbar-btn--unlock"
            }
            onClick={canEdit ? lockEditing : openUnlockDialog}
          >
            {canEdit ? "Lock Editing" : "Unlock Editing"}
          </button>
        )}

        <button
          type="button"
          className="edit-lock-navbar-btn edit-lock-navbar-btn--settings"
          onClick={openPinSettings}
        >
          {pinConfigured ? "PIN Settings" : "Set Edit PIN"}
        </button>

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
