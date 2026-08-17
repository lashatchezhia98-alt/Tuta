import AdminLoginForm from "./admin-login-form";

export default function AdminLoginPage() {
  return <section className="auth-page admin-auth-page"><div className="auth-panel"><a href="/" className="inner-logo"><span /><strong>თუთა</strong></a><h1>ადმინისტრაცია</h1><p>შეიყვანე საიდუმლო გარემოს ცვლადებში შენახული მონაცემები.</p><AdminLoginForm /></div><div className="auth-art"><div className="auth-moon"/><p>დაცული მართვის სივრცე</p></div></section>;
}
