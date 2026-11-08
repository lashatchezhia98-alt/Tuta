"use client";
import {useEffect,useState} from 'react';
import BrandMark from '@/components/brand-mark';
import HeaderActions from '@/components/header-actions';
import MarketOrders from '@/components/market-orders';
export default function OrdersPage(){const [lang,setLang]=useState<'ka'|'en'>('ka');useEffect(()=>{if(localStorage.getItem('tuta-language')==='en')setLang('en')},[]);return <><header className="inner-header"><div className="inner-container inner-nav"><a href="/" className="inner-logo"><BrandMark/><strong>{lang==='ka'?'თუთა':'TUTA'}</strong></a><HeaderActions lang={lang} setLang={next=>{setLang(next);localStorage.setItem('tuta-language',next);document.documentElement.lang=next}}/></div></header><main className="inner-container settings-workspace"><MarketOrders lang={lang}/></main></>}
