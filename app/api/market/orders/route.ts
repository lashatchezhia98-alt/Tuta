import {checked,failure,requireUser,result,ApiError} from '@/lib/platform-server';
export const dynamic='force-dynamic';
export async function GET(request:Request){
  try{
    const {db,user}=await requireUser(request);
    const params=new URL(request.url).searchParams,order=params.get('order'),page=Number(params.get('page')||0);
    if(!Number.isSafeInteger(page)||page<0||page>10000)throw new ApiError(400,'არასწორი გვერდი.');
    let query=db.from('market_orders').select('order_id,created_at,total_tetri,status,fulfillment_status,mode,recipient_name,address,latitude,longitude,items').eq('user_id',user.id).order('created_at',{ascending:false}).order('id',{ascending:false});
    if(order){if(!/^tuta-market-[0-9a-f-]{36}$/i.test(order))throw new ApiError(400,'არასწორი შეკვეთა.');query=query.eq('order_id',order)}
    const orders=checked(await query.range(page*20,page*20+20))||[];
    return result({orders:orders.slice(0,20),hasMore:orders.length>20});
  }catch(error){return failure(error)}
}
