import { useState } from "react";
import { useNavigate } from "react-router-dom";
import AuthShell from "../components/auth/AuthShell";
import { useAuth } from "../context/AuthContext";
import { getAuthErrorMessage } from "../firebase/authService";

const initialForm = {
  name: "",
  email: "",
  password: "",
  confirmPassword: "",
};

function SignupPage() {
  const { googleLogin, signup } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState(initialForm);
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

    if (!form.name.trim()) {
      setError("Enter your name.");
      return;
    }

    if (form.password.length < 6) {
      setError("Password must contain at least 6 characters.");
      return;
    }

    if (form.password !== form.confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    try {
      setLoading(true);
      await signup({
        name: form.name,
        email: form.email,
        password: form.password,
      });
      navigate("/", { replace: true });
    } catch (signupError) {
      setError(getAuthErrorMessage(signupError));
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleSignup() {
    setError("");

    try {
      setGoogleLoading(true);
      await googleLogin();
      navigate("/", { replace: true });
    } catch (googleError) {
      setError(getAuthErrorMessage(googleError));
    } finally {
      setGoogleLoading(false);
    }
  }

  return (
    <AuthShell
      title="Create your account"
      subtitle="Your expenses and balance will be stored separately."
      footerText="Already have an account?"
      footerLink="/login"
      footerLabel="Log in"
    >
      <form className="auth-form" onSubmit={handleSubmit}>
        {error && <div className="auth-message auth-message--error">{error}</div>}

        <button
          className="auth-social-button"
          type="button"
          onClick={handleGoogleSignup}
          disabled={loading || googleLoading}
        >
          {googleLoading ? "Connecting to Google..." : "Continue with Google"}
        </button>

        <div className="auth-divider" aria-hidden="true">
          <span>or create with email</span>
        </div>

        <label className="auth-field">
          <span>Name</span>
          <input
            name="name"
            value={form.name}
            onChange={handleChange}
            autoComplete="name"
            placeholder="Your name"
            required
            disabled={loading || googleLoading}
          />
        </label>

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
            autoComplete="new-password"
            placeholder="At least 6 characters"
            minLength="6"
            required
            disabled={loading || googleLoading}
          />
        </label>

        <label className="auth-field">
          <span>Confirm password</span>
          <input
            type="password"
            name="confirmPassword"
            value={form.confirmPassword}
            onChange={handleChange}
            autoComplete="new-password"
            placeholder="Enter the password again"
            minLength="6"
            required
            disabled={loading || googleLoading}
          />
        </label>

        <button
          className="auth-submit"
          type="submit"
          disabled={loading || googleLoading}
        >
          {loading ? "Creating account..." : "Create account"}
        </button>
      </form>
    </AuthShell>
  );
}

export default SignupPage;
