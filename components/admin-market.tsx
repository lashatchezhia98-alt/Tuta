"use client";

import { useCallback, useEffect, useState } from "react";

type Lang = "ka" | "en";
type Category = "period-care" | "body-care" | "nutrition" | "accessories";
type Product = { id: string; name: string; description: string; category: Category; price_tetri: number; image_url: string | null; image_urls?: string[]; is_active: boolean };
const categories: { id: Category; ka: string; en: string }[] = [
  { id: "period-care", ka: "პერიოდის მოვლა", en: "Period care" },
  { id: "body-care", ka: "სხეულის მოვლა", en: "Body care" },
  { id: "nutrition", ka: "კვება", en: "Nutrition" },
  { id: "accessories", ka: "აქსესუარები", en: "Accessories" },
];
const empty = { name: "", description: "", category: "period-care" as Category, priceGEL: "", imageUrl: "", imageUrls: [] as string[], is_active: true };

export default function AdminMarket({ lang }: { lang: Lang }) {
  const ka = lang === "ka";
  const [products, setProducts] = useState<Product[]>([]);
  const [form, setForm] = useState(empty);
  const [editing, setEditing] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [notice, setNotice] = useState("");
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/market", { cache: "no-store" });
      const data = await response.json() as { products?: Product[]; error?: string };
      if (!response.ok) throw new Error(data.error || "პროდუქტები ვერ ჩაიტვირთა.");
      setProducts(data.products || []);
    } catch (error) { setNotice(error instanceof Error ? error.message : "პროდუქტები ვერ ჩაიტვირთა."); }
    finally { setLoading(false); }
  }, []);
  // Loading asynchronously here keeps admin data fresh when this panel opens.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, [load]);

  function edit(product: Product) {
    setEditing(product.id);
    setForm({ name: product.name, description: product.description, category: product.category, priceGEL: (product.price_tetri / 100).toFixed(2), imageUrl: "", imageUrls: product.image_urls?.length ? product.image_urls : product.image_url ? [product.image_url] : [], is_active: product.is_active });
    setNotice("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function uploadPhotos(files: FileList | null) {
    if (!files?.length) return;
    const selected = Array.from(files);
    if (form.imageUrls.length + selected.length > 8) { setNotice(ka ? "ერთ პროდუქტზე მაქსიმუმ 8 ფოტოს დამატებაა შესაძლებელი." : "You can add up to 8 photos per product."); return; }
    const allowed = new Set(["image/jpeg", "image/png", "image/webp"]);
    const invalid = selected.find(file => !allowed.has(file.type) || file.size > 8 * 1024 * 1024);
    if (invalid) { setNotice(ka ? "აირჩიე JPG, PNG ან WebP ფოტო, თითოეული მაქსიმუმ 8 მბ." : "Choose JPG, PNG or WebP images, up to 8 MB each."); return; }
    setUploading(true); setNotice(ka ? "ფოტოები იტვირთება…" : "Uploading photos…");
    try {
      const uploaded: string[] = [];
      for (const file of selected) {
        const signed = await fetch("/api/admin/market/image-signature", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
        const credentials = await signed.json() as { cloudName?: string; apiKey?: string; publicId?: string; timestamp?: number; signature?: string; error?: string };
        if (!signed.ok || !credentials.cloudName || !credentials.apiKey || !credentials.publicId || !credentials.timestamp || !credentials.signature) throw new Error(credentials.error || (ka ? "ფოტოს ატვირთვის პარამეტრები ვერ ჩაიტვირთა." : "Could not prepare photo upload."));
        const payload = new FormData();
        payload.set("file", file); payload.set("public_id", credentials.publicId); payload.set("timestamp", String(credentials.timestamp)); payload.set("api_key", credentials.apiKey); payload.set("signature", credentials.signature);
        const response = await fetch(`https://api.cloudinary.com/v1_1/${credentials.cloudName}/image/upload`, { method: "POST", body: payload });
        const image = await response.json() as { secure_url?: string; error?: { message?: string } };
        if (!response.ok || !image.secure_url) throw new Error(image.error?.message || (ka ? "ფოტოს ატვირთვა ვერ მოხერხდა." : "Photo upload failed."));
        uploaded.push(image.secure_url);
        setForm(current => ({ ...current, imageUrls: [...current.imageUrls, image.secure_url!] }));
      }
      setNotice(ka ? `ატვირთულია ${uploaded.length} ფოტო.` : `Uploaded ${uploaded.length} photo${uploaded.length === 1 ? "" : "s"}.`);
    } catch (error) { setNotice(error instanceof Error ? error.message : (ka ? "ფოტოს ატვირთვა ვერ მოხერხდა." : "Photo upload failed.")); }
    finally { setUploading(false); }
  }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setNotice("");
    try {
      const response = await fetch("/api/admin/market", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, priceGEL: Number(form.priceGEL), ...(editing ? { id: editing } : {}) }) });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || "შენახვა ვერ მოხერხდა.");
      setNotice(ka ? "პროდუქტი შენახულია." : "Product saved."); setEditing(null); setForm(empty); await load();
    } catch (error) { setNotice(error instanceof Error ? error.message : "შენახვა ვერ მოხერხდა."); }
    finally { setBusy(false); }
  }

  async function remove(product: Product) {
    if (!window.confirm(ka ? `წავშალო „${product.name}“?` : `Delete “${product.name}”?`)) return;
    setBusy(true); setNotice("");
    try {
      const response = await fetch("/api/admin/market", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "delete", id: product.id }) });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || "წაშლა ვერ მოხერხდა.");
      if (editing === product.id) { setEditing(null); setForm(empty); }
      setNotice(ka ? "პროდუქტი წაიშალა." : "Product deleted."); await load();
    } catch (error) { setNotice(error instanceof Error ? error.message : "წაშლა ვერ მოხერხდა."); }
    finally { setBusy(false); }
  }

  return <div className="admin-market">
    <form className="admin-market-form" onSubmit={save}>
      <h2>{ka ? (editing ? "პროდუქტის შეცვლა" : "ახალი პროდუქტი") : (editing ? "Edit product" : "Add a product")}</h2>
      <label>{ka ? "პროდუქტის სახელი" : "Product name"}<input required minLength={2} maxLength={100} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}/></label>
      <label>{ka ? "მოკლე აღწერა" : "Short description"}<textarea required maxLength={500} rows={3} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}/></label>
      <div className="admin-market-fields"><label>{ka ? "კატეგორია" : "Category"}<select value={form.category} onChange={e => setForm({ ...form, category: e.target.value as Category })}>{categories.map(item => <option key={item.id} value={item.id}>{item[lang]}</option>)}</select></label><label>{ka ? "ფასი (₾)" : "Price (GEL)"}<input required type="number" min="0.01" max="100000" step="0.01" value={form.priceGEL} onChange={e => setForm({ ...form, priceGEL: e.target.value })}/></label></div>
      <label>{ka ? "პროდუქტის ფოტოები (მაქსიმუმ 8)" : "Product photos (up to 8)"}<input type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={uploading || form.imageUrls.length >= 8} onChange={event => { void uploadPhotos(event.target.files); event.currentTarget.value = ""; }}/><small>{ka ? "JPG, PNG ან WebP · თითოეული მაქსიმუმ 8 მბ. ფოტოს ატვირთვა Cloudinary-ში ხდება." : "JPG, PNG or WebP · max 8 MB each. Photos are uploaded to Cloudinary."}</small></label>
      {form.imageUrls.length > 0 && <div className="admin-market-image-list">{form.imageUrls.map((url, index) => <div className="admin-market-image-item" key={`${url}-${index}`}><img src={url} alt={`${ka ? "პროდუქტის ფოტო" : "Product photo"} ${index + 1}`}/><button type="button" disabled={busy || uploading} aria-label={ka ? `ფოტო ${index + 1}-ის ამოშლა` : `Remove photo ${index + 1}`} onClick={() => setForm(current => ({ ...current, imageUrls: current.imageUrls.filter((_, photoIndex) => photoIndex !== index) }))}>×</button></div>)}</div>}
      {uploading && <p role="status" className="admin-market-notice">{ka ? "ატვირთვა მიმდინარეობს…" : "Upload in progress…"}</p>}
      <label className="admin-market-active"><input type="checkbox" checked={form.is_active} onChange={e => setForm({ ...form, is_active: e.target.checked })}/>{ka ? "მომხმარებლის მარკეტში გამოჩენა" : "Show in customer market"}</label>
      <div className="admin-market-actions"><button type="submit" disabled={busy || uploading}>{busy ? (ka ? "ინახება…" : "Saving…") : (ka ? "შენახვა" : "Save product")}</button>{editing && <button type="button" className="secondary" onClick={() => { setEditing(null); setForm(empty); }}>{ka ? "გაუქმება" : "Cancel"}</button>}</div>
      {notice && <p role="status" className="admin-market-notice">{notice}</p>}
    </form>
    <section className="admin-market-list"><h2>{ka ? "მარკეტის კატალოგი" : "Market catalog"}</h2>{loading ? <p>{ka ? "იტვირთება…" : "Loading…"}</p> : products.length ? products.map(product => <article key={product.id} className="admin-market-product"><div><strong>{product.name}</strong><p>{product.description}</p><small>{categories.find(item => item.id === product.category)?.[lang]} · {(product.price_tetri / 100).toFixed(2)} ₾ · {product.is_active ? (ka ? "ჩართულია" : "Visible") : (ka ? "დამალულია" : "Hidden")}</small></div><div><button type="button" disabled={busy} onClick={() => edit(product)}>{ka ? "შეცვლა" : "Edit"}</button><button type="button" className="secondary" disabled={busy} aria-label={ka ? `პროდუქტის წაშლა: ${product.name}` : `Delete product: ${product.name}`} onClick={() => void remove(product)}>{ka ? "წაშლა" : "Delete"}</button></div></article>) : <p className="admin-market-empty">{ka ? "ჯერ პროდუქტი არ დაგიმატებია. გამოიყენე ფორმა კატალოგის შესავსებად." : "No products yet. Use the form to build your catalog."}</p>}</section>
  </div>;
}
