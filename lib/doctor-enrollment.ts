import { textField } from './content-validation';
export const pendingDoctorVerification = "pending-verification";
export const prequalifiedDoctorInvitation = "admin-vetted-invitation";
export function doctorInviteEmail(value:unknown) {
  const email=textField(value,254).toLowerCase();
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw new Error('Invalid email');
  return email;
}
export function doctorInvite(body:Record<string,unknown>) {
  const email=doctorInviteEmail(body.email);
  if(body.consent_confirmed!==true)throw new Error('Invalid consent');
  const first_name=textField(body.first_name,60),last_name=textField(body.last_name,60);
  if(first_name.length<2||last_name.length<2)throw new Error('Incomplete registration');
  return {email,first_name,last_name,consent_confirmed:true};
}
export function doctorQualifications(body:Record<string,unknown>) {
  const specialty=textField(body.specialty,120),license_reference=textField(body.license_reference,200);
  if(license_reference.length<2||[specialty,license_reference].includes(pendingDoctorVerification))throw new Error('Incomplete qualification');
  return {license_reference,specialty,bio:textField(body.bio,2000,false)};
}
export function doctorEnrollment(body:Record<string,unknown>) {
  return {...doctorInvite(body),...doctorQualifications(body)};
}
