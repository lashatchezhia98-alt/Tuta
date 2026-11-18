import test from 'node:test';
import assert from 'node:assert/strict';
import {sourceModule} from './source-loader.mjs';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';

class ApiError extends Error{constructor(status,message){super(message);this.status=status;}}
const id='12345678-1234-4234-8234-123456789abc';
const fields={email:'doctor@example.test',first_name:'Test',last_name:'Doctor',specialty:'Gynecology',bio:'Test',license_reference:'TEST-REF',consent_confirmed:true};
function setup({denied=false,confirmed=true,existing=true,previousInvite=false,consent=true,status='invited',pending=false,rpcError=null}={}){
 const writes=[],calls=[];
 const record={...fields,id,user_id:id,status,consent_confirmed:consent,
   ...(pending?{specialty:'pending-verification',license_reference:'pending-verification'}:{})};
 const db={from(table){let operation='select',values;
  const chain={select(){return chain},order(){return chain},limit(){return chain},eq(){return chain},neq(){return chain},insert(v){operation='insert';values=v;return chain},update(v){operation='update';values=v;return chain},single(){return chain},maybeSingle(){return chain},then(resolve){if(operation!=='select')writes.push({table,operation,values});resolve({data:operation==='select'?record:{id},error:null})}};return chain;
 },auth:{admin:{listUsers:async()=>({data:{users:existing?[{id,email:fields.email,invited_at:previousInvite?'2026-01-01':null,email_confirmed_at:confirmed?'2026-01-01':null}]:[]},error:null}),inviteUserByEmail:async(email,options)=>{calls.push({email,options});return {data:{user:{id}},error:null}},getUserById:async()=>({data:{user:{id,email:fields.email,email_confirmed_at:confirmed?'2026-01-01':null}},error:null})}},rpc:async(name,args)=>{calls.push({name,args});return {data:null,error:rpcError}}};
 const boundary={ApiError,requireAdmin:async()=>{if(denied)throw new ApiError(401,'Unauthorized');return db},result:(data,status=200)=>Response.json(data,{status}),checked:r=>{if(r.error)throw new ApiError(503,'Database unavailable');return r.data},failure:e=>Response.json({error:e.message},{status:e instanceof ApiError?e.status:503})};
 const route=sourceModule('app/api/admin/doctors/route.ts',{'@/lib/platform-server':boundary});
 const request=body=>new Request('https://tutahealth.ge/api/admin/doctors',{method:'POST',headers:{'content-type':'application/json',origin:'https://tutahealth.ge'},body:JSON.stringify(body)});
 return {route,writes,calls,request};
}
test('doctor API rejects non-admin reads and writes before accessing records',async()=>{
 const s=setup({denied:true});assert.equal((await s.route.GET(new Request('https://tutahealth.ge/api/admin/doctors'))).status,401);
 assert.equal((await s.route.POST(s.request({action:'register',...fields}))).status,401);assert.deepEqual(s.writes,[]);
 assert.equal((await s.route.POST(s.request({action:'remove',id,confirmed:true}))).status,401);
 assert.deepEqual(s.calls,[]);
});
test('saving doctor registration does not invite or grant a badge',async()=>{
 const s=setup();assert.equal((await s.route.POST(s.request({action:'register',...fields}))).status,201);
 assert.equal(s.writes.length,1);assert.equal(s.writes[0].table,'doctor_enrollments');assert.deepEqual(s.calls,[]);
 assert.equal((await s.route.POST(s.request({action:'register',...fields,consent_confirmed:false}))).status,400);
 assert.equal((await s.route.POST(s.request({action:'approve',id:'bad'}))).status,400);
});
test('only explicit invitation sends an email; an existing account is linked without mail',async()=>{
 for(const existing of [true,false]){const s=setup({existing});const response=await s.route.POST(s.request({action:'invite',id}));assert.equal(response.status,200);assert.equal((await response.json()).invited,!existing);assert.equal(s.calls.length,existing?0:1);if(!existing)assert.equal(s.calls[0].options.redirectTo,'https://tutahealth.ge/reset-password');}
});
test('invite-first accepts identity and consent without collecting qualifications',async()=>{
 const s=setup({existing:false,status:'draft'});
 const identity={email:fields.email,first_name:fields.first_name,last_name:fields.last_name,consent_confirmed:true};
 const response=await s.route.POST(s.request({action:'invite-new',...identity}));
 assert.equal(response.status,200);
 assert.equal((await response.json()).invited,true);
 assert.equal(s.writes[0].values.license_reference,'pending-verification');
 assert.equal(s.calls[0].email,fields.email);
 assert.equal(s.writes[1].values.status,'invited');
});
test('doctor approval requires verified qualifications and confirmed matching account email',async()=>{
 const s=setup();assert.equal((await s.route.POST(s.request({action:'approve',id}))).status,400);assert.deepEqual(s.calls,[]);
 const noEmail=setup({confirmed:false});assert.equal((await noEmail.route.POST(noEmail.request({action:'approve',id,qualifications_verified:true}))).status,400);assert.deepEqual(noEmail.calls,[]);
 const done=setup({status:'verified'});assert.equal((await done.route.POST(done.request({action:'approve',id,qualifications_verified:true}))).status,409);
});
test('an invite-only record cannot be approved until real qualifications are provided', async()=>{
 const s=setup({pending:true});
 assert.equal((await s.route.POST(s.request({action:'approve',id,qualifications_verified:true}))).status,400);
 assert.deepEqual(s.calls,[]);
 assert.equal((await s.route.POST(s.request({action:'approve',id,qualifications_verified:true,specialty:fields.specialty,license_reference:fields.license_reference,bio:fields.bio}))).status,200);
 assert.equal(s.writes[0].values.license_reference,fields.license_reference);
 assert.equal(s.calls[0].name,'approve_doctor_enrollment');
});
test('a pending doctor invitation can be resent, but not without consent or after email confirmation',async()=>{
 for(const [options,expectedStatus,sent] of [
  [{previousInvite:true,confirmed:false},200,true],
  [{previousInvite:true,confirmed:true},200,false],
  [{previousInvite:true,confirmed:false,consent:false},400,false],
  [{previousInvite:false,confirmed:false},200,false],
 ]){
  const s=setup(options);
  const response=await s.route.POST(s.request({action:'invite',id}));
  assert.equal(response.status,expectedStatus);
  assert.equal(s.calls.length,sent?1:0);
  if(sent)assert.equal(s.calls[0].email,fields.email);
 }
});
test('approval uses one atomic database transaction, handles concurrent changes',async()=>{
 const s=setup();assert.equal((await s.route.POST(s.request({action:'approve',id,qualifications_verified:true}))).status,200);assert.deepEqual(s.calls,[{name:'approve_doctor_enrollment',args:{enrollment_id:id}}]);assert.deepEqual(s.writes,[]);
 const race=setup({rpcError:{code:'22023'}});assert.equal((await race.route.POST(race.request({action:'approve',id,qualifications_verified:true}))).status,409);
});
test('doctor admin screen asks only for an email before sending the invitation',()=>{
 const Component=sourceModule('components/doctor-enrollment.tsx',{'next/link':({children,...props})=>createElement('a',props,children)}).default;
 const html=renderToStaticMarkup(createElement(Component,{lang:'ka'}));
 for(const text of ['ექიმის მოწვევა','ელფოსტა','ერთჯერადი მოწვევის გაგზავნა','ექიმების სია','/admin/care'])assert.ok(html.includes(text),text);
 assert.doesNotMatch(html,/სახელი|გვარი|სპეციალობა|სერტიფიკატის ნომერი|მონაცემების შენახვა/);
 assert.doesNotMatch(html,/type="password"/);
});
test('the email-only invitation requires explicit admin confirmation',async()=>{
 const s=setup({existing:false,status:'draft'});
 assert.equal((await s.route.POST(s.request({action:'invite-qualified',email:fields.email}))).status,400);
 assert.deepEqual(s.writes,[]);
 assert.equal((await s.route.POST(s.request({action:'invite-qualified',email:fields.email,confirmed:true}))).status,200);
 assert.equal(s.writes[0].values.license_reference,'admin-vetted-invitation');
 assert.equal(s.calls[0].email,fields.email);
});
test('only a confirmed, invited email can activate a public profile',async()=>{
 for(const [confirmed,record,expected] of [[false,true,403],[true,false,403],[true,true,200]]){
  const writes=[],filters=[];
  const db={from(table){
   const chain={select(){return chain},eq(key,value){filters.push([key,value]);return chain},
    update(value){writes.push([table,value]);return chain},
    maybeSingle:async()=>({data:record?{id}:null}),single:async()=>({data:{id}})};
   return chain;
  },rpc:async(name)=>{writes.push([name]);return {data:null}}};
  const route=sourceModule('app/api/doctor/setup/route.ts',{'@/lib/platform-server':{
   ApiError,requireUser:async()=>({db,user:{id,email:fields.email,email_confirmed_at:confirmed?'2026-01-01':null}}),
   result:Response.json,checked:r=>r.data,failure:e=>Response.json({error:e.message},{status:e.status||503})
  }});
  const body=new FormData();
  for(const name of ['first_name','last_name','specialty'])body.set(name,fields[name]);
  body.set('publish','yes');
  assert.equal((await route.POST(new Request('https://tutahealth.ge/api/doctor/setup',{method:'POST',body}))).status,expected);
  if(expected===200){
   assert.ok(filters.some(([key,value])=>key==='email'&&value===fields.email));
   assert.deepEqual(writes.slice(1),[['approve_doctor_enrollment'],['doctor_profiles',{active:true}]]);
  }else assert.deepEqual(writes,[]);
 }
});
test('doctor removal requires an explicit confirmation and one atomic operation',async()=>{
 const s=setup();
 assert.equal((await s.route.POST(s.request({action:'remove',id}))).status,400);
 assert.equal((await s.route.POST(s.request({action:'remove',id:'invalid',confirmed:true}))).status,400);
 assert.deepEqual(s.calls,[]);
 assert.equal((await s.route.POST(s.request({action:'remove',id,confirmed:true}))).status,200);
 assert.deepEqual(s.calls,[{name:'remove_doctor_enrollment',args:{enrollment_id:id}}]);
 assert.deepEqual(s.writes,[]);
});
test('doctor removal refuses to delete consultation history and reports stale records',async()=>{
 for(const [code,status] of [['23503',409],['22023',404],['55000',409]]){
  const s=setup({rpcError:{code}});
  assert.equal((await s.route.POST(s.request({action:'remove',id,confirmed:true}))).status,status);
  assert.deepEqual(s.writes,[]);
 }
});
