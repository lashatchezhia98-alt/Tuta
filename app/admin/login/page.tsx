import type { Metadata } from "next";
import Link from "next/link";
import AdminLoginForm from "./admin-login-form";
import BrandMark from '@/components/brand-mark';

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function AdminLoginPage() {
  return <section className="auth-page admin-auth-page"><div className="auth-panel"><Link href="/" className="inner-logo"><BrandMark/><strong>თუთა</strong></Link><h1>ადმინისტრაცია</h1><p>შედი ადმინის ელფოსტითა და პაროლით.</p><AdminLoginForm /></div><div className="auth-art"><div className="auth-moon"/><p>დაცული მართვის სივრცე</p></div></section>;
}
