import { failure, requireUser, result } from '@/lib/platform-server';
import { premiumExpiry } from '@/lib/admin-operations';

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const {db,user}=await requireUser(request);
    const expiresAt=await premiumExpiry(db,user.id);
    return result({active:Boolean(expiresAt&&Date.parse(expiresAt)>Date.now()),expiresAt});
  }catch(error){return failure(error)}
}
