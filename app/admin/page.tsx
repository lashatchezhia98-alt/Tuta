import { redirect } from "next/navigation";
import { getAdminIdentity } from "@/lib/platform-server";
import AdminFeaturePanel from "@/components/admin-feature-panel";

export default async function Page() {
  const identity = await getAdminIdentity();
  if (!identity) redirect("/admin/login");
  return <AdminFeaturePanel section="overview" owner={identity.role === "owner"}/>;
}
