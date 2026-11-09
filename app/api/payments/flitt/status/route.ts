import { ApiError, checked, failure, requireUser, result } from '@/lib/platform-server';
import { premiumExpiry } from '@/lib/admin-operations';
import { readAdminJson } from "@/lib/admin-request";
import { flittEnvironment, setFlittRenewal } from "@/lib/flitt";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const {db,user}=await requireUser(request);
    const [expiresAt, paid, subscription] = await Promise.all([
      premiumExpiry(db,user.id),
      db.from("premium_memberships").select("expires_at").eq("user_id",user.id).maybeSingle(),
      db.from("premium_payments").select("renewal_state,plan,status").eq("user_id",user.id)
        .not("renewal_state","is",null).order("created_at",{ascending:false}).limit(1).maybeSingle(),
    ]);
    const paidUntil = checked(paid)?.expires_at || null;
    const renewal = checked(subscription);
    const renewalState = renewal?.renewal_state || null;
    const paidActive = Boolean(paidUntil && Date.parse(paidUntil) > Date.now());
    return result({
      active: Boolean(expiresAt && Date.parse(expiresAt) > Date.now()), expiresAt,
      paidUntil, renewalState, renewalPlan: renewal?.plan ?? null,
      purchaseBlocked: paidActive || ["active","starting","stopping"].includes(renewalState),
      canResume: paidActive && renewal?.status === "approved",
    });
  }catch(error){return failure(error)}
}

export async function PATCH(request: Request) {
  try {
    const { db, user } = await requireUser(request);
    if (!flittEnvironment()) throw new ApiError(503, "Flitt-ის სატესტო გამოწერა მიუწვდომელია.");
    const input = await readAdminJson(request, 512).catch(() => null);
    if (typeof input?.enabled !== "boolean") throw new ApiError(400, "აირჩიე ავტომატური განახლების მდგომარეობა.");
    const enabled = input.enabled;
    const change = checked(await db.rpc("begin_premium_renewal_change", { p_user_id: user.id, p_enabled: enabled }));
    if (change?.code === "unchanged") return result({ renewalState: change.state });
    if (change?.code === "busy") throw new ApiError(409, "წინა ცვლილება ჯერ მოწმდება. ცოტა ხანში სცადე ისევ.");
    if (change?.code !== "ready") throw new ApiError(409, "ავტომატური განახლების ჩასართავად საჭიროა მოქმედი Flitt-ის გამოწერა.");
    let confirmed = false;
    try { confirmed = await setFlittRenewal(change.orderId, enabled); }
    catch { /* Keep the operation pending until the same intent is retried. */ }
    if (!confirmed) throw new ApiError(502, "Flitt-ს ცვლილება ჯერ არ დაუდასტურებია. ცოტა ხანში იგივე მოქმედება გაიმეორე.");
    const saved = checked(await db.from("premium_payments").update({ renewal_state: change.state })
      .eq("order_id",change.orderId).eq("user_id",user.id).eq("renewal_state",change.pending).select("order_id").maybeSingle());
    if (!saved) throw new ApiError(409, "ცვლილების სტატუსი განაახლე.");
    return result({ renewalState: change.state });
  } catch (error) { return failure(error); }
}
