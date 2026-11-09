import type { Metadata } from "next";
import AdminInviteForm from "./invite-form";

export const metadata: Metadata = { title: "ადმინის მოწვევა | თუთა", robots: { index: false, follow: false }, referrer: "no-referrer" };

export default function AdminInvitePage() {
  return <AdminInviteForm/>;
}
