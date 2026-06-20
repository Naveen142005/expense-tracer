import { useState } from "react";
import AuthShell from "../components/auth/AuthShell";
import { useAuth } from "../context/AuthContext";
import { getAuthErrorMessage } from "../firebase/authService";

function ForgotPasswordPage() {
  const { resetPassword } = useAuth();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setMessage("");

    try {
      setLoading(true);
      await resetPassword(email);
      setMessage("Password reset email sent. Check your inbox.");
    } catch (resetError) {
      setError(getAuthErrorMessage(resetError));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell
      title="Reset your password"
      subtitle="We will send a password reset link to your email."
      footerText="Remembered your password?"
      footerLink="/login"
      footerLabel="Back to login"
    >
      <form className="auth-form" onSubmit={handleSubmit}>
        {error && <div className="auth-message auth-message--error">{error}</div>}
        {message && <div className="auth-message auth-message--success">{message}</div>}

        <label className="auth-field">
          <span>Email</span>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            placeholder="you@example.com"
            required
            disabled={loading}
          />
        </label>

        <button className="auth-submit" type="submit" disabled={loading}>
          {loading ? "Sending..." : "Send reset link"}
        </button>
      </form>
    </AuthShell>
  );
}

export default ForgotPasswordPage;
