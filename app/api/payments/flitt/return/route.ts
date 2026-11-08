import {NextResponse} from 'next/server';
export const dynamic='force-dynamic';
// A browser return is navigation only. Never trust it as proof of payment.
// Flitt's signed server callback remains the only writer of payment status.
function redirect(request:Request){
  const params=new URL(request.url).searchParams;
  const market=params.get('type')==='market';
  const target=new URL(market?'/market/orders':'/premium',request.url);
  target.searchParams.set('payment','returned');
  const order=params.get('order');
  if(market&&order&&/^tuta-market-[0-9a-f-]{36}$/i.test(order))target.searchParams.set('order',order);
  const response=NextResponse.redirect(target,303);
  response.headers.set('Cache-Control','private, no-store');
  return response;
}
export const GET=redirect;
export const POST=redirect;
