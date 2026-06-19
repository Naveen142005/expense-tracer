import { NavLink } from "react-router-dom";
import { useTheme } from "../../hooks/useTheme";

function Navbar() {
  const { theme, toggleTheme } = useTheme();

  return (
    <header className="navbar">
      <div className="navbar__brand">
        <h1>Mass Madasamy </h1>
        <p>Daily spending manager</p>
      </div>

      <nav className="navbar__links">
        <NavLink to="/" end>
          Add Today
        </NavLink>

        <NavLink to="/edit">
          Edit
        </NavLink>

        <NavLink to="/reports">
          Reports
        </NavLink>

        <button
          type="button"
          className="theme-toggle"
          onClick={toggleTheme}
        >
          {theme === "light" ? "Dark" : "Light"}
        </button>
      </nav>
    </header>
  );
}

export default Navbar;