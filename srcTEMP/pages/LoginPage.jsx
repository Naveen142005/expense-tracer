import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import AuthShell from "../components/auth/AuthShell";
import { useAuth } from "../context/AuthContext";
import { getAuthErrorMessage } from "../firebase/authService";

function LoginPage() {
  const { googleLogin, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  function handleChange(event) {
    const { name, value } = event.target;
    setForm((previous) => ({ ...previous, [name]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");

    try {
      setLoading(true);
      await login(form);
      navigate(location.state?.from?.pathname || "/", { replace: true });
    } catch (loginError) {
      setError(getAuthErrorMessage(loginError));
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleLogin() {
    setError("");

    try {
      setGoogleLoading(true);
      await googleLogin();
      navigate(location.state?.from?.pathname || "/", { replace: true });
    } catch (googleError) {
      setError(getAuthErrorMessage(googleError));
    } finally {
      setGoogleLoading(false);
    }
  }

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Log in to access your expense tracker."
      footerText="New here?"
      footerLink="/signup"
      footerLabel="Create an account"
    >
      <form className="auth-form" onSubmit={handleSubmit}>
        {error && <div className="auth-message auth-message--error">{error}</div>}

        <button
          className="auth-social-button"
          type="button"
          onClick={handleGoogleLogin}
          disabled={loading || googleLoading}
        >
          {googleLoading ? "Connecting to Google..." : "Continue with Google"}
        </button>

        <div className="auth-divider" aria-hidden="true">
          <span>or use email</span>
        </div>

        <label className="auth-field">
          <span>Email</span>
          <input
            type="email"
            name="email"
            value={form.email}
            onChange={handleChange}
            autoComplete="email"
            placeholder="you@example.com"
            required
            disabled={loading || googleLoading}
          />
        </label>

        <label className="auth-field">
          <span>Password</span>
          <input
            type="password"
            name="password"
            value={form.password}
            onChange={handleChange}
            autoComplete="current-password"
            placeholder="Enter your password"
            required
            disabled={loading || googleLoading}
          />
        </label>

        <div className="auth-form-row">
          <Link to="/forgot-password">Forgot password?</Link>
        </div>

        <button
          className="auth-submit"
          type="submit"
          disabled={loading || googleLoading}
        >
          {loading ? "Logging in..." : "Log in"}
        </button>
      </form>
    </AuthShell>
  );
}

export default LoginPage;
