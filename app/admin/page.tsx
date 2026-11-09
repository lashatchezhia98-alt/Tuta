import { redirect } from "next/navigation";
import { getAdminIdentity } from "@/lib/platform-server";
import AdminFeaturePanel from "@/components/admin-feature-panel";
import { adminHome } from "@/lib/admin-sections";

export default async function Page() {
  const identity = await getAdminIdentity();
  if (!identity) redirect("/admin/login");
  const home = adminHome(identity.access);
  if (home !== "/admin") redirect(home);
  return <AdminFeaturePanel section="overview" access={identity.access}/>;
}
