import { createHash, randomUUID } from "node:crypto";
import { ApiError, checked, failure, requireUser, result } from "@/lib/platform-server";
import { doctorInvite, prequalifiedDoctorInvitation } from "@/lib/doctor-enrollment";
import { textField } from "@/lib/content-validation";

async function invitation(request: Request) {
  const { db, user } = await requireUser(request);
  if (!user.email || !user.email_confirmed_at) throw new ApiError(403, "დაადასტურე მოწვევის ელფოსტა.");
  const record = checked(await db.from("doctor_enrollments").select("id")
    .eq("user_id", user.id).eq("email", user.email.toLowerCase())
    .eq("status", "invited").eq("consent_confirmed", true)
    .eq("license_reference", prequalifiedDoctorInvitation).maybeSingle());
  if (!record) throw new ApiError(403, "ამ ანგარიშისთვის აქტიური მოწვევა ვერ მოიძებნა.");
  return { db, user, id: record.id, email: user.email };
}

export async function GET(request: Request) {
  try {
    const { email } = await invitation(request);
    return result({ email });
  } catch (error) { return failure(error); }
}

async function uploadPhoto(file: File, userId: string) {
  if (file.size < 12 || file.size > 3 * 1024 * 1024)
    throw new ApiError(400, "ფოტო მაქსიმუმ 3 მბ უნდა იყოს.");
  const bytes = new Uint8Array(await file.slice(0,12).arrayBuffer());
  const jpeg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  const png = [137,80,78,71,13,10,26,10].every((b,i) => b === bytes[i]);
  const webp = String.fromCharCode(...bytes.slice(0,4)) === "RIFF" &&
    String.fromCharCode(...bytes.slice(8,12)) === "WEBP";
  if (!jpeg && !png && !webp) throw new ApiError(400, "აირჩიე JPG, PNG ან WebP ფოტო.");
  const cloud=process.env.CLOUDINARY_CLOUD_NAME,key=process.env.CLOUDINARY_API_KEY,secret=process.env.CLOUDINARY_API_SECRET;
  if(!cloud||!key||!secret)throw new ApiError(503,"ფოტოების სერვისი დროებით მიუწვდომელია. შეგიძლია გააგრძელო ფოტოს გარეშე.");
  const publicId=`tuta-doctors/${userId}/${randomUUID()}`;
  const timestamp=String(Math.floor(Date.now()/1000)), transformation="c_fill,g_face,h_512,w_512";
  const signature=createHash("sha1").update(`public_id=${publicId}&timestamp=${timestamp}&transformation=${transformation}${secret}`).digest("hex");
  const form=new FormData();
  for(const [k,v] of Object.entries({api_key:key,public_id:publicId,timestamp,transformation,signature}))form.set(k,v);
  form.set("file",file);
  const response=await fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(cloud)}/image/upload`,{method:"POST",body:form,signal:AbortSignal.timeout(30_000)});
  const asset=response.ok?await response.json():null;
  if(asset?.public_id!==publicId||asset?.resource_type!=="image")throw new ApiError(503,"ფოტო ვერ აიტვირთა. სცადე ისევ ან გააგრძელე ფოტოს გარეშე.");
  return publicId;
}

export async function POST(request: Request) {
  try {
    const { db, user, id, email }=await invitation(request);
    if(Number(request.headers.get("content-length")||0)>3*1024*1024+16_384)
      throw new ApiError(413,"ფოტო მაქსიმუმ 3 მბ უნდა იყოს.");
    const form=await request.formData().catch(()=>null);
    if(!form||form.get("publish")!=="yes")throw new ApiError(400,"დაადასტურე საჯარო პროფილის გამოქვეყნება.");
    let identity,specialty;
    try{
      identity=doctorInvite({email,first_name:form.get("first_name"),last_name:form.get("last_name"),consent_confirmed:true});
      specialty=textField(form.get("specialty"),120);
    }catch{throw new ApiError(400,"შეავსე სახელი, გვარი და სპეციალობა.");}
    const photo=form.get("photo");
    const publicId=photo instanceof File&&photo.size ? await uploadPhoto(photo,user.id) : null;
    const saved=checked(await db.from("doctor_enrollments").update({first_name:identity.first_name,last_name:identity.last_name,specialty})
      .eq("id",id).eq("user_id",user.id).eq("status","invited").eq("license_reference",prequalifiedDoctorInvitation).select("id").maybeSingle());
    if(!saved)throw new ApiError(409,"მოწვევა შეიცვალა. მიმართე ადმინისტრატორს.");
    checked(await db.rpc("approve_doctor_enrollment",{enrollment_id:id}));
    if(publicId)checked(await db.from("verified_doctors").update({photo_public_id:publicId}).eq("user_id",user.id).select("user_id").single());
    checked(await db.from("doctor_profiles").update({active:true}).eq("user_id",user.id).select("user_id").single());
    return result({ok:true});
  }catch(error){return failure(error);}
}
