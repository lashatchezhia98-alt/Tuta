import test from 'node:test';
import assert from 'node:assert/strict';
import {sourceModule} from './source-loader.mjs';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';

const tick=()=>new Promise(resolve=>setImmediate(resolve));
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve}};
test('private sharing and pregnancy forms remount on account changes, not token refreshes',()=>{
 for(const file of ['partner-workspace','pregnancy-workspace']){
  let id='A',token='A1';
  const Component=sourceModule(`components/${file}.tsx`,{'@/app/use-health-state':{useHealthState:()=>({session:id?{user:{id},access_token:token}:null})}}).default;
  const render=()=>Component({lang:'en'});
  const first=render();assert.equal(first.key,'A');token='A2';assert.equal(render().key,first.key);
  id='B';assert.equal(render().key,'B');id=null;assert.equal(render().key,'guest');
 }
});
test('late consultation actions cannot restore an old account conversation or draft',async()=>{
 const slots=[],effects=[];let cursor=0,authCallback,user='A';const request=deferred(),oldFetch=globalThis.fetch;
 const react={useState(initial){const i=cursor++;if(!(i in slots))slots[i]=initial;return [slots[i],value=>{slots[i]=typeof value==='function'?value(slots[i]):value}]},useRef(initial){return slots[cursor++]??={current:initial}},useCallback(fn){cursor++;return fn},useEffect(fn){cursor++;effects.push(fn)}};
 const client={auth:{getSession:async()=>({data:{session:{user:{id:user},access_token:user}}}),onAuthStateChange(cb){authCallback=cb;return {data:{subscription:{unsubscribe(){}}}}}}};
 globalThis.fetch=async(_url,options)=>options.method==='POST'?request.promise:{ok:true,json:async()=>({userId:user,doctors:[],slots:[],threads:[],bookings:[],premium:true})};
 const Component=sourceModule('components/care-workspace.tsx',{react,'@/lib/supabase-browser':{getSupabaseBrowserClient:()=>client},'@/lib/site-features':{useSiteFeatures:()=>({doctorConsultation:true})}}).default;
 const render=()=>{cursor=0;effects.length=0;return Component({lang:'en'})};
 const nodes=(tree,type)=>!tree||typeof tree!=='object'?[]:[...(tree.type===type?[tree]:[]),...[tree.props?.children].flat(Infinity).flatMap(node=>nodes(node,type))];
 let cleanup;
 try{
  render();cleanup=effects[0]();slots[0]={userId:'A',doctors:[{user_id:'doctor',verified_doctors:{first_name:'Test',last_name:'Doctor'}}],slots:[],threads:[],bookings:[],premium:true};slots[3]='private A draft';
  nodes(render(),'button').find(b=>b.props.children?.props?.id==='care.startChat').props.onClick();await tick();user='B';authCallback('SIGNED_IN',{user:{id:'B'}});assert.equal(slots[3],'');request.resolve({ok:true,json:async()=>({thread:{id:'A-private-thread'}})});await tick();assert.equal(slots[2],'');assert.equal(slots[6],'');
 }finally{cleanup?.();globalThis.fetch=oldFetch}
});
function hookHarness({readDelay=false}={}){
 const slots=[],effects=[];let cursor=0,authCallback,currentUser='A',pendingWrite;
 const payload=id=>({version:1,lang:'ka',name:id,cycleLength:28,periods:[],logs:[]});
 const delayedRead=deferred();
 const react={
  useState(initial){const i=cursor++;if(!(i in slots))slots[i]=typeof initial==='function'?initial():initial;return [slots[i],value=>{slots[i]=typeof value==='function'?value(slots[i]):value}]},
  useRef(initial){const i=cursor++;return slots[i]??=( {current:initial})},
  useCallback(fn,deps){const i=cursor++;if(!slots[i]||deps.some((v,k)=>!Object.is(v,slots[i].deps[k])))slots[i]={fn,deps};return slots[i].fn},
  useEffect(fn,deps){const i=cursor++;if(!slots[i]||deps.some((v,k)=>!Object.is(v,slots[i].deps[k]))){const previous=slots[i];slots[i]={deps,cleanup:previous?.cleanup};effects.push(()=>{previous?.cleanup?.();slots[i].cleanup=fn()})}},
 };
 const session=id=>id?{user:{id},access_token:`token-${id}`}:null;
 const client={auth:{getSession:async()=>({data:{session:session(currentUser)}}),onAuthStateChange(cb){authCallback=cb;return {data:{subscription:{unsubscribe(){}}}}}},from(){let id,write=false;const chain={select(){return chain},eq(_key,value){if(_key==='user_id')id=value;return chain},insert(){write=true;return chain},update(){write=true;return chain},maybeSingle(){return chain},single(){return chain},then(resolve){if(write){pendingWrite=deferred();return pendingWrite.promise.then(resolve)}if(readDelay&&id==='A')return delayedRead.promise.then(resolve);return Promise.resolve({data:{payload:payload(id),revision:1},error:null}).then(resolve)}};return chain},channel(){const chain={on(){return chain},subscribe(){return chain}};return chain},removeChannel(){}};
 const savedWindow=globalThis.window,savedStorage=globalThis.localStorage;
 globalThis.window={addEventListener(){},removeEventListener(){}};globalThis.localStorage={getItem(){return null},removeItem(){}};
 const {useHealthState}=sourceModule('app/use-health-state.ts',{react,'../lib/supabase-browser':{getSupabaseBrowserClient:()=>client}});
 const render=()=>{cursor=0;const value=useHealthState();effects.splice(0).forEach(fn=>fn());return value};
 return {render,payload,async init(){render();await tick();render();await tick();return render()},change(id){currentUser=id;authCallback('SIGNED_IN',session(id))},finishWrite(){pendingWrite.resolve({data:{revision:2},error:null})},finishRead(){delayedRead.resolve({data:{payload:payload('A'),revision:1},error:null})},restore(){globalThis.window=savedWindow;globalThis.localStorage=savedStorage}};
}
test('late health save cannot replace records after account A → B',async()=>{
 const h=hookHarness();try{let state=await h.init();assert.equal(state.data.name,'A');const saving=state.save({...state.data,name:'A changed'});h.change('B');h.render();await tick();state=h.render();assert.equal(state.data.name,'B');h.finishWrite();await assert.rejects(saving,/Account changed/);assert.equal(h.render().data.name,'B')}finally{h.restore()}
});
test('health generation rejects an old save after A → B → A and signout clears records',async()=>{
 const h=hookHarness();try{let state=await h.init();const saving=state.save({...state.data,name:'stale'});h.change('B');h.render();await tick();h.change('A');h.render();await tick();h.finishWrite();await assert.rejects(saving,/Account changed/);assert.notEqual(h.render().data.name,'stale');h.change(null);state=h.render();assert.equal(state.session,null);assert.equal(state.data.name,'');assert.deepEqual(state.data.logs,[])}finally{h.restore()}
});
test('late health read cannot overwrite a different account',async()=>{
 const h=hookHarness({readDelay:true});try{await h.init();h.change('B');h.render();await tick();assert.equal(h.render().data.name,'B');h.finishRead();await tick();assert.equal(h.render().data.name,'B')}finally{h.restore()}
});

test('admin logout uses a 303 GET redirect, not a repost to the login page',()=>{
 const route=sourceModule('app/api/admin/logout/route.ts');const response=route.POST(new Request('https://tutahealth.ge/api/admin/logout',{method:'POST'}));assert.equal(response.status,303);assert.equal(response.headers.get('location'),'https://tutahealth.ge/admin/login');assert.match(response.headers.get('set-cookie'),/Max-Age=0/);
});
test('payment browser returns support GET and POST without trusting submitted payment status',()=>{
 const route=sourceModule('app/api/payments/flitt/return/route.ts');
 for(const method of ['GET','POST']){
  const response=route[method](new Request('https://tutahealth.ge/api/payments/flitt/return?type=market&order=tuta-market-12345678-1234-4234-8234-123456789abc',{method,...(method==='POST'?{body:'order_status=approved'}:{})}));
  assert.equal(response.status,303);const url=new URL(response.headers.get('location'));assert.equal(url.pathname,'/market/orders');assert.equal(url.searchParams.get('payment'),'returned');assert.equal(url.searchParams.get('order_status'),null);
 }
 assert.equal(new URL(route.GET(new Request('https://tutahealth.ge/api/payments/flitt/return?type=https://evil.test')).headers.get('location')).pathname,'/premium');
});
test('care cancellation rejects an unrelated account before any update',async()=>{
 let updates=0;const chain={select(){return chain},eq(){return chain},update(){updates++;return chain},maybeSingle:async()=>({data:{patient_id:'other',consultation_slots:{doctor_id:'doctor'}},error:null})};
 const route=sourceModule('app/api/care/route.ts',{'@/lib/platform-server':{ApiError,checked,failure,result,requireUser:async()=>({user:{id:'unrelated',user_metadata:{}},db:{from:()=>chain}})}});
 const response=await route.POST(new Request('https://tutahealth.ge/api/care',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:'12345678-1234-4234-8234-123456789abc',action:'cancel'})}));assert.equal(response.status,404);assert.equal(updates,0);
});
test('login return destination is local and limited to customer pages',()=>{
 const {authDestination}=sourceModule('lib/auth-destination.ts');
 assert.equal(authDestination('?next=%2Fmarket%2Forders%3Forder%3Dx'),'/market/orders?order=x');
 for(const next of ['https://evil.test','//evil.test','/admin','/api/admin','javascript:alert(1)'])assert.equal(authDestination('?next='+encodeURIComponent(next)),'/app/dashboard');
});
test('fulfillment cannot mark unpaid orders shipped or modify completed deliveries',()=>{
 const {canFulfill}=sourceModule('lib/market-orders.ts');
 assert.equal(canFulfill('new','packing','approved'),true);assert.equal(canFulfill('packing','shipped','approved'),true);assert.equal(canFulfill('shipped','delivered','approved'),true);
 for(const [from,to,payment] of [['new','shipped','approved'],['new','packing','pending'],['packing','shipped','declined'],['delivered','new','approved'],['shipped','cancelled','approved']])assert.equal(canFulfill(from,to,payment),false);
 assert.equal(canFulfill('new','cancelled','pending'),true);
});

class ApiError extends Error{constructor(status,message){super(message);this.status=status}}
const result=(data,status=200)=>Response.json(data,{status});
const failure=e=>result({error:e.message},e instanceof ApiError?e.status:503);
const checked=response=>{if(response.error)throw new ApiError(503,'Database unavailable');return response.data};
test('market cart starts without a fabricated pin, clamps plus buttons to 20 and stores no address',()=>{
 const state=[];let cursor=0;const storage=[],previous=globalThis.localStorage;globalThis.localStorage={setItem:(_key,value)=>storage.push(value)};
 const react={useEffect(){},useRef(initial){return state[cursor++]??={current:initial}},useMemo:fn=>fn(),useState(initial){const i=cursor++;if(!(i in state))state[i]=initial;return [state[i],value=>{state[i]=typeof value==='function'?value(state[i]):value}]}};
 const Component=sourceModule('components/marketplace.tsx',{react,'@/components/site-copy-provider':{useSiteCopyText:()=>'Add to cart'}}).default;
 const nodes=(tree,type)=>!tree||typeof tree!=='object'?[]:[...(tree.type===type?[tree]:[]),...[tree.props?.children].flat(Infinity).flatMap(node=>nodes(node,type))];
 const render=()=>{cursor=0;return Component({lang:'en'})};
 try{render();assert.equal(state[6],null);state[0]=[{id:'product',name:'Care item',description:'Test',category:'period-care',price_tetri:100}];state[1]=false;const add=nodes(render(),'button').find(b=>b.props['aria-label']==='Add to cart: Care item');add.props.onClick();for(let i=0;i<25;i++){const plus=nodes(render(),'button').find(b=>b.props['aria-label']==='Increase quantity');plus.props.onClick()}assert.equal(state[3][0].quantity,20);assert.equal(nodes(render(),'button').find(b=>b.props['aria-label']==='Increase quantity').props.disabled,true);const saved=JSON.parse(storage.at(-1));assert.deepEqual(saved,[{id:'product',quantity:20}]);assert.ok(!storage.join('').includes('recipient'))}finally{globalThis.localStorage=previous}
});
test('market API rejects duplicated lines exceeding 20 before fetching products or creating an order',async()=>{
 const boundary={ApiError,checked,failure,result,requireUser:async()=>({user:{id:'owner'}}),requireFeature:async()=>{}};
 const route=sourceModule('app/api/market/checkout/route.ts',{'@/lib/platform-server':boundary,'@/lib/flitt':{bearerToken:()=> 'test-token',flittEnvironment:()=>({admin:{from(){throw Error('Must not access orders')}}})}});
 const response=await route.POST(new Request('https://tutahealth.ge/api/market/checkout',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({recipientName:'Test',address:'Test address',items:[{productId:'12345678-1234-4234-8234-123456789abc',quantity:15},{productId:'12345678-1234-4234-8234-123456789abc',quantity:15}]})}));assert.equal(response.status,400);
});
test('customer orders always filter by verified owner, including a requested order ID',async()=>{
 const filters=[];const chain={select(){return chain},eq(...args){filters.push(args);return chain},order(){return chain},range:async()=>({data:[],error:null})};
 const route=sourceModule('app/api/market/orders/route.ts',{'@/lib/platform-server':{ApiError,checked,failure,result,requireUser:async()=>({user:{id:'owner'},db:{from:()=>chain}})}});
 const response=await route.GET(new Request('https://tutahealth.ge/api/market/orders?order=tuta-market-12345678-1234-4234-8234-123456789abc'));assert.equal(response.status,200);assert.deepEqual(filters[0],['user_id','owner']);assert.equal(filters[1][0],'order_id');
 assert.equal((await route.GET(new Request('https://tutahealth.ge/api/market/orders?page=-1'))).status,400);
});
test('order APIs reject unauthenticated access before reading or mutating orders',async()=>{
 const boundary={ApiError,checked,failure,result,requireUser:async()=>{throw new ApiError(401,'Sign in')},requireAdmin:async()=>{throw new ApiError(401,'Sign in')}};
 const user=sourceModule('app/api/market/orders/route.ts',{'@/lib/platform-server':boundary}),admin=sourceModule('app/api/admin/market/orders/route.ts',{'@/lib/platform-server':boundary});
 assert.equal((await user.GET(new Request('https://tutahealth.ge/api/market/orders'))).status,401);assert.equal((await admin.GET(new Request('https://tutahealth.ge/api/admin/market/orders'))).status,401);assert.equal((await admin.PATCH(new Request('https://tutahealth.ge/api/admin/market/orders',{method:'PATCH'}))).status,401);
});
test('existing care cancellations and partner consent revocation bypass sales feature gates, not ownership',async()=>{
 for(const file of ['care','partners']){
  let gated=0;const chain={select(){return chain},eq(){return chain},is(){return chain},update(){return chain},maybeSingle:async()=>({data:file==='care'?{id:'12345678-1234-4234-8234-123456789abc',patient_id:'owner',consultation_slots:{doctor_id:'doctor'}}:{id:'12345678-1234-4234-8234-123456789abc'},error:null})};
  const boundary={ApiError,checked,failure,result,requireUser:async()=>({user:{id:'owner',user_metadata:{}},db:{from:()=>chain}}),requireFeature:async()=>{gated++;throw new ApiError(403,'Disabled')}};
  const route=sourceModule(`app/api/${file}/route.ts`,{'@/lib/platform-server':boundary});
  const response=await route.POST(new Request(`https://tutahealth.ge/api/${file}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:'12345678-1234-4234-8234-123456789abc',action:file==='care'?'cancel':'revoke'})}));assert.equal(response.status,200);assert.equal(gated,0);
 }
});
test('concurrent feature edits retry the failed compare-and-swap without losing another setting',async()=>{
 const old={url:process.env.NEXT_PUBLIC_SUPABASE_URL,key:process.env.SUPABASE_SECRET_KEY};process.env.NEXT_PUBLIC_SUPABASE_URL='https://example.test';process.env.SUPABASE_SECRET_KEY='test-only';
 let stored={period:true,library:true},firstReads=0;const barrier=deferred();
 const db={from(){let operation='read',payload,expected;const chain={select(){return chain},eq(){return chain},filter(_field,_op,value){expected=JSON.parse(value);return chain},update(value){operation='write';payload=value.features;return chain},async maybeSingle(){if(operation==='read'){const snapshot=structuredClone(stored);if(firstReads++<2){if(firstReads===2)barrier.resolve();await barrier.promise}return {data:{features:snapshot},error:null}}if(JSON.stringify(stored)!==JSON.stringify(expected))return {data:null,error:null};stored=payload;return {data:{features:stored},error:null}}};return chain}};
 try{
  const route=sourceModule('app/api/site-features/route.ts',{'@supabase/supabase-js':{createClient:()=>db},'@/lib/platform-server':{getAdminIdentity:async()=>({role:'owner'})}});
  const request=id=>new Request('https://tutahealth.ge/api/site-features',{method:'PUT',headers:{'Content-Type':'application/json',Origin:'https://tutahealth.ge'},body:JSON.stringify({id,enabled:false})});
  const responses=await Promise.all([route.PUT(request('period')),route.PUT(request('library'))]);assert.deepEqual(responses.map(r=>r.status),[200,200]);assert.equal(stored.period,false);assert.equal(stored.library,false);
 }finally{for(const [key,value]of [['NEXT_PUBLIC_SUPABASE_URL',old.url],['SUPABASE_SECRET_KEY',old.key]])if(value===undefined)delete process.env[key];else process.env[key]=value}
});
test('server feature snapshots stay stable after client settings change (no hydration mismatch)',async()=>{
 const previousWindow=globalThis.window,previousFetch=globalThis.fetch;
 globalThis.window={dispatchEvent(){}};globalThis.fetch=async()=>Response.json({features:{period:true}});
 try{
  const store=sourceModule('lib/site-features.ts');await store.setSiteFeature('period',true);
  function Probe(){return createElement('p',null,String(store.useSiteFeatures().period)+':'+store.useSiteFeaturesStatus())}
  assert.equal(renderToStaticMarkup(createElement(Probe)),'<p>false:loading</p>');
 }finally{globalThis.window=previousWindow;globalThis.fetch=previousFetch}
});
