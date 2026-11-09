import { notFound, redirect } from "next/navigation";
import AdminFeaturePanel from "@/components/admin-feature-panel";
import { getAdminIdentity } from "@/lib/platform-server";

const sections = ["features", "reports", "content", "doctors", "care", "market", "orders", "tools", "website-copy", "invitations"] as const;
type AdminSection = (typeof sections)[number];

export default async function AdminSectionPage({ params }: { params: Promise<{ section: string }> }) {
  const identity = await getAdminIdentity();
  if (!identity) redirect("/admin/login");

  const { section } = await params;
  if (!sections.includes(section as AdminSection)) notFound();
  if (section === "invitations" && identity.role !== "owner") notFound();
  return <AdminFeaturePanel section={section as AdminSection} owner={identity.role === "owner"}/>;
}
