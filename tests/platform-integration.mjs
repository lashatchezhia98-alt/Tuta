// Opt-in integration test against the linked database, through a local production server.
// Creates synthetic accounts without sending email; cleans only its own fixtures.
import assert from 'node:assert/strict';
import {randomUUID,randomBytes} from 'node:crypto';
import nextEnv from '@next/env';
import {createClient} from '@supabase/supabase-js';
nextEnv.loadEnvConfig(process.cwd());
if(process.env.RUN_TUTA_INTEGRATION!=='1')throw Error('Set RUN_TUTA_INTEGRATION=1 explicitly.');
const base=process.env.TUTA_TEST_URL||'http://localhost:3112';
if(!['localhost','127.0.0.1'].includes(new URL(base).hostname))throw Error('Use an explicitly local test server.');
const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY,pub=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY||process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
assert.ok(url&&key&&pub,'Supabase configuration required');
const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
const created=[],clients=[],run=randomUUID();let enrollmentId;
const checked=response=>{if(response.error)throw Error(response.error.code||'Database operation failed');return response.data};
async function request(path,{token,cookie,body}={}){
 const response=await fetch(base+path,{method:body?'POST':'GET',headers:{...(body?{'Content-Type':'application/json',Origin:base}:{}),...(token?{Authorization:`Bearer ${token}`} :{}),...(cookie?{Cookie:cookie}:{})},...(body?{body:JSON.stringify(body)}:{})});
 return {status:response.status,body:await response.json(),response};
}
try{
 for(let i=0;i<3;i++){
  const email=`tuta.integration.${run}.${i}@example.com`,password=randomBytes(32).toString('base64url');
  const {user}=checked(await db.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{first_name:'Integration',last_name:'Test'}}));created.push(user.id);
  const client=createClient(url,pub,{auth:{persistSession:false,autoRefreshToken:false}});clients.push(client);
  const session=checked(await client.auth.signInWithPassword({email,password})).session;assert.ok(session);
  created[i]={id:user.id,email,token:session.access_token};
 }
 const [owner,partner,outsider]=created;
 checked(await db.from('premium_memberships').insert({user_id:owner.id,expires_at:new Date(Date.now()+3600000).toISOString()}));
 const payload={version:1,lang:'ka',name:'PRIVATE_CANARY',cycleLength:28,periods:[{start:'2026-10-01',duration:5}],logs:[{date:'2026-10-02',mood:'calm',energy:3,pain:2,flow:'light',symptoms:['PRIVATE_CANARY'],notes:'PRIVATE_CANARY'}]};
 checked(await clients[0].from('health_state').upsert({user_id:owner.id,payload}));
 assert.equal((await request('/api/partners')).status,401);
 const direct=await clients[1].from('health_state').select('user_id').eq('user_id',owner.id);assert.deepEqual(checked(direct),[]);
 const privateRows=await clients[1].from('doctor_enrollments').select('id');assert.ok(privateRows.error,'Private registrations must not be browser-readable');
 assert.equal((await request('/api/partners',{token:partner.token,body:{action:'invite',label:'Denied',scopes:{cycle:true,pregnancy:false}}})).status,403);
 const invite=await request('/api/partners',{token:owner.token,body:{action:'invite',label:'Integration test',scopes:{cycle:true,pregnancy:false}}});assert.equal(invite.status,201);
 const token=invite.body.token;assert.match(token,/^[a-f0-9]{64}$/);
 assert.equal((await request('/api/partners',{token:owner.token,body:{action:'accept',token}})).status,400);
 assert.equal((await request('/api/partners',{token:partner.token,body:{action:'accept',token}})).status,200);
 assert.equal((await request('/api/partners',{token:outsider.token,body:{action:'accept',token}})).status,400);
 const received=await request('/api/partners',{token:partner.token});assert.equal(received.status,200);assert.equal(received.body.incoming.length,1);
 assert.equal(received.body.incoming[0].summary.cycle.periods[0].start,'2026-10-01');assert.doesNotMatch(JSON.stringify(received.body),/PRIVATE_CANARY|owner_id|token_hash|notes|symptoms/);
 assert.equal((await request('/api/partners',{token:outsider.token})).body.incoming.length,0);
 const shareId=received.body.incoming[0].id;
 assert.equal((await request('/api/partners',{token:outsider.token,body:{action:'revoke',id:shareId}})).status,404);
 checked(await db.from('premium_memberships').update({expires_at:'2020-01-01T00:00:00Z'}).eq('user_id',owner.id));
 const expired=await request('/api/partners',{token:partner.token});assert.equal(expired.body.incoming[0].summary,null);assert.equal(expired.body.incoming[0].available,false);
 assert.equal((await request('/api/partners',{token:owner.token,body:{action:'revoke',id:shareId}})).status,200);
 assert.equal((await request('/api/partners',{token:partner.token})).body.incoming.length,0);
 console.log('PASS: partner consent, one-use invitations, ownership, expiry and diary isolation');

 assert.equal((await request('/api/admin/doctors',{token:owner.token})).status,401);
 const login=await request('/api/admin/login',{body:{email:process.env.ADMIN_EMAIL,password:process.env.ADMIN_PASSWORD}});assert.equal(login.status,200);
 const cookie=login.response.headers.get('set-cookie')?.split(';')[0];assert.ok(cookie);
 const registration=await request('/api/admin/doctors',{cookie,body:{action:'register',email:outsider.email,first_name:'Integration',last_name:'Test',specialty:'Test only',bio:'Synthetic registration, not a real doctor.',license_reference:`TEST-${run}`,consent_confirmed:true}});assert.equal(registration.status,201);enrollmentId=registration.body.enrollment.id;
 const linked=await request('/api/admin/doctors',{cookie,body:{action:'invite',id:enrollmentId}});assert.equal(linked.status,200);assert.equal(linked.body.invited,false);
 const badge=checked(await db.from('verified_doctors').select('user_id').eq('user_id',outsider.id));assert.deepEqual(badge,[],'Linking cannot grant a badge');
 const noConsent=await request('/api/admin/doctors',{cookie,body:{action:'approve',id:enrollmentId,qualifications_verified:false}});assert.equal(noConsent.status,400);
 const blocked=await clients[1].rpc('approve_doctor_enrollment',{enrollment_id:enrollmentId});assert.ok(blocked.error,'Ordinary users cannot grant badges');
 const missing=await db.rpc('approve_doctor_enrollment',{enrollment_id:randomUUID()});assert.equal(missing.error?.code,'22023','Server-only approval RPC must be exposed and validate state');
 const csrf=await fetch(base+'/api/admin/doctors',{method:'POST',headers:{Cookie:cookie,'Content-Type':'application/json',Origin:'https://other.example'},body:'{}'});assert.equal(csrf.status,403);
 for(const path of ['/admin/doctors','/admin/care','/admin/features']){const r=await fetch(base+path,{headers:{Cookie:cookie},redirect:'manual'});assert.equal(r.status,200,`Admin navigation: ${path}`);}
 console.log('PASS: doctor registration persists, existing account links without mail, no automatic badge, admin navigation and CSRF');
}finally{
 if(enrollmentId)checked(await db.from('doctor_enrollments').delete().eq('id',enrollmentId));
 for(const client of clients)await client.auth.signOut();
 for(const user of created){const id=typeof user==='string'?user:user.id;checked(await db.auth.admin.deleteUser(id));}
 console.log('Synthetic fixtures removed; no real user records changed.');
}
