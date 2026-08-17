import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { COOKIE_NAME, verifyAdminSession } from "@/lib/admin-auth";
import InnerPage from "../inner-page";

export default async function Page() {
  const cookieStore = await cookies();
  const authenticated = await verifyAdminSession(cookieStore.get(COOKIE_NAME)?.value);
  if (!authenticated) redirect("/admin/login");
  return <InnerPage kind="admin"/>;
}
