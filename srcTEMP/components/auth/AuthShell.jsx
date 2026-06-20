import { Link } from "react-router-dom";

function AuthShell({ title, subtitle, footerText, footerLink, footerLabel, children }) {
  return (
    <main className="auth-page">
      <section className="auth-shell">
        <div className="auth-brand-panel">
          <p className="auth-brand-kicker">Mass Madasamy</p>
          <h1>Your daily spending, kept personal.</h1>
          <p>Track expenses, balances, and reports from any device.</p>
        </div>

        <div className="auth-form-panel">
          <div className="auth-form-heading">
            <h2>{title}</h2>
            <p>{subtitle}</p>
          </div>

          {children}

          {footerText && (
            <p className="auth-footer">
              {footerText} <Link to={footerLink}>{footerLabel}</Link>
            </p>
          )}
        </div>
      </section>
    </main>
  );
}

export default AuthShell;
