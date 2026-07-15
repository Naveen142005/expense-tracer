import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import AppIcon from "../common/AppIcon";
import ProfileAvatar from "../profile/ProfileAvatar";
import { useAuth } from "../../context/AuthContext";
import { useEditLock } from "../../context/EditLockContext";
import { useFeedback } from "../../context/FeedbackContext";
import { useTheme } from "../../hooks/useTheme";
import { hasUnsavedTodayDraft } from "../../utils/draftStorage";

const navItems = [
  { to: "/", label: "Add Today", icon: "wallet", end: true },
  { to: "/edit", label: "Edit", icon: "calendar" },
  { to: "/reports", label: "Reports", icon: "trend" },
];

function Navbar() {
  const { theme, toggleTheme } = useTheme();
  const { notify, confirmAction } = useFeedback();
  const { user, logout } = useAuth();
  const { prepareForLogout } = useEditLock();
  const navigate = useNavigate();
  const location = useLocation();
  const profileMenuRef = useRef(null);
  const profileDropdownRef = useRef(null);
  const profileButtonRef = useRef(null);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [profileMenuPosition, setProfileMenuPosition] = useState(null);
  const [logoutLoading, setLogoutLoading] = useState(false);
  const activeNavIndex = location.pathname.startsWith("/edit")
    ? 1
    : location.pathname.startsWith("/reports")
    ? 2
    : 0;

  useEffect(() => {
    if (!profileMenuOpen) return undefined;

    function handlePointerDown(event) {
      const clickedTrigger = profileMenuRef.current?.contains(event.target);
      const clickedDropdown = profileDropdownRef.current?.contains(event.target);

      if (!clickedTrigger && !clickedDropdown) {
        setProfileMenuOpen(false);
      }
    }

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        setProfileMenuOpen(false);
        profileButtonRef.current?.focus();
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [profileMenuOpen]);

  useEffect(() => {
    if (!profileMenuOpen) return undefined;

    function updateProfileMenuPosition() {
      const button = profileButtonRef.current;
      const navbar = button?.closest(".navbar");
      if (!button || !navbar) return;

      const buttonRect = button.getBoundingClientRect();
      const navbarRect = navbar.getBoundingClientRect();
      const mobileLayout = window.matchMedia("(max-width: 820px)").matches;

      setProfileMenuPosition({
        top: Math.round((mobileLayout ? navbarRect.bottom : buttonRect.bottom) + 8),
        right: Math.max(12, Math.round(window.innerWidth - buttonRect.right)),
      });
    }

    const animationFrame = window.requestAnimationFrame(updateProfileMenuPosition);
    window.addEventListener("resize", updateProfileMenuPosition);
    window.addEventListener("scroll", updateProfileMenuPosition, true);

    return () => {
      window.cancelAnimationFrame(animationFrame);
      window.removeEventListener("resize", updateProfileMenuPosition);
      window.removeEventListener("scroll", updateProfileMenuPosition, true);
    };
  }, [profileMenuOpen]);

  async function handleLogout() {
    if (hasUnsavedTodayDraft()) {
      const leaveDraft = await confirmAction({
        title: "Unsaved draft items",
        message: "Your current draft has not been submitted. Log out and leave it on this device?",
        confirmText: "Logout Anyway",
        cancelText: "Keep Working",
        tone: "danger",
      });
      if (!leaveDraft) return;
    } else {
      const confirmed = await confirmAction({
        title: "Log out of your account?",
        message: "Your submitted expenses remain safely stored in Firebase.",
        confirmText: "Logout",
        cancelText: "Stay Logged In",
        tone: "danger",
      });
      if (!confirmed) return;
    }

    try {
      setLogoutLoading(true);
      prepareForLogout();
      await logout();
    } catch (error) {
      console.error(error);
      notify({
        type: "error",
        title: "Logout failed",
        message: "Please try again.",
      });
      setLogoutLoading(false);
    }
  }

  return (
    <header className="navbar">
      <NavLink to="/" className="navbar__brand" aria-label="Go to Add Today">
        <span className="navbar__brand-mark" aria-hidden="true">
          <AppIcon name="wallet" size={22} />
        </span>
        <span className="navbar__brand-copy">
          <strong>Naveen&apos;s Tracker</strong>
          <small>Personal expense workspace</small>
        </span>
      </NavLink>

      <nav
        className="navbar__primary"
        aria-label="Main navigation"
        data-active-index={activeNavIndex}
      >
        <span className="navbar__mobile-indicator" aria-hidden="true" />
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            onClick={() => setProfileMenuOpen(false)}
          >
            <AppIcon name={item.icon} size={17} />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="navbar__utilities">
        <button
          type="button"
          className="navbar__utility-btn"
          onClick={toggleTheme}
          aria-label={`Switch to ${theme === "light" ? "dark" : "light"} theme`}
          title={`Switch to ${theme === "light" ? "dark" : "light"} theme`}
        >
          <AppIcon name={theme === "light" ? "moon" : "sun"} size={18} />
        </button>

        <div ref={profileMenuRef} className="navbar-profile">
          <button
            ref={profileButtonRef}
            type="button"
            className={`navbar-profile__trigger${
              profileMenuOpen ? " navbar-profile__trigger--active" : ""
            }`}
            onClick={() => {
              if (!profileMenuOpen) setProfileMenuPosition(null);
              setProfileMenuOpen((current) => !current);
            }}
            aria-haspopup="menu"
            aria-expanded={profileMenuOpen}
            aria-controls="navbar-profile-menu"
          >
            <ProfileAvatar user={user} size="sm" />
          </button>

          {profileMenuOpen && typeof document !== "undefined"
            ? createPortal(
                <section
                  ref={profileDropdownRef}
                  id="navbar-profile-menu"
                  className="navbar-profile__menu navbar-profile__menu--portal"
                  role="menu"
                  aria-label="Profile menu"
                  style={{
                    position: "fixed",
                    top: profileMenuPosition?.top ?? 0,
                    right: profileMenuPosition?.right ?? 12,
                    bottom: "auto",
                    left: "auto",
                    zIndex: 1320,
                    visibility: profileMenuPosition ? "visible" : "hidden",
                  }}
                >
                  <header className="navbar-profile__summary">
                    <ProfileAvatar user={user} size="lg" />
                    <div>
                      <strong>{user?.displayName || "My account"}</strong>
                      <span>{user?.email}</span>
                    </div>
                  </header>

                  <div className="navbar-profile__actions">
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setProfileMenuOpen(false);
                        navigate("/profile");
                      }}
                    >
                      Profile
                    </button>

                    <button
                      type="button"
                      role="menuitem"
                      className="navbar-profile__logout"
                      onClick={handleLogout}
                      disabled={logoutLoading}
                    >
                      {logoutLoading ? "Logging out…" : "Logout"}
                    </button>
                  </div>
                </section>,
                document.body
              )
            : null}
        </div>
      </div>
    </header>
  );
}

export default Navbar;
