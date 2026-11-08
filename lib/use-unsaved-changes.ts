"use client";
import {useEffect} from 'react';
export function useUnsavedChanges(dirty:boolean,ka:boolean){
  useEffect(()=>{
    if(!dirty)return;
    const unload=(event:BeforeUnloadEvent)=>{event.preventDefault();event.returnValue=''};
    const click=(event:MouseEvent)=>{if(event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;const link=(event.target as Element)?.closest?.('a[href]') as HTMLAnchorElement|null;if(!link||link.target==='_blank'||link.hasAttribute('download')||link.href===window.location.href)return;if(!window.confirm(ka?'შეუნახავი ცვლილებები დაიკარგება. გსურს გვერდიდან გასვლა?':'Unsaved changes will be lost. Leave this page?')){event.preventDefault();event.stopPropagation()}};
    window.addEventListener('beforeunload',unload);document.addEventListener('click',click,true);
    return()=>{window.removeEventListener('beforeunload',unload);document.removeEventListener('click',click,true)};
  },[dirty,ka]);
}
