import {ApiError,checked,failure,requireAdmin,result} from '@/lib/platform-server';
import {readAdminJson} from '@/lib/admin-request';
import {canFulfill} from '@/lib/market-orders';
export const dynamic='force-dynamic';
export async function GET(request:Request){
  try{
    const db=await requireAdmin(request),params=new URL(request.url).searchParams,page=Number(params.get('page')||0);
    if(!Number.isSafeInteger(page)||page<0||page>10000)throw new ApiError(400,'არასწორი გვერდი.');
    const rows=checked(await db.from('market_orders').select('order_id,created_at,total_tetri,status,fulfillment_status,mode,recipient_name,address,latitude,longitude,items').order('created_at',{ascending:false}).order('id',{ascending:false}).range(page*20,page*20+20))||[];
    return result({orders:rows.slice(0,20),hasMore:rows.length>20});
  }catch(error){return failure(error)}
}
export async function PATCH(request:Request){
  try{
    const db=await requireAdmin(request),body=await readAdminJson(request);
    if(typeof body.orderId!=='string'||!/^tuta-market-[0-9a-f-]{36}$/i.test(body.orderId)||typeof body.next!=='string')throw new ApiError(400,'არასწორი შეკვეთა.');
    const order=checked(await db.from('market_orders').select('status,fulfillment_status').eq('order_id',body.orderId).maybeSingle());
    if(!order)throw new ApiError(404,'შეკვეთა ვერ მოიძებნა.');
    if(!canFulfill(order.fulfillment_status,body.next,order.status))throw new ApiError(409,'სტატუსის ეს ცვლილება დაუშვებელია. ჯერ გადაამოწმე გადახდა და მიმდინარე სტატუსი.');
    const saved=checked(await db.from('market_orders').update({fulfillment_status:body.next,updated_at:new Date().toISOString()}).eq('order_id',body.orderId).eq('fulfillment_status',order.fulfillment_status).eq('status',order.status).select('order_id').maybeSingle());
    if(!saved)throw new ApiError(409,'შეკვეთა პარალელურად შეიცვალა. განაახლე სია.');
    return result({ok:true});
  }catch(error){return failure(error)}
}
