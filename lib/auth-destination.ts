export function authDestination(search:string){
  const next=new URLSearchParams(search).get('next');
  if(!next)return '/app/dashboard';
  try{const url=new URL(next,'https://tutahealth.ge');if(url.origin!=='https://tutahealth.ge'||!/^\/(?:market(?:\/|$)|app(?:\/|$)|community(?:\/|$)|consultation(?:\/|$))/.test(url.pathname))return '/app/dashboard';return url.pathname+url.search}catch{return '/app/dashboard'}
}
