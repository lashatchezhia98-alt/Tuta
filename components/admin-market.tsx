"use client";

import { useCallback, useEffect, useState } from "react";

type Lang = "ka" | "en";
type Category = "period-care" | "body-care" | "nutrition" | "accessories";
type Product = { id: string; name: string; description: string; category: Category; price_tetri: number; image_url: string | null; is_active: boolean };
const categories: { id: Category; ka: string; en: string }[] = [
  { id: "period-care", ka: "პერიოდის მოვლა", en: "Period care" },
  { id: "body-care", ka: "სხეულის მოვლა", en: "Body care" },
  { id: "nutrition", ka: "კვება", en: "Nutrition" },
  { id: "accessories", ka: "აქსესუარები", en: "Accessories" },
];
const empty = { name: "", description: "", category: "period-care" as Category, priceGEL: "", imageUrl: "", is_active: true };

export default function AdminMarket({ lang }: { lang: Lang }) {
  const ka = lang === "ka";
  const [products, setProducts] = useState<Product[]>([]);
  const [form, setForm] = useState(empty);
  const [editing, setEditing] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
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
  useEffect(() => { void load(); }, [load]);

  function edit(product: Product) {
    setEditing(product.id);
    setForm({ name: product.name, description: product.description, category: product.category, priceGEL: (product.price_tetri / 100).toFixed(2), imageUrl: product.image_url || "", is_active: product.is_active });
    setNotice("");
    window.scrollTo({ top: 0, behavior: "smooth" });
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
      <label>{ka ? "ფოტოს ბმული (არასავალდებულო)" : "Image URL (optional)"}<input type="url" value={form.imageUrl} onChange={e => setForm({ ...form, imageUrl: e.target.value })} placeholder="https://…"/></label>
      <label className="admin-market-active"><input type="checkbox" checked={form.is_active} onChange={e => setForm({ ...form, is_active: e.target.checked })}/>{ka ? "მომხმარებლის მარკეტში გამოჩენა" : "Show in customer market"}</label>
      <div className="admin-market-actions"><button type="submit" disabled={busy}>{busy ? (ka ? "ინახება…" : "Saving…") : (ka ? "შენახვა" : "Save product")}</button>{editing && <button type="button" className="secondary" onClick={() => { setEditing(null); setForm(empty); }}>{ka ? "გაუქმება" : "Cancel"}</button>}</div>
      {notice && <p role="status" className="admin-market-notice">{notice}</p>}
    </form>
    <section className="admin-market-list"><h2>{ka ? "მარკეტის კატალოგი" : "Market catalog"}</h2>{loading ? <p>{ka ? "იტვირთება…" : "Loading…"}</p> : products.length ? products.map(product => <article key={product.id} className="admin-market-product"><div><strong>{product.name}</strong><p>{product.description}</p><small>{categories.find(item => item.id === product.category)?.[lang]} · {(product.price_tetri / 100).toFixed(2)} ₾ · {product.is_active ? (ka ? "ჩართულია" : "Visible") : (ka ? "დამალულია" : "Hidden")}</small></div><div><button type="button" disabled={busy} onClick={() => edit(product)}>{ka ? "შეცვლა" : "Edit"}</button><button type="button" className="secondary" disabled={busy} onClick={() => void remove(product)}>{ka ? "წაშლა" : "Delete"}</button></div></article>) : <p className="admin-market-empty">{ka ? "ჯერ პროდუქტი არ დაგიმატებია. გამოიყენე ფორმა კატალოგის შესავსებად." : "No products yet. Use the form to build your catalog."}</p>}</section>
  </div>;
}
