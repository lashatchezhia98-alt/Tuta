import { notFound } from 'next/navigation';
import FeatureDirectory from '@/components/feature-directory';
import { extraPages } from '@/lib/page-directory';
export const dynamicParams=false;
export function generateStaticParams(){return extraPages.map(p=>({section:p.slug}))}
export default async function Page({params}:{params:Promise<{section:string}>}){const {section}=await params;if(!extraPages.some(p=>p.slug===section))notFound();return <FeatureDirectory slug={section}/>}
