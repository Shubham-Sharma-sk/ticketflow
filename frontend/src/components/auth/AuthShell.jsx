export default function AuthShell({ title, subtitle, children, footer }) {
  return (
    <section className="auth-layout">
      <div className="auth-card">
        <div className="brand-row">
          <span className="brand-dot" />
          <span className="brand-name">TicketFlow</span>
        </div>

        <div className="auth-header">
          <span className="auth-chip">Secure Access</span>
          <h1>{title}</h1>
          <p>{subtitle}</p>
        </div>

        <div className="divider" />
        <div className="auth-subheader">
          <h1>Real-Time Ticket Booking</h1>
          <p>{title === "Sign in" ? "Login to continue" : "Register to continue"}</p>
        </div>

        {children}
        {footer}
        <p className="legal-line">By continuing, you agree to secure booking policies.</p>
      </div>
    </section>
  );
}
