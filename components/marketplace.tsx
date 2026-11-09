"use client";
import { SiteCopyText, useSiteCopyText } from "@/components/site-copy-provider";


import { useEffect, useMemo, useRef, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import Link from "next/link";

type Lang = "ka" | "en";
type Category = "period-care" | "body-care" | "nutrition" | "accessories";
type Product = {
  id: string;
  name: string;
  description: string;
  category: Category;
  price_tetri: number;
  image_url: string | null;
  image_urls?: string[] | null;
};
type CartRow = { product: Product; quantity: number };
const CART_KEY = "tuta-market-cart-v1";
function rememberCart(rows: CartRow[]) {
  try {
    localStorage.setItem(
      CART_KEY,
      JSON.stringify(
        rows.map((row) => ({ id: row.product.id, quantity: row.quantity })),
      ),
    );
  } catch {
    /* Shopping still works without browser storage. */
  }
  return rows;
}
function restoreCart(products: Product[]): CartRow[] {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(CART_KEY) || "[]");
    if (!Array.isArray(saved)) return [];
    const amounts = new Map<string, number>();
    for (const row of saved.slice(0, 100)) {
      if (
        row &&
        typeof row.id === "string" &&
        Number.isInteger(row.quantity) &&
        row.quantity > 0
      )
        amounts.set(
          row.id,
          Math.min(20, (amounts.get(row.id) || 0) + row.quantity),
        );
    }
    return products
      .filter((p) => amounts.has(p.id))
      .slice(0, 20)
      .map((product) => ({ product, quantity: amounts.get(product.id)! }));
  } catch {
    return [];
  }
}
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
  const lat = (Math.max(-85.0511, Math.min(85.0511, latitude)) * Math.PI) / 180;
  return {
    x: ((longitude + 180) / 360) * tileScale,
    y: ((1 - Math.asinh(Math.tan(lat)) / Math.PI) / 2) * tileScale,
  };
}
function unproject(x: number, y: number) {
  const longitude = (x / tileScale) * 360 - 180;
  const latitude =
    (Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / tileScale))) * 180) / Math.PI;
  return {
    latitude: Number(latitude.toFixed(6)),
    longitude: Number(longitude.toFixed(6)),
  };
}

function ProductGallery({ product, lang }: { product: Product; lang: Lang }) {
  const images = product.image_urls?.length
    ? product.image_urls
    : product.image_url
      ? [product.image_url]
      : [];
  const [active, setActive] = useState(0);
  if (!images.length)
    return (
      <div className="market-product-image market-product-placeholder">
        <span>✳</span>
      </div>
    );
  const current = active % images.length;
  return (
    <div className="market-product-gallery">
      <div
        className="market-product-image"
        style={{ backgroundImage: `url(${JSON.stringify(images[current])})` }}
        role="img"
        aria-label={`${product.name} — ${lang === "ka" ? "ფოტო" : "photo"} ${current + 1} ${lang === "ka" ? "სულ" : "of"} ${images.length}`}
      />
      {images.length > 1 && (
        <>
          <button
            className="market-gallery-arrow previous"
            type="button"
            aria-label={lang === "ka" ? "წინა ფოტო" : "Previous photo"}
            onClick={() =>
              setActive((current - 1 + images.length) % images.length)
            }
          >
            ‹
          </button>
          <button
            className="market-gallery-arrow next"
            type="button"
            aria-label={lang === "ka" ? "შემდეგი ფოტო" : "Next photo"}
            onClick={() => setActive((current + 1) % images.length)}
          >
            ›
          </button>
          <span className="market-gallery-count">
            {current + 1} / {images.length}
          </span>
        </>
      )}
    </div>
  );
}

function PinMap({
  lang,
  pin,
  onChange,
}: {
  lang: Lang;
  pin: { latitude: number; longitude: number };
  onChange: (value: { latitude: number; longitude: number }) => void;
}) {
  const [error, setError] = useState("");
  const centerPx = project(pin.latitude, pin.longitude);
  const centerTileX = Math.floor(centerPx.x / 256),
    centerTileY = Math.floor(centerPx.y / 256);
  const dx = centerPx.x - centerTileX * 256,
    dy = centerPx.y - centerTileY * 256;
  const tiles = Array.from({ length: 9 }, (_, i) => ({
    x: centerTileX + (i % 3) - 1,
    y: centerTileY + Math.floor(i / 3) - 1,
  }));
  function pick(event: React.MouseEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const next = unproject(
      centerPx.x + event.clientX - rect.left - rect.width / 2,
      centerPx.y + event.clientY - rect.top - rect.height / 2,
    );
    onChange(next);
  }
  function pickWithKeyboard(event: React.KeyboardEvent<HTMLDivElement>) {
    const delta: Record<string, [number, number]> = {
      ArrowLeft: [-80, 0],
      ArrowRight: [80, 0],
      ArrowUp: [0, -80],
      ArrowDown: [0, 80],
    };
    if (delta[event.key]) {
      event.preventDefault();
      const [x, y] = delta[event.key];
      onChange(unproject(centerPx.x + x, centerPx.y + y));
      return;
    }
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    onChange(unproject(centerPx.x, centerPx.y));
  }
  function locate() {
    if (!navigator.geolocation) {
      setError(
        lang === "ka"
          ? "მდებარეობის განსაზღვრა მიუწვდომელია. აირჩიე პინი რუკაზე."
          : "Location unavailable. Choose a pin on the map.",
      );
      return;
    }
    setError("");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const next = {
          latitude: Number(position.coords.latitude.toFixed(6)),
          longitude: Number(position.coords.longitude.toFixed(6)),
        };
        onChange(next);
      },
      () =>
        setError(
          lang === "ka"
            ? "მდებარეობა ვერ განისაზღვრა. აირჩიე პინი რუკაზე."
            : "Could not locate you. Choose a pin on the map.",
        ),
    );
  }
  return (
    <div className="market-map-wrap">
      <div
        role="button"
        tabIndex={0}
        aria-label={
          lang === "ka"
            ? "რუკა — დააჭირე ან Enter გამოიყენე პინის დასასმელად"
            : "Map — click or press Enter to place the pin"
        }
        className="market-map"
        onClick={pick}
        onKeyDown={pickWithKeyboard}
      >
        {tiles.map((tile) => (
          <div
            key={`${tile.x}-${tile.y}`}
            className="market-map-tile"
            style={{
              left: `calc(50% + ${(tile.x - centerTileX) * 256 - dx}px)`,
              top: `calc(50% + ${(tile.y - centerTileY) * 256 - dy}px)`,
              backgroundImage: `url(https://tile.openstreetmap.org/${zoom}/${tile.x}/${tile.y}.png)`,
            }}
          />
        ))}
        <span className="market-map-pin" aria-hidden="true">
          ●
        </span>
        <span className="market-map-help">
          {lang === "ka"
            ? "რუკაზე დააჭირე პინის დასასმელად"
            : "Click the map to place the pin"}
        </span>
      </div>
      <div className="market-map-meta">
        <span>
          {pin.latitude.toFixed(5)}, {pin.longitude.toFixed(5)}
        </span>
        <button type="button" onClick={locate}>
          {lang === "ka" ? "ჩემი მდებარეობა" : "Use my location"}
        </button>
      </div>
      {error && <p role="alert">{error}</p>}
      <small>© OpenStreetMap contributors</small>
    </div>
  );
}

export default function Marketplace({ lang }: { lang: Lang }) {
  const ka = lang === "ka";
  const addLabel = useSiteCopyText("market.add", lang);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState<Category | "all">("all");
  const [cart, setCart] = useState<CartRow[]>([]);
  const [recipientName, setRecipientName] = useState("");
  const [address, setAddress] = useState("");
  const [pin, setPin] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [signedIn, setSignedIn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const authVersion = useRef(0),
    pendingCheckout = useRef<AbortController | null>(null);
  useEffect(() => {
    const accountEpoch = authVersion;
    let active = true;
    let unsubscribe = () => {},
      observed = false,
      owner: string | null | undefined;
    try {
      const client = getSupabaseBrowserClient();
      const {
        data: { subscription },
      } = client.auth.onAuthStateChange((_event, session) => {
        if (!active) return;
        observed = true;
        const nextOwner = session?.user.id ?? null;
        setSignedIn(Boolean(session && !session.user.is_anonymous));
        if (owner !== undefined && owner !== nextOwner) {
          authVersion.current++;
          pendingCheckout.current?.abort();
          setBusy(false);
          setNotice("");
          setRecipientName("");
          setAddress("");
          setPin(null);
        }
        owner = nextOwner;
      });
      unsubscribe = () => subscription.unsubscribe();
    } catch {
      /* Account errors are shown at checkout. */
    }
    void fetch("/api/market/products", { cache: "no-store" })
      .then(async (response) => {
        const data = (await response.json()) as {
          products?: Product[];
          error?: string;
        };
        if (!response.ok)
          throw new Error(data.error || "პროდუქტები ვერ ჩაიტვირთა.");
        if (active) {
          setProducts(data.products || []);
          setCart(restoreCart(data.products || []));
        }
      })
      .catch((error) => {
        if (active)
          setNotice(
            error instanceof Error
              ? error.message
              : "პროდუქტები ვერ ჩაიტვირთა.",
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    try {
      void getSupabaseBrowserClient()
        .auth.getSession()
        .then(({ data }) => {
          if (active && !observed) {
            owner = data.session?.user.id ?? null;
            setSignedIn(
              Boolean(data.session && !data.session.user.is_anonymous),
            );
          }
        })
        .catch(() => {});
    } catch {
      /* Auth setup can be completed later. */
    }
    return () => {
      active = false;
      accountEpoch.current++;
      pendingCheckout.current?.abort();
      unsubscribe();
    };
  }, []);
  const visibleProducts = useMemo(
    () =>
      category === "all"
        ? products
        : products.filter((product) => product.category === category),
    [products, category],
  );
  const total = cart.reduce(
    (sum, row) => sum + row.product.price_tetri * row.quantity,
    0,
  );
  function add(product: Product) {
    const existing = cart.find((row) => row.product.id === product.id);
    if (!existing && cart.length >= 20) {
      setNotice(
        ka
          ? "კალათაში მაქსიმუმ 20 სახეობის პროდუქტი შეიძლება იყოს."
          : "Maximum 20 different products per order.",
      );
      return;
    }
    setCart(
      rememberCart(
        existing
          ? cart.map((row) =>
              row.product.id === product.id
                ? { ...row, quantity: Math.min(row.quantity + 1, 20) }
                : row,
            )
          : [...cart, { product, quantity: 1 }],
      ),
    );
    setNotice(ka ? "დაემატა კალათაში." : "Added to cart.");
  }
  function quantity(id: string, delta: number) {
    setCart(
      rememberCart(
        cart.flatMap((row) =>
          row.product.id !== id
            ? [row]
            : row.quantity + delta < 1
              ? []
              : [{ ...row, quantity: Math.min(20, row.quantity + delta) }],
        ),
      ),
    );
  }
  async function checkout() {
    if (!signedIn) {
      setNotice(
        ka
          ? "შეკვეთის გასაფორმებლად ჯერ შედი ანგარიშში."
          : "Sign in before placing an order.",
      );
      return;
    }
    setBusy(true);
    setNotice("");
    const version = authVersion.current;
    const controller = new AbortController();
    pendingCheckout.current?.abort();
    pendingCheckout.current = controller;
    try {
      const session = (await getSupabaseBrowserClient().auth.getSession()).data
        .session;
      if (version !== authVersion.current || controller.signal.aborted) return;
      if (!session || session.user.is_anonymous)
        throw new Error(
          ka
            ? "შედი რეგისტრირებული ანგარიშით და სცადე თავიდან."
            : "Sign in with a registered account and try again.",
        );
      const response = await fetch("/api/market/checkout", {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          recipientName,
          address,
          latitude: pin?.latitude ?? null,
          longitude: pin?.longitude ?? null,
          items: cart.map((row) => ({
            productId: row.product.id,
            quantity: row.quantity,
          })),
        }),
      });
      const data = (await response.json()) as {
        checkoutUrl?: string;
        error?: string;
        testMode?: boolean;
      };
      const current = (await getSupabaseBrowserClient().auth.getSession()).data
        .session;
      if (
        version !== authVersion.current ||
        controller.signal.aborted ||
        current?.user.id !== session.user.id
      )
        return;
      if (!response.ok || !data.checkoutUrl)
        throw new Error(
          data.error ||
            (ka ? "გადახდის გვერდი ვერ გაიხსნა." : "Could not start checkout."),
        );
      const destination = new URL(data.checkoutUrl);
      if (
        destination.protocol !== "https:" ||
        destination.hostname !== "pay.flitt.com" ||
        destination.username ||
        destination.password
      )
        throw Error(
          ka ? "გადახდის მისამართი არასწორია." : "Invalid payment destination.",
        );
      window.location.assign(destination.href);
    } catch (error) {
      if (version === authVersion.current && !controller.signal.aborted)
        setNotice(
          error instanceof Error ? error.message : "გადახდა ვერ დაიწყო.",
        );
    } finally {
      if (
        version === authVersion.current &&
        pendingCheckout.current === controller
      ) {
        setBusy(false);
        pendingCheckout.current = null;
      }
    }
  }

  return (
    <>
      <section className="inner-hero compact market-hero">
        <div className="inner-container">
          <span className="inner-kicker">TUTA · MARKET</span>
          <h1><SiteCopyText id="market.title" lang={lang}/></h1>
          <p>
            <SiteCopyText id="market.intro" lang={lang}/>
          </p>
        </div>
      </section>
      <main className="marketplace inner-container">
        <p>
          <Link href="/market/orders">
            <SiteCopyText id="market.orders" lang={lang}/>
          </Link>
        </p>
        <section
          aria-label={ka ? "პროდუქტის ფილტრები" : "Product filters"}
          className="market-filters"
        >
          <button
            type="button"
            className={category === "all" ? "active" : ""}
            aria-pressed={category === "all"}
            onClick={() => setCategory("all")}
          >
            {ka ? "ყველა" : "All"}
          </button>
          {categories.map((item) => (
            <button
              type="button"
              key={item.id}
              className={category === item.id ? "active" : ""}
              aria-pressed={category === item.id}
              onClick={() => setCategory(item.id)}
            >
              {item[lang]}
            </button>
          ))}
        </section>
        {notice && (
          <p role="status" className="market-notice">
            {notice}
          </p>
        )}
        {loading ? (
          <p className="market-loading">
            {ka ? "პროდუქტები იტვირთება…" : "Loading products…"}
          </p>
        ) : visibleProducts.length ? (
          <section className="market-product-grid">
            {visibleProducts.map((product) => (
              <article className="market-product-card" key={product.id}>
                <ProductGallery product={product} lang={lang} />
                <div className="market-product-info">
                  <small>
                    {
                      categories.find((item) => item.id === product.category)?.[
                        lang
                      ]
                    }
                  </small>
                  <h2>{product.name}</h2>
                  <p>{product.description}</p>
                  <div>
                    <strong>{(product.price_tetri / 100).toFixed(2)} ₾</strong>
                    <button
                      type="button"
                      onClick={() => add(product)}
                      aria-label={`${addLabel}: ${product.name}`}
                    >
                      <SiteCopyText id="market.add" lang={lang}/>
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </section>
        ) : (
          <div className="market-empty">
            <span>✳</span>
            <h2>
              {ka ? "მარკეტი მალე შეივსება" : "The market is getting ready"}
            </h2>
            <p>
              {ka
                ? "პროდუქტებს ადმინისტრატორი დაამატებს. მოგვიანებით დაბრუნდი."
                : "Products will appear here once the administrator adds them. Check back soon."}
            </p>
          </div>
        )}
        {cart.length > 0 && (
          <section className="market-checkout" id="cart">
            <div className="market-checkout-heading">
              <div>
                <span className="inner-kicker">TUTA · CART</span>
                <h2><SiteCopyText id="market.cart" lang={lang}/></h2>
              </div>
              <span>
                {cart.reduce((sum, row) => sum + row.quantity, 0)}{" "}
                {ka ? "პროდუქტი" : "items"}
              </span>
            </div>
            <div className="market-cart-lines">
              {cart.map((row) => (
                <article key={row.product.id}>
                  <div>
                    <strong>{row.product.name}</strong>
                    <small>
                      {(row.product.price_tetri / 100).toFixed(2)} ₾
                    </small>
                  </div>
                  <div className="market-quantity">
                    <button
                      type="button"
                      aria-label={
                        ka ? "რაოდენობის შემცირება" : "Decrease quantity"
                      }
                      onClick={() => quantity(row.product.id, -1)}
                    >
                      −
                    </button>
                    <span>{row.quantity}</span>
                    <button
                      disabled={row.quantity >= 20}
                      type="button"
                      aria-label={
                        ka ? "რაოდენობის გაზრდა" : "Increase quantity"
                      }
                      onClick={() => quantity(row.product.id, 1)}
                    >
                      +
                    </button>
                  </div>
                  <strong>
                    {((row.product.price_tetri * row.quantity) / 100).toFixed(
                      2,
                    )}{" "}
                    ₾
                  </strong>
                </article>
              ))}
            </div>
            {!pin && (
              <p>
                {ka
                  ? "პინი ჯერ არ აგირჩევია. რუკა აჩვენებს საწყის ხედს და არა შენს მისამართს. პინი სურვილისამებრ მიუთითე."
                  : "No pin selected. The map is an initial view, not your address. Choosing a pin is optional."}
              </p>
            )}
            <div className="market-total">
              <span><SiteCopyText id="market.total" lang={lang}/></span>
              <strong>{(total / 100).toFixed(2)} ₾</strong>
            </div>
            <div className="market-delivery">
              <div>
                <span className="inner-kicker">
                  <SiteCopyText id="market.delivery" lang={lang}/>
                </span>
                <h3><SiteCopyText id="market.deliveryTitle" lang={lang}/></h3>
                <p>
                  <SiteCopyText id="market.deliveryNote" lang={lang}/>
                </p>
              </div>
              <label>
                <SiteCopyText id="market.recipient" lang={lang}/>
                <input
                  required
                  minLength={2}
                  maxLength={120}
                  value={recipientName}
                  onChange={(event) => setRecipientName(event.target.value)}
                  autoComplete="name"
                />
              </label>
              <label>
                <SiteCopyText id="market.address" lang={lang}/>
                <textarea
                  required
                  minLength={5}
                  maxLength={500}
                  rows={3}
                  value={address}
                  onChange={(event) => setAddress(event.target.value)}
                  placeholder={
                    ka
                      ? "ქალაქი, ქუჩა, სახლის ნომერი, სადარბაზო"
                      : "City, street, building, entrance"
                  }
                />
              </label>
              <div className="market-pin-label">
                <strong>
                  <SiteCopyText id="market.pin" lang={lang}/>
                </strong>
                <span>
                  <SiteCopyText id="market.pinNote" lang={lang}/>
                </span>
              </div>
              <PinMap lang={lang} pin={pin || initialPin} onChange={setPin} />
            </div>
            {!signedIn && (
              <p className="market-signin-note">
                {ka
                  ? "შეკვეთის გაფორმებამდე საჭიროა რეგისტრაცია."
                  : "Create an account or sign in before checkout."}{" "}
                <a href={`/login?next=${encodeURIComponent("/market#cart")}`}>
                  {ka ? "შესვლა" : "Sign in"}
                </a>{" "}
                ·{" "}
                <a
                  href={`/register?next=${encodeURIComponent("/market#cart")}`}
                >
                  {ka ? "ანგარიშის შექმნა" : "Create account"}
                </a>
              </p>
            )}
            <button
              type="button"
              className="market-pay-button"
              disabled={
                busy || !recipientName.trim() || address.trim().length < 5
              }
              onClick={() => void checkout()}
            >
              {busy
                ? ka
                  ? "გადასვლა…"
                  : "Opening checkout…"
                : <SiteCopyText id="market.pay" lang={lang}/>}
            </button>
            <p className="market-test-note">
              <SiteCopyText id="market.testPaymentNote" lang={lang}/>
            </p>
          </section>
        )}
      </main>
    </>
  );
}
