import { checked, failure, requireUser, result } from '@/lib/platform-server';

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const {db,user}=await requireUser(request);
    const member=checked(await db.from('premium_memberships').select('expires_at').eq('user_id',user.id).maybeSingle());
    const expiresAt=member?.expires_at||null;
    return result({active:Boolean(expiresAt&&Date.parse(expiresAt)>Date.now()),expiresAt});
  }catch(error){return failure(error)}
}
