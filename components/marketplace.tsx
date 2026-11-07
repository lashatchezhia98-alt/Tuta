"use client";

import { useEffect, useMemo, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

type Lang = "ka" | "en";
type Category = "period-care" | "body-care" | "nutrition" | "accessories";
type Product = { id: string; name: string; description: string; category: Category; price_tetri: number; image_url: string | null };
type CartRow = { product: Product; quantity: number };
const categories: { id: Category; ka: string; en: string }[] = [
  { id: "period-care", ka: "პერიოდის მოვლა", en: "Period care" },
  { id: "body-care", ka: "სხეულის მოვლა", en: "Body care" },
  { id: "nutrition", ka: "კვება", en: "Nutrition" },
  { id: "accessories", ka: "აქსესუარები", en: "Accessories" },
];
const initialPin = { latitude: 41.7151, longitude: 44.8271 };
const zoom = 14;
const tileScale = 256 * 2 ** zoom;
function project(latitude: number, longitude: number) {
  const lat = Math.max(-85.0511, Math.min(85.0511, latitude)) * Math.PI / 180;
  return { x: (longitude + 180) / 360 * tileScale, y: (1 - Math.asinh(Math.tan(lat)) / Math.PI) / 2 * tileScale };
}
function unproject(x: number, y: number) {
  const longitude = x / tileScale * 360 - 180;
  const latitude = Math.atan(Math.sinh(Math.PI * (1 - 2 * y / tileScale))) * 180 / Math.PI;
  return { latitude: Number(latitude.toFixed(6)), longitude: Number(longitude.toFixed(6)) };
}

function PinMap({ lang, pin, onChange }: { lang: Lang; pin: { latitude: number; longitude: number }; onChange: (value: { latitude: number; longitude: number }) => void }) {
  const [mapCenter, setMapCenter] = useState(pin);
  useEffect(() => setMapCenter(pin), [pin.latitude, pin.longitude]);
  const centerPx = project(mapCenter.latitude, mapCenter.longitude);
  const centerTileX = Math.floor(centerPx.x / 256), centerTileY = Math.floor(centerPx.y / 256);
  const dx = centerPx.x - centerTileX * 256, dy = centerPx.y - centerTileY * 256;
  const tiles = Array.from({ length: 9 }, (_, i) => ({ x: centerTileX + i % 3 - 1, y: centerTileY + Math.floor(i / 3) - 1 }));
  function pick(event: React.MouseEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const next = unproject(centerPx.x + event.clientX - rect.left - rect.width / 2, centerPx.y + event.clientY - rect.top - rect.height / 2);
    onChange(next);
    setMapCenter(next);
  }
  function locate() {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(position => {
      const next = { latitude: Number(position.coords.latitude.toFixed(6)), longitude: Number(position.coords.longitude.toFixed(6)) };
      onChange(next); setMapCenter(next);
    }, () => {});
  }
  return <div className="market-map-wrap"><div role="application" aria-label={lang === "ka" ? "რუკა — დააჭირე მისამართის პინის დასასმელად" : "Map — click to place the address pin"} className="market-map" onClick={pick}>
    {tiles.map(tile => <div key={`${tile.x}-${tile.y}`} className="market-map-tile" style={{ left: `calc(50% + ${(tile.x - centerTileX) * 256 - dx}px)`, top: `calc(50% + ${(tile.y - centerTileY) * 256 - dy}px)`, backgroundImage: `url(https://tile.openstreetmap.org/${zoom}/${tile.x}/${tile.y}.png)` }}/ >)}
    <span className="market-map-pin" aria-hidden="true">●</span>
    <span className="market-map-help">{lang === "ka" ? "რუკაზე დააჭირე პინის დასასმელად" : "Click the map to place the pin"}</span>
  </div><div className="market-map-meta"><span>{pin.latitude.toFixed(5)}, {pin.longitude.toFixed(5)}</span><button type="button" onClick={locate}>{lang === "ka" ? "ჩემი მდებარეობა" : "Use my location"}</button></div><small>© OpenStreetMap contributors</small></div>;
}

export default function Marketplace({ lang }: { lang: Lang }) {
  const ka = lang === "ka";
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState<Category | "all">("all");
  const [cart, setCart] = useState<CartRow[]>([]);
  const [recipientName, setRecipientName] = useState("");
  const [address, setAddress] = useState("");
  const [pin, setPin] = useState<{ latitude: number; longitude: number } | null>(initialPin);
  const [signedIn, setSignedIn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  useEffect(() => {
    let active = true;
    void fetch("/api/market/products", { cache: "no-store" }).then(async response => {
      const data = await response.json() as { products?: Product[]; error?: string };
      if (!response.ok) throw new Error(data.error || "პროდუქტები ვერ ჩაიტვირთა.");
      if (active) setProducts(data.products || []);
    }).catch(error => { if (active) setNotice(error instanceof Error ? error.message : "პროდუქტები ვერ ჩაიტვირთა."); }).finally(() => { if (active) setLoading(false); });
    try { void getSupabaseBrowserClient().auth.getSession().then(({ data }) => { if (active) setSignedIn(Boolean(data.session && !data.session.user.is_anonymous)); }).catch(() => {}); } catch { /* Auth setup can be completed later. */ }
    return () => { active = false; };
  }, []);
  const visibleProducts = useMemo(() => category === "all" ? products : products.filter(product => product.category === category), [products, category]);
  const total = cart.reduce((sum, row) => sum + row.product.price_tetri * row.quantity, 0);
  function add(product: Product) { setCart(rows => { const existing = rows.find(row => row.product.id === product.id); return existing ? rows.map(row => row.product.id === product.id ? { ...row, quantity: Math.min(row.quantity + 1, 20) } : row) : [...rows, { product, quantity: 1 }]; }); setNotice(ka ? "დაემატა კალათაში." : "Added to cart."); }
  function quantity(id: string, delta: number) { setCart(rows => rows.flatMap(row => row.product.id !== id ? [row] : row.quantity + delta < 1 ? [] : [{ ...row, quantity: row.quantity + delta }])); }
  async function checkout() {
    if (!signedIn) { setNotice(ka ? "შეკვეთის გასაფორმებლად ჯერ შედი ანგარიშში." : "Sign in before placing an order."); return; }
    setBusy(true); setNotice("");
    try {
      const session = (await getSupabaseBrowserClient().auth.getSession()).data.session;
      if (!session || session.user.is_anonymous) throw new Error(ka ? "შედი რეგისტრირებული ანგარიშით და სცადე თავიდან." : "Sign in with a registered account and try again.");
      const response = await fetch("/api/market/checkout", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` }, body: JSON.stringify({ recipientName, address, latitude: pin?.latitude ?? null, longitude: pin?.longitude ?? null, items: cart.map(row => ({ productId: row.product.id, quantity: row.quantity })) }) });
      const data = await response.json() as { checkoutUrl?: string; error?: string; testMode?: boolean };
      if (!response.ok || !data.checkoutUrl) throw new Error(data.error || (ka ? "გადახდის გვერდი ვერ გაიხსნა." : "Could not start checkout."));
      window.location.assign(data.checkoutUrl);
    } catch (error) { setNotice(error instanceof Error ? error.message : "გადახდა ვერ დაიწყო."); }
    finally { setBusy(false); }
  }

  return <><section className="inner-hero compact market-hero"><div className="inner-container"><span className="inner-kicker">TUTA · MARKET</span><h1>{ka ? "მარკეტი / მაღაზია" : "Market / shop"}</h1><p>{ka ? "შერჩეული პროდუქტები ყოველდღიური თავის მოვლისთვის." : "Thoughtfully selected products for everyday care."}</p></div></section>
    <main className="marketplace inner-container">
      <section aria-label={ka ? "პროდუქტის ფილტრები" : "Product filters"} className="market-filters"><button type="button" className={category === "all" ? "active" : ""} aria-pressed={category === "all"} onClick={() => setCategory("all")}>{ka ? "ყველა" : "All"}</button>{categories.map(item => <button type="button" key={item.id} className={category === item.id ? "active" : ""} aria-pressed={category === item.id} onClick={() => setCategory(item.id)}>{item[lang]}</button>)}</section>
      {notice && <p role="status" className="market-notice">{notice}</p>}
      {loading ? <p className="market-loading">{ka ? "პროდუქტები იტვირთება…" : "Loading products…"}</p> : visibleProducts.length ? <section className="market-product-grid">{visibleProducts.map(product => <article className="market-product-card" key={product.id}>{product.image_url ? <div className="market-product-image" style={{ backgroundImage: `url(${JSON.stringify(product.image_url)})` }} role="img" aria-label={product.name}/> : <div className="market-product-image market-product-placeholder"><span>✳</span></div>}<div className="market-product-info"><small>{categories.find(item => item.id === product.category)?.[lang]}</small><h2>{product.name}</h2><p>{product.description}</p><div><strong>{(product.price_tetri / 100).toFixed(2)} ₾</strong><button type="button" onClick={() => add(product)} aria-label={`${ka ? "კალათაში დამატება" : "Add to cart"}: ${product.name}`}>{ka ? "კალათაში დამატება" : "Add to cart"}</button></div></div></article>)}</section> : <div className="market-empty"><span>✳</span><h2>{ka ? "მარკეტი მალე შეივსება" : "The market is getting ready"}</h2><p>{ka ? "პროდუქტებს ადმინისტრატორი დაამატებს. მოგვიანებით დაბრუნდი." : "Products will appear here once the administrator adds them. Check back soon."}</p></div>}
      {cart.length > 0 && <section className="market-checkout" id="cart"><div className="market-checkout-heading"><div><span className="inner-kicker">TUTA · CART</span><h2>{ka ? "შენი კალათა" : "Your cart"}</h2></div><span>{cart.reduce((sum, row) => sum + row.quantity, 0)} {ka ? "პროდუქტი" : "items"}</span></div>
        <div className="market-cart-lines">{cart.map(row => <article key={row.product.id}><div><strong>{row.product.name}</strong><small>{(row.product.price_tetri / 100).toFixed(2)} ₾</small></div><div className="market-quantity"><button type="button" aria-label={ka ? "რაოდენობის შემცირება" : "Decrease quantity"} onClick={() => quantity(row.product.id, -1)}>−</button><span>{row.quantity}</span><button type="button" aria-label={ka ? "რაოდენობის გაზრდა" : "Increase quantity"} onClick={() => quantity(row.product.id, 1)}>+</button></div><strong>{(row.product.price_tetri * row.quantity / 100).toFixed(2)} ₾</strong></article>)}</div>
        <div className="market-total"><span>{ka ? "ჯამი" : "Total"}</span><strong>{(total / 100).toFixed(2)} ₾</strong></div>
        <div className="market-delivery"><div><span className="inner-kicker">{ka ? "მიწოდება" : "DELIVERY"}</span><h3>{ka ? "სად მოგიტანოთ?" : "Where should we deliver?"}</h3><p>{ka ? "მისამართი საჭიროა მხოლოდ შეკვეთის მისაწოდებლად." : "Your address is only used to deliver this order."}</p></div><label>{ka ? "მიმღების სახელი" : "Recipient name"}<input required minLength={2} maxLength={120} value={recipientName} onChange={event => setRecipientName(event.target.value)} autoComplete="name"/></label><label>{ka ? "მისამართი" : "Delivery address"}<textarea required minLength={5} maxLength={500} rows={3} value={address} onChange={event => setAddress(event.target.value)} placeholder={ka ? "ქალაქი, ქუჩა, სახლის ნომერი, სადარბაზო" : "City, street, building, entrance"}/></label><div className="market-pin-label"><strong>{ka ? "მონიშნე პინი რუკაზე" : "Drop a pin on the map"}</strong><span>{ka ? "დააჭირე რუკაზე მიწოდების ადგილის ასარჩევად." : "Click the map to choose the delivery location."}</span></div><PinMap lang={lang} pin={pin || initialPin} onChange={setPin}/></div>
        {!signedIn && <p className="market-signin-note">{ka ? "შეკვეთის გაფორმებამდე საჭიროა რეგისტრაცია." : "Create an account or sign in before checkout."} <a href={`/login?next=${encodeURIComponent("/market#cart")}`}>{ka ? "შესვლა" : "Sign in"}</a> · <a href={`/register?next=${encodeURIComponent("/market#cart")}`}>{ka ? "ანგარიშის შექმნა" : "Create account"}</a></p>}
        <button type="button" className="market-pay-button" disabled={busy || !recipientName.trim() || address.trim().length < 5} onClick={() => void checkout()}>{busy ? (ka ? "გადასვლა…" : "Opening checkout…") : (ka ? "გადახდა · სატესტო რეჟიმი" : "Continue to payment · test mode")}</button><p className="market-test-note">{ka ? "გადახდა ახლა სატესტო რეჟიმში მუშაობს; რეალური ჩამოჭრა გამორთულია." : "Payments currently run in test mode; no real charge is made."}</p>
      </section>}
    </main></>;
}
