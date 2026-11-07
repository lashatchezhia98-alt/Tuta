import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import AdminFeaturePanel from "@/components/admin-feature-panel";
import { COOKIE_NAME, verifyAdminSession } from "@/lib/admin-auth";

const sections = ["features", "reports", "content", "care", "market", "tools"] as const;
type AdminSection = (typeof sections)[number];

export default async function AdminSectionPage({ params }: { params: Promise<{ section: string }> }) {
  const cookieStore = await cookies();
  const authenticated = await verifyAdminSession(cookieStore.get(COOKIE_NAME)?.value);
  if (!authenticated) redirect("/admin/login");

  const { section } = await params;
  if (!sections.includes(section as AdminSection)) notFound();
  return <AdminFeaturePanel section={section as AdminSection}/>;
}
