"use client";
import { SiteCopyText } from "@/components/site-copy-provider";
import {useCallback,useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import {getSupabaseBrowserClient} from '@/lib/supabase-browser';
import {canFulfill,fulfillmentStates,fulfillmentLabels,paymentLabels,type MarketOrder} from '@/lib/market-orders';

export default function MarketOrders({lang,admin=false}:{lang:'ka'|'en';admin?:boolean}){
  const ka=lang==='ka',generation=useRef(0);
  const [orders,setOrders]=useState<MarketOrder[]>([]),[message,setMessage]=useState(''),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[page,setPage]=useState(0),[hasMore,setHasMore]=useState(false),[needsLogin,setNeedsLogin]=useState(false);
  const load=useCallback(async()=>{
    const current=++generation.current;
    try{
      const headers:Record<string,string>={};
      if(!admin){const {data:{session}}=await getSupabaseBrowserClient().auth.getSession();if(!session||session.user.is_anonymous){if(current===generation.current){setOrders([]);setNeedsLogin(true);setLoading(false)}return}headers.Authorization=`Bearer ${session.access_token}`}
      const params=new URLSearchParams({page:String(page)});
      const order=new URLSearchParams(window.location.search).get('order');
      if(!admin&&order)params.set('order',order);
      const response=await fetch(`${admin?'/api/admin/market/orders':'/api/market/orders'}?${params}`,{headers,cache:'no-store'}),body=await response.json();
      if(!response.ok)throw Error(body.error||'შეკვეთები ვერ ჩაიტვირთა.');
      if(current===generation.current){setOrders(body.orders);setHasMore(body.hasMore);setNeedsLogin(false);setMessage('')}
    }catch(e){if(current===generation.current)setMessage(e instanceof Error?e.message:'შეკვეთები ვერ ჩაიტვირთა.')}
    finally{if(current===generation.current)setLoading(false)}
  },[admin,page]);
  useEffect(()=>{
    let initial=setTimeout(()=>void load(),0);
    const returned=!admin&&new URLSearchParams(window.location.search).get('payment')==='returned';
    const timer=returned?setInterval(()=>void load(),5000):undefined;
    const stop=returned?setTimeout(()=>clearInterval(timer),90000):undefined;
    let unsubscribe=()=>{};
    if(!admin)try{const {data:{subscription}}=getSupabaseBrowserClient().auth.onAuthStateChange(event=>{if(event==='INITIAL_SESSION'||event==='TOKEN_REFRESHED')return;generation.current++;setOrders([]);setLoading(true);clearTimeout(initial);initial=setTimeout(()=>void load(),0)});unsubscribe=()=>subscription.unsubscribe()}catch{/* load reports setup failures. */}
    return()=>{generation.current++;clearTimeout(initial);clearInterval(timer);clearTimeout(stop);unsubscribe()};
  },[admin,load]);
  async function update(order:MarketOrder,next:string){
    if(!confirm(ka?'შეიცვალოს მიწოდების სტატუსი? ეს გადახდას ან თანხის დაბრუნებას არ ასრულებს.':'Change fulfillment status? This does not charge or refund a payment.'))return;
    setBusy(true);
    try{const response=await fetch('/api/admin/market/orders',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({orderId:order.order_id,next})}),body=await response.json();if(!response.ok)throw Error(body.error);await load()}
    catch(e){setMessage(e instanceof Error?e.message:'ვერ შეინახა.')}
    finally{setBusy(false)}
  }
  return <section className="workspace-card order-history"><h2>{admin?(ka?'შეკვეთების მართვა':'Manage orders'):(<SiteCopyText id="orders.title" lang={lang}/>)}</h2><p>{admin ? (ka?'სატესტო შეკვეთები. გადახდისა და მიწოდების სტატუსები განცალკევებულია.':'Test orders. Payment and delivery status are separate.') : <SiteCopyText id="orders.intro" lang={lang}/>}</p><button type="button" disabled={busy||loading} onClick={()=>void load()}>{ka?'სტატუსის განახლება':'Refresh status'}</button>{message&&<p role="alert">{message}</p>}{loading?<p role="status">{ka?'იტვირთება…':'Loading…'}</p>:needsLogin?<p><Link href="/login?next=%2Fmarket%2Forders">{ka?'შედი შეკვეთების სანახავად':'Sign in to see orders'}</Link></p>:!orders.length?<p>{ka?'შეკვეთა ჯერ არ მოიძებნა. თუ გადახდიდან დაბრუნდი, განაახლე სტატუსი.':'No orders found yet. If you just returned from checkout, refresh the status.'}</p>:orders.map(order=><article className="order-card" key={order.order_id}><h3>{order.order_id}</h3><p>{new Date(order.created_at).toLocaleString(ka?'ka-GE':'en-GB')} · {(order.total_tetri/100).toFixed(2)} ₾</p><p role="status">{ka?'გადახდა':'Payment'}: {paymentLabels[order.status]?.[ka?0:1]||order.status} · {ka?'მიწოდება':'Delivery'}: {fulfillmentLabels[order.fulfillment_status]?.[ka?0:1]||order.fulfillment_status}</p><ul>{order.items.map((item,i)=><li key={i}>{item.name} × {item.quantity} · {(item.price_tetri*item.quantity/100).toFixed(2)} ₾</li>)}</ul><p>{order.recipient_name} · {order.address}</p>{order.latitude!==null&&order.longitude!==null&&<a href={`https://www.openstreetmap.org/?mlat=${order.latitude}&mlon=${order.longitude}#map=16/${order.latitude}/${order.longitude}`} target="_blank" rel="noreferrer"><SiteCopyText id="orders.pin" lang={lang}/></a>}{admin&&<div className="order-actions">{fulfillmentStates.filter(next=>canFulfill(order.fulfillment_status,next,order.status)).map(next=><button key={next} type="button" disabled={busy} onClick={()=>void update(order,next)}>{fulfillmentLabels[next][ka?0:1]}</button>)}<small>{ka?'გაუქმება თანხას ავტომატურად არ აბრუნებს. გადახდის დაბრუნება პროვაიდერთან ცალკე მუშავდება.':'Cancellation does not automatically refund payment. Refunds must be handled separately with the provider.'}</small></div>}</article>)}<div className="order-pagination"><button type="button" disabled={page===0||busy} onClick={()=>setPage(p=>p-1)}>{ka?'წინა':'Previous'}</button><span>{page+1}</span><button type="button" disabled={!hasMore||busy} onClick={()=>setPage(p=>p+1)}>{ka?'შემდეგი':'Next'}</button></div>{!admin&&<Link href="/market"><SiteCopyText id="orders.back" lang={lang}/></Link>}</section>;
}
