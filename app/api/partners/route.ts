import { createHash, randomBytes } from 'node:crypto';
import { ApiError,checked,failure,requireFeature,requireUser,result } from '@/lib/platform-server';
import { readAdminJson } from '@/lib/admin-request';
import { textField,uuid } from '@/lib/content-validation';
import { sharedHealth,shareScopes } from '@/lib/partner-sharing';

type Db=ReturnType<typeof import('@/lib/platform-server').dbClient>;
async function premium(db:Db,id:string) {
  const member=checked(await db.from('premium_memberships').select('expires_at').eq('user_id',id).maybeSingle());
  return Boolean(member&&Date.parse(member.expires_at)>Date.now());
}
export async function GET(request:Request) {
  try {
    const {db,user}=await requireUser(request);
    const [outgoing,incoming,active]=await Promise.all([
      db.from('partner_shares').select('id,label,scopes,expires_at,accepted_at,revoked_at').eq('owner_id',user.id).order('created_at',{ascending:false}).limit(50),
      db.from('partner_shares').select('id,owner_id,label,scopes').eq('partner_id',user.id).is('revoked_at',null).limit(20),
      premium(db,user.id),
    ]);
    const shared=await Promise.all((checked(incoming)||[]).map(async row=>{
      const available=await premium(db,row.owner_id);
      if(!available)return {id:row.id,label:row.label,available:false,summary:null};
      const state=checked(await db.from('health_state').select('payload').eq('user_id',row.owner_id).maybeSingle());
      const summary=state?sharedHealth(state.payload,shareScopes(row.scopes)):null;
      // Recheck revocation after loading a snapshot. Never return an owner ID.
      const current=checked(await db.from('partner_shares').select('id').eq('id',row.id).eq('partner_id',user.id).is('revoked_at',null).maybeSingle());
      return current?{id:row.id,label:row.label,available:true,summary}:null;
    }));
    return result({outgoing:checked(outgoing),incoming:shared.filter(Boolean),premium:active});
  }catch(error){return failure(error)}
}
export async function POST(request:Request) {
  try {
    const {db,user}=await requireUser(request);
    let body:Record<string,unknown>;
    try{body=await readAdminJson(request);if(['revoke','leave'].includes(String(body.action)))uuid(body.id)}catch{throw new ApiError(400,'შეამოწმე მონაცემები.');}
    if(body.action==='revoke'){
      const id=uuid(body.id);
      const row=checked(await db.from('partner_shares').update({revoked_at:new Date().toISOString()}).eq('id',id).eq('owner_id',user.id).is('revoked_at',null).select('id').maybeSingle());
      if(!row)throw new ApiError(404,'გაზიარება ვერ მოიძებნა.');
      return result({ok:true});
    }
    if(body.action==='leave'){
      const row=checked(await db.from('partner_shares').update({revoked_at:new Date().toISOString()}).eq('id',uuid(body.id)).eq('partner_id',user.id).is('revoked_at',null).select('id').maybeSingle());
      if(!row)throw new ApiError(404,'გაზიარება ვერ მოიძებნა.');
      return result({ok:true});
    }
    await requireFeature(db,'partners');
    if(body.action==='accept'){
      if(typeof body.token!=='string'||!/^[a-f0-9]{64}$/.test(body.token))throw new ApiError(400,'მოწვევის კოდი არასწორია.');
      const hash=createHash('sha256').update(body.token).digest('hex');
      const invite=checked(await db.from('partner_shares').select('id,owner_id').eq('token_hash',hash).is('partner_id',null).is('revoked_at',null).gt('expires_at',new Date().toISOString()).maybeSingle());
      if(!invite||invite.owner_id===user.id)throw new ApiError(400,'მოწვევა აღარ მოქმედებს ან შენ გეკუთვნის.');
      if(!await premium(db,invite.owner_id))throw new ApiError(403,'გამზიარებლის პრემიუმი აღარ არის აქტიური.');
      const row=checked(await db.from('partner_shares').update({partner_id:user.id,accepted_at:new Date().toISOString()}).eq('id',invite.id).is('partner_id',null).is('revoked_at',null).gt('expires_at',new Date().toISOString()).select('id').maybeSingle());
      if(!row)throw new ApiError(409,'მოწვევა უკვე გამოყენებულია ან გაუქმდა.');
      return result({ok:true});
    }
    if(body.action!=='invite')throw new ApiError(400,'უცნობი მოქმედება.');
    if(!await premium(db,user.id))throw new ApiError(403,'გაზიარების დასაწყებად საჭიროა აქტიური პრემიუმი.');
    let scopes:ReturnType<typeof shareScopes>,label:string;
    try{scopes=shareScopes(body.scopes);label=textField(body.label,60)}catch{throw new ApiError(400,'აირჩიე გასაზიარებელი მონაცემები და შეავსე დასახელება.');}
    const count=await db.from('partner_shares').select('id',{count:'exact',head:true}).eq('owner_id',user.id).is('revoked_at',null);
    checked(count);if((count.count||0)>=10)throw new ApiError(400,'ჯერ გააუქმე ერთ-ერთი არსებული გაზიარება.');
    const token=randomBytes(32).toString('hex');
    checked(await db.from('partner_shares').insert({owner_id:user.id,label,scopes,token_hash:createHash('sha256').update(token).digest('hex'),expires_at:new Date(Date.now()+7*86400000).toISOString()}));
    return result({token},201);
  }catch(error){return failure(error)}
}
