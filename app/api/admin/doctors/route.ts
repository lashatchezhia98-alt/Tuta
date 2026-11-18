import {ApiError,checked,failure,requireAdmin,result} from '@/lib/platform-server';
import {readAdminJson} from '@/lib/admin-request';
import {uuid} from '@/lib/content-validation';
import {doctorEnrollment,doctorInvite,doctorInviteEmail,doctorQualifications,pendingDoctorVerification,prequalifiedDoctorInvitation} from '@/lib/doctor-enrollment';

export async function GET(request:Request){try{
  const db=await requireAdmin(request);
  return result({enrollments:checked(await db.from('doctor_enrollments').select('*').order('created_at',{ascending:false}).limit(100))});
}catch(error){return failure(error)}}

export async function POST(request:Request){try{
  const db=await requireAdmin(request);let body:Record<string,unknown>;
  try{body=await readAdminJson(request)}catch{throw new ApiError(400,'შეამოწმე მონაცემები.');}
  if(body.action==='register'){
    let values;try{values=doctorEnrollment(body)}catch{throw new ApiError(400,'შეავსე ექიმის მონაცემები და დაადასტურე მისი თანხმობა.');}
    const row=await db.from('doctor_enrollments').insert(values).select('id').single();
    if(row.error?.code==='23505')throw new ApiError(409,'ეს ელფოსტა უკვე დამატებულია. გამოიყენე არსებული ჩანაწერი.');
    return result({enrollment:checked(row)},201);
  }
  let id:string;
  const qualifiedInvite=body.action==='invite-qualified';
  const newInvite=body.action==='invite-new'||qualifiedInvite;
  if(newInvite){
    let values;
    try{
      if(qualifiedInvite){
        if(body.confirmed!==true)throw Error();
        values={email:doctorInviteEmail(body.email),first_name:'Pending',last_name:'Pending',consent_confirmed:true};
      }else values=doctorInvite(body);
    }catch{throw new ApiError(400,'შეამოწმე ელფოსტა და დაადასტურე მოწვევა.');}
    const row=await db.from('doctor_enrollments').insert({...values,specialty:pendingDoctorVerification,license_reference:qualifiedInvite?prequalifiedDoctorInvitation:pendingDoctorVerification}).select('id').single();
    if(row.error?.code==='23505')throw new ApiError(409,'ეს ელფოსტა უკვე სიაშია. მოწვევა არსებული ჩანაწერიდან გაგზავნე.');
    const created=checked(row);
    if(!created)throw new ApiError(503,'ექიმის ჩანაწერი ვერ შეიქმნა.');
    id=created.id;
  }else{
    try{id=uuid(body.id)}catch{throw new ApiError(400,'ჩანაწერის ნომერი არასწორია.');}
  }
  if(body.action==='remove'){
    if(body.confirmed!==true)throw new ApiError(400,'წაშლამდე დაადასტურე მოქმედება.');
    const removed=await db.rpc('remove_doctor_enrollment',{enrollment_id:id});
    if(removed.error?.code==='22023')throw new ApiError(404,'ექიმის ჩანაწერი ვერ მოიძებნა.');
    if(removed.error?.code==='23503')throw new ApiError(409,'ექიმს აქვს მიმოწერის ან ვიზიტის ისტორია. ჩანაწერების შესანარჩუნებლად გათიშე პროფილი „ექიმები და ვიზიტების“ გვერდიდან.');
    if(removed.error?.code==='55000')throw new ApiError(409,'ამ ანგარიშზე ერთზე მეტი დადასტურებული ჩანაწერია. წაშლამდე საჭიროა მათი გადამოწმება.');
    checked(removed);
    return result({ok:true});
  }
  const record=checked(await db.from('doctor_enrollments').select('*').eq('id',id).maybeSingle());
  if(!record)throw new ApiError(404,'ექიმის ჩანაწერი ვერ მოიძებნა.');
  if(body.action==='invite'||newInvite){
    if(record.status==='verified')throw new ApiError(400,'ექიმი უკვე დადასტურებულია.');
    if(!record.consent_confirmed)throw new ApiError(400,'მოწვევისთვის საჭიროა ექიმის თანხმობა.');
    // Find a pre-existing account without returning any user directory to the browser.
    let accountId:string|undefined;
    let resendPendingInvitation=false;
    let complete=false;
    for(let page=1;page<=20;page++){
      const {data,error}=await db.auth.admin.listUsers({page,perPage:1000});
      if(error)throw new ApiError(503,'ანგარიშის გადამოწმება ვერ მოხერხდა.');
      const found=data.users.find(u=>u.email?.toLowerCase()===record.email);
      if(found){
        accountId=found.id;
        resendPendingInvitation=Boolean(record.status==='invited'&&record.user_id===found.id&&found.invited_at&&!found.email_confirmed_at);
        complete=true;
        break;
      }
      if(data.users.length<1000){complete=true;break;}
    }
    if(!complete)throw new ApiError(503,'მომხმარებლის ძებნის ლიმიტი მიღწეულია. საჭიროა მხარდაჭერა.');
    let invited=false;
    if(!accountId||resendPendingInvitation){
      const {data,error}=await db.auth.admin.inviteUserByEmail(record.email,{
        ...(record.license_reference===prequalifiedDoctorInvitation?{}:{data:{first_name:record.first_name,last_name:record.last_name}}),
        redirectTo:new URL('/reset-password',request.url).toString()
      });
      if(error||!data.user||(accountId&&data.user.id!==accountId))throw new ApiError(502,'მოწვევის წერილი ვერ გაიგზავნა. ექიმის ჩანაწერი სიაშია — სცადე იქიდან ხელახლა გაგზავნა.');
      accountId=data.user.id;
      invited=true;
    }
    const linked=checked(await db.from('doctor_enrollments').update({user_id:accountId,status:'invited'}).eq('id',id).neq('status','verified').select('id').maybeSingle());
    if(!linked)throw new ApiError(409,'ჩანაწერი შეიცვალა. გადაამოწმე ექიმების სია.');
    return result({ok:true,invited});
  }
  if(body.action==='approve'){
    if(record.license_reference===prequalifiedDoctorInvitation)throw new ApiError(400,'პროფილს ექიმი ავსებს მოწვევის მიღების შემდეგ.');
    if(record.status==='verified')throw new ApiError(409,'ექიმი უკვე გადამოწმებულია. პროფილი ცალკე მართე.');
    if(body.qualifications_verified!==true||!record.consent_confirmed||!record.user_id)throw new ApiError(400,'საჭიროა ანგარიშის დაკავშირება, თანხმობა და კვალიფიკაციის გადამოწმება.');
    const submitted=body.specialty!==undefined||body.license_reference!==undefined||body.bio!==undefined;
    let qualifications;
    try{qualifications=doctorQualifications(submitted?body:record)}catch{throw new ApiError(400,'შეავსე სპეციალობა და კვალიფიკაციის გადამოწმების წყარო.');}
    const {data,error}=await db.auth.admin.getUserById(record.user_id);
    if(error||!data.user?.email_confirmed_at||data.user.email?.toLowerCase()!==record.email)throw new ApiError(400,'ექიმმა ჯერ უნდა დაადასტუროს თავისი ელფოსტა და მიიღოს მოწვევა.');
    if(submitted){
      const saved=checked(await db.from('doctor_enrollments').update(qualifications).eq('id',id).eq('status','invited').eq('user_id',record.user_id).select('id').maybeSingle());
      if(!saved)throw new ApiError(409,'ჩანაწერი შეიცვალა. განაახლე გვერდი და სცადე ხელახლა.');
    }
    // Atomically grant the badge, create an inactive profile and mark verification.
    const approved=await db.rpc('approve_doctor_enrollment',{enrollment_id:id});
    if(approved.error?.code==='22023')throw new ApiError(409,'ჩანაწერი შეიცვალა. განაახლე გვერდი და სცადე ხელახლა.');
    checked(approved);
    return result({ok:true});
  }
  throw new ApiError(400,'უცნობი მოქმედება.');
}catch(error){return failure(error)}}
