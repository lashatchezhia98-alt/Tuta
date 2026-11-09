import { notFound, redirect } from "next/navigation";
import AdminFeaturePanel from "@/components/admin-feature-panel";
import { getAdminIdentity } from "@/lib/platform-server";
import { adminSections, canAccessAdminSection, type AdminSection } from "@/lib/admin-sections";

export default async function AdminSectionPage({ params, searchParams }: { params: Promise<{ section: string }>; searchParams: Promise<{ q?: string | string[]; user?: string | string[] }> }) {
  const identity = await getAdminIdentity();
  if (!identity) redirect("/admin/login");

  const { section } = await params;
  if (section === "overview" || !adminSections.includes(section as AdminSection) || !canAccessAdminSection(identity.access, section as AdminSection)) notFound();
  const { q, user } = await searchParams;
  const filter = section === "users" && typeof q === "string" ? q.slice(0, 120) : section === "billing" && typeof user === "string" ? user.slice(0, 36) : "";
  return <AdminFeaturePanel key={section + filter} section={section as AdminSection} access={identity.access} initialFilter={filter}/>;
}
