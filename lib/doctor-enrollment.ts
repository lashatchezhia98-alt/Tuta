import { textField } from './content-validation';
export function doctorEnrollment(body:Record<string,unknown>) {
  const email=textField(body.email,254).toLowerCase();
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||body.consent_confirmed!==true)throw new Error('Invalid email or consent');
  const first_name=textField(body.first_name,60),last_name=textField(body.last_name,60),license_reference=textField(body.license_reference,200);
  if(first_name.length<2||last_name.length<2||license_reference.length<2)throw new Error('Incomplete registration');
  return {email,first_name,last_name,license_reference,specialty:textField(body.specialty,120),bio:textField(body.bio,2000,false),consent_confirmed:true};
}
