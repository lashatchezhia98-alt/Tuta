"use client";

import { useId, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

export default function PasswordField({label,value,onChange,lang,autoComplete='new-password'}:{
  label:string;
  value:string;
  onChange:(value:string)=>void;
  lang:'ka'|'en';
  autoComplete?:'current-password'|'new-password';
}) {
  const id=useId();
  const [visible,setVisible]=useState(false);
  const action=lang==='ka'?(visible?'პაროლის დამალვა':'პაროლის გამოჩენა'):(visible?'Hide password':'Show password');
  const VisibilityIcon=visible?EyeOff:Eye;

  return <div className="password-control">
    <label htmlFor={id}>{label}</label>
    <div className="password-field">
      <input id={id} type={visible?'text':'password'} placeholder="••••••••" autoComplete={autoComplete} autoCapitalize="none" autoCorrect="off" spellCheck={false} value={value} onChange={event=>onChange(event.target.value)} required minLength={autoComplete === 'new-password' ? 8 : undefined}/>
      <button className="password-toggle" type="button" aria-label={`${label}: ${action}`} aria-pressed={visible} aria-controls={id} title={action} onClick={()=>setVisible(current=>!current)}>
        <VisibilityIcon size={20} aria-hidden="true"/>
      </button>
    </div>
  </div>;
}
