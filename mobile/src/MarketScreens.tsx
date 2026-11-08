import { createContext, useContext, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  Image,
  Linking,
  Pressable,
  ScrollView,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Session } from "@supabase/supabase-js";
import { C, T, CTA, Chip, FieldLabel, s } from "./ui";
import { api, checkoutDestination } from "./api";
import { useResource } from "./useResource";
import { ResourceStatus } from "./ServiceScreens";
import {
  cartKey,
  cleanCart,
  changeCart,
  project,
  unproject,
} from "./market-model.mjs";
import type { Lang, Tab } from "./types";
import { fulfillmentLabels, paymentLabels } from "./market-orders";
type Row = { id: string; quantity: number };
type Product = {
  id: string;
  name: string;
  description: string;
  category: string;
  price_tetri: number;
  image_url?: string;
  image_urls?: string[];
};
type Cart = {
  rows: Row[];
  ready: boolean;
  change: (id: string, delta: number) => void;
  clear: () => void;
};
const CartContext = createContext<Cart | null>(null);
export function CartProvider({ children }: { children: ReactNode }) {
  const [rows, setRows] = useState<Row[]>([]),
    [ready, setReady] = useState(false);
  const writes = useRef(Promise.resolve());
  useEffect(() => {
    let alive = true;
    void AsyncStorage.getItem(cartKey)
      .then((raw) => {
        if (alive) setRows(cleanCart(JSON.parse(raw || "[]")));
      })
      .catch(() => {})
      .finally(() => {
        if (alive) setReady(true);
      });
    return () => {
      alive = false;
    };
  }, []);
  useEffect(() => {
    if (ready) {
      const value = JSON.stringify(rows);
      writes.current = writes.current
        .catch(() => {})
        .then(() => AsyncStorage.setItem(cartKey, value));
    }
  }, [rows, ready]);
  return (
    <CartContext.Provider
      value={{
        rows,
        ready,
        change: (id, delta) =>
          setRows((current) => changeCart(current, id, delta)),
        clear: () => setRows([]),
      }}
    >
      {children}
    </CartContext.Provider>
  );
}
export function useCart() {
  const value = useContext(CartContext);
  if (!value) throw Error("Cart provider missing");
  return value;
}
const categories = [
  ["period-care", "პერიოდის მოვლა", "Period care"],
  ["body-care", "სხეულის მოვლა", "Body care"],
  ["nutrition", "კვება", "Nutrition"],
  ["accessories", "აქსესუარები", "Accessories"],
];
type Nav = { lang: Lang; onNavigate: (tab: Tab) => void };
function Gallery({ product }: { product: Product }) {
  const width = Math.min(useWindowDimensions().width, 520) - 80,
    images = product.image_urls?.length
      ? product.image_urls
      : product.image_url
        ? [product.image_url]
        : [];
  return images.length ? (
    <ScrollView
      horizontal
      pagingEnabled
      showsHorizontalScrollIndicator={images.length > 1}
      style={{ height: 200, marginBottom: 16 }}
    >
      {images.map((uri, i) => (
        <Image
          key={uri + i}
          source={{ uri }}
          accessibilityLabel={`${product.name} ${i + 1}/${images.length}`}
          style={{
            width,
            height: 200,
            backgroundColor: C.bg,
            borderRadius: 16,
          }}
          resizeMode="contain"
        />
      ))}
    </ScrollView>
  ) : (
    <View
      style={{
        height: 100,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: C.lav,
        borderRadius: 16,
        marginBottom: 16,
      }}
    >
      <T style={{ fontSize: 35 }}>✳</T>
    </View>
  );
}
export function MarketScreen({ lang, onNavigate }: Nav) {
  const ka = lang === "ka",
    resource = useResource<{ products: Product[] }>("/api/market/products"),
    cart = useCart();
  const [filter, setFilter] = useState(""),
    [notice, setNotice] = useState("");
  return (
    <View style={s.content}>
      <T weight="display" style={s.title}>
        {ka ? "მარკეტი" : "Market"}
      </T>
      <CTA
        light
        title={`${ka ? "კალათა" : "Cart"} · ${cart.rows.reduce((sum, r) => sum + r.quantity, 0)}`}
        onPress={() => onNavigate("cart")}
      />
      <ResourceStatus {...resource} lang={lang} />
      <View style={[s.wrap, { marginBottom: 18 }]}>
        <Chip
          selected={!filter}
          label={ka ? "ყველა" : "All"}
          onPress={() => setFilter("")}
        />
        {categories.map(([id, a, b]) => (
          <Chip
            key={id}
            selected={filter === id}
            label={ka ? a : b}
            onPress={() => setFilter(id)}
          />
        ))}
      </View>
      {Boolean(notice) && <T accessibilityLiveRegion="polite">{notice}</T>}
      {resource.data?.products
        .filter((p) => !filter || p.category === filter)
        .map((p) => (
          <View key={p.id} style={s.card}>
            <Gallery product={p} />
            <T weight="bold" style={{ fontSize: 21 }}>
              {p.name}
            </T>
            <T style={[s.muted, { marginVertical: 10 }]}>{p.description}</T>
            <T weight="bold" style={{ fontSize: 22, marginBottom: 16 }}>
              {(p.price_tetri / 100).toFixed(2)} ₾
            </T>
            <CTA
              disabled={
                !cart.ready ||
                cart.rows.some((r) => r.id === p.id && r.quantity >= 20) ||
                (!cart.rows.some((r) => r.id === p.id) &&
                  cart.rows.length >= 20)
              }
              title={ka ? "კალათაში დამატება" : "Add to cart"}
              onPress={() => {
                cart.change(p.id, 1);
                setNotice(ka ? "დაემატა კალათაში" : "Added to cart");
              }}
            />
          </View>
        ))}
      {resource.data && !resource.data.products.length && (
        <View style={s.card}>
          <T>
            {ka
              ? "მარკეტი ჯერ ცარიელია. პროდუქტები გამოჩნდება ადმინისტრატორის მიერ დამატების შემდეგ."
              : "The market is empty. Products appear once added by the administrator."}
          </T>
        </View>
      )}
    </View>
  );
}
type Pin = { latitude: number; longitude: number };
function DeliveryMap({
  pin,
  onChange,
  lang,
}: {
  pin: Pin | null;
  onChange: (pin: Pin | null) => void;
  lang: Lang;
}) {
  const ka = lang === "ka",
    [center, setCenter] = useState<Pin>({
      latitude: 41.7151,
      longitude: 44.8271,
    }),
    [width, setWidth] = useState(300),
    [latitude, setLatitude] = useState(""),
    [longitude, setLongitude] = useState("");
  const px = project(center.latitude, center.longitude),
    tx = Math.floor(px.x / 256),
    ty = Math.floor(px.y / 256);
  const valid =
    Number.isFinite(Number(latitude)) &&
    Number.isFinite(Number(longitude)) &&
    latitude.trim() !== "" &&
    longitude.trim() !== "" &&
    Math.abs(Number(latitude)) <= 85 &&
    Math.abs(Number(longitude)) <= 180;
  function choose(value: Pin) {
    onChange(value);
    setCenter(value);
    setLatitude(String(value.latitude));
    setLongitude(String(value.longitude));
  }
  return (
    <View style={{ gap: 12 }}>
      <FieldLabel>
        {ka ? "მიტანის პინი (არასავალდებულო)" : "Delivery pin (optional)"}
      </FieldLabel>
      <T style={s.muted}>
        {ka
          ? "საწყისი რუკა თბილისს აჩვენებს, მაგრამ ეს შენი მისამართი არ არის. დააჭირე სასურველ ადგილს."
          : "The initial map shows Tbilisi, not your address. Tap to choose a location."}
      </T>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={
          ka ? "რუკაზე პინის არჩევა" : "Choose a pin on the map"
        }
        onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
        onPress={(e) =>
          choose(
            unproject(
              px.x +
                (Number.isFinite(e.nativeEvent.locationX)
                  ? e.nativeEvent.locationX
                  : width / 2) -
                width / 2,
              px.y +
                (Number.isFinite(e.nativeEvent.locationY)
                  ? e.nativeEvent.locationY
                  : 110) -
                110,
            ),
          )
        }
        style={{
          height: 220,
          overflow: "hidden",
          backgroundColor: C.silver,
          borderRadius: 16,
        }}
      >
        {Array.from({ length: 9 }, (_, i) => ({
          x: tx + (i % 3) - 1,
          y: ty + Math.floor(i / 3) - 1,
        })).map((tile) => (
          <View
            pointerEvents="none"
            key={`${tile.x}/${tile.y}`}
            style={{
              position: "absolute",
              left: width / 2 + tile.x * 256 - px.x,
              top: 110 + tile.y * 256 - px.y,
              width: 256,
              height: 256,
            }}
          >
            <Image
              source={{
                uri: `https://tile.openstreetmap.org/14/${tile.x}/${tile.y}.png`,
              }}
              style={{ width: 256, height: 256 }}
            />
          </View>
        ))}
        {pin && (
          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              left: width / 2 - 12,
              top: 92,
              width: 24,
              height: 36,
            }}
          >
            <T style={{ fontSize: 30, color: "#92384B" }}>●</T>
          </View>
        )}
      </Pressable>
      <T style={s.muted}>© OpenStreetMap contributors</T>
      <View style={s.wrap}>
        {[
          ["←", -140, 0],
          ["↑", 0, -140],
          ["↓", 0, 140],
          ["→", 140, 0],
        ].map(([label, x, y]) => (
          <Chip
            key={String(label)}
            label={String(label)}
            selected={false}
            onPress={() => {
              setCenter(unproject(px.x + Number(x), px.y + Number(y)));
              onChange(null);
            }}
          />
        ))}
      </View>
      <TextInput
        accessibilityLabel={ka ? "განედი" : "Latitude"}
        placeholder={ka ? "განედი" : "Latitude"}
        style={s.input}
        value={latitude}
        keyboardType="numbers-and-punctuation"
        onChangeText={setLatitude}
      />
      <TextInput
        accessibilityLabel={ka ? "გრძედი" : "Longitude"}
        placeholder={ka ? "გრძედი" : "Longitude"}
        style={s.input}
        value={longitude}
        keyboardType="numbers-and-punctuation"
        onChangeText={setLongitude}
      />
      <CTA
        light
        disabled={!valid}
        title={ka ? "კოორდინატების გამოყენება" : "Use coordinates"}
        onPress={() =>
          choose({ latitude: Number(latitude), longitude: Number(longitude) })
        }
      />
      {pin && (
        <>
          <T>
            {pin.latitude.toFixed(5)}, {pin.longitude.toFixed(5)}
          </T>
          <CTA
            light
            title={ka ? "პინის წაშლა" : "Remove pin"}
            onPress={() => onChange(null)}
          />
        </>
      )}
    </View>
  );
}
export function CartScreen({
  lang,
  onNavigate,
  session,
}: Nav & { session: Session | null }) {
  const ka = lang === "ka",
    cart = useCart(),
    resource = useResource<{ products: Product[] }>("/api/market/products");
  const [recipientName, setRecipientName] = useState(""),
    [address, setAddress] = useState(""),
    [pin, setPin] = useState<Pin | null>(null),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const alive = useRef(true);
  useEffect(
    () => () => {
      alive.current = false;
    },
    [],
  );
  const lines = cart.rows.map((row) => ({
      ...row,
      product: resource.data?.products.find((p) => p.id === row.id),
    })),
    validLines = lines.filter((row) => row.product),
    total = validLines.reduce(
      (sum, r) => sum + r.product!.price_tetri * r.quantity,
      0,
    );
  async function checkout() {
    if (!session) return;
    setBusy(true);
    try {
      const result = await api("/api/market/checkout", {
        userId: session.user.id,
        body: {
          recipientName: recipientName.trim(),
          address: address.trim(),
          latitude: pin?.latitude ?? null,
          longitude: pin?.longitude ?? null,
          items: cart.rows.map((row) => ({
            productId: row.id,
            quantity: row.quantity,
          })),
        },
      });
      const url = checkoutDestination(result.checkoutUrl);
      if (alive.current) {
        await Linking.openURL(url);
        onNavigate("orders");
      }
    } catch (e) {
      if (alive.current)
        setMessage(e instanceof Error ? e.message : "Connection unavailable");
    } finally {
      if (alive.current) setBusy(false);
    }
  }
  return (
    <View style={s.content}>
      <T weight="display" style={s.title}>
        {ka ? "შენი კალათა" : "Your cart"}
      </T>
      <ResourceStatus {...resource} lang={lang} />
      {lines.map((r) => (
        <View key={r.id} style={s.card}>
          <T weight="bold">
            {r.product?.name ||
              (ka
                ? "პროდუქტი აღარ არის ხელმისაწვდომი"
                : "Product no longer available")}
          </T>
          <View
            style={[s.row, { justifyContent: "space-between", marginTop: 12 }]}
          >
            <Chip
              label="−"
              selected={false}
              onPress={() => cart.change(r.id, -1)}
            />
            <T accessibilityLiveRegion="polite">{r.quantity}</T>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                ka ? "რაოდენობის გაზრდა" : "Increase quantity"
              }
              disabled={r.quantity >= 20}
              style={[s.chip, { opacity: r.quantity >= 20 ? 0.4 : 1 }]}
              onPress={() => cart.change(r.id, 1)}
            >
              <T>＋</T>
            </Pressable>
          </View>
          <Pressable
            accessibilityRole="button"
            style={{ minHeight: 44, justifyContent: "center" }}
            onPress={() => cart.change(r.id, -r.quantity)}
          >
            <T style={{ color: "#92384B" }}>{ka ? "ამოღება" : "Remove"}</T>
          </Pressable>
        </View>
      ))}
      {!cart.rows.length ? (
        <CTA
          light
          title={ka ? "მარკეტში დაბრუნება" : "Back to market"}
          onPress={() => onNavigate("market")}
        />
      ) : (
        <View style={[s.card, { gap: 16 }]}>
          <T weight="bold" style={{ fontSize: 23 }}>
            {ka ? "ჯამი: " : "Total: "}
            {(total / 100).toFixed(2)} ₾
          </T>
          {!session && (
            <T>
              {ka
                ? "შეკვეთის გასაფორმებლად შედი ზედა ღილაკიდან."
                : "Use the top button to sign in before checkout."}
            </T>
          )}
          <FieldLabel>{ka ? "მიმღების სახელი" : "Recipient name"}</FieldLabel>
          <TextInput
            accessibilityLabel={ka ? "მიმღების სახელი" : "Recipient name"}
            autoComplete="name"
            maxLength={120}
            style={s.input}
            value={recipientName}
            onChangeText={setRecipientName}
          />
          <FieldLabel>
            {ka ? "სრული მისამართი" : "Full delivery address"}
          </FieldLabel>
          <TextInput
            accessibilityLabel={
              ka ? "სრული მისამართი" : "Full delivery address"
            }
            multiline
            maxLength={500}
            style={s.input}
            value={address}
            onChangeText={setAddress}
          />
          <DeliveryMap lang={lang} pin={pin} onChange={setPin} />
          <T style={s.muted}>
            {ka
              ? "მხოლოდ სატესტო გადახდა. საბოლოო ფასი და ხელმისაწვდომობა სერვერზე მოწმდება. მისამართი და პინი მოწყობილობაზე არ ინახება."
              : "Test checkout only. The server verifies the final price and availability. Address and pin are not stored on your device."}
          </T>
          <CTA
            disabled={
              busy ||
              !session ||
              !recipientName.trim() ||
              address.trim().length < 5 ||
              resource.loading ||
              validLines.length !== cart.rows.length
            }
            title={ka ? "სატესტო გადახდა" : "Test checkout"}
            onPress={() => void checkout()}
          />
        </View>
      )}
      {Boolean(message) && (
        <T accessibilityRole="alert" style={s.error}>
          {message}
        </T>
      )}
    </View>
  );
}
export function OrdersScreen({
  lang,
  session,
  onNavigate,
}: Nav & { session: Session }) {
  const ka = lang === "ka",
    [page, setPage] = useState(0),
    resource = useResource<{
      orders: {
        order_id: string;
        created_at: string;
        total_tetri: number;
        status: string;
        fulfillment_status: keyof typeof fulfillmentLabels;
        mode: string;
        address: string;
        recipient_name: string;
        items: { name: string; quantity: number; price_tetri: number }[];
      }[];
      hasMore?: boolean;
    }>(`/api/market/orders?page=${page}`, session.user.id, 15000);
  return (
    <View style={s.content}>
      <T weight="display" style={s.title}>
        {ka ? "ჩემი შეკვეთები" : "My orders"}
      </T>
      <ResourceStatus {...resource} lang={lang} />
      {resource.data?.orders.map((order) => (
        <View key={order.order_id} style={s.card}>
          <T weight="bold">
            {new Date(order.created_at).toLocaleDateString(
              ka ? "ka-GE" : "en-GB",
            )}{" "}
            · {(order.total_tetri / 100).toFixed(2)} ₾
          </T>
          <T selectable style={s.muted}>
            {order.order_id}
          </T>
          <T>
            {ka ? "გადახდა: " : "Payment: "}
            {paymentLabels[order.status]?.[ka ? 0 : 1] || order.status}
          </T>
          <T>
            {ka ? "მიწოდება: " : "Delivery: "}
            {fulfillmentLabels[order.fulfillment_status]?.[ka ? 0 : 1] ||
              order.fulfillment_status}
          </T>
          {order.mode === "test" && (
            <T style={s.muted}>{ka ? "სატესტო შეკვეთა" : "Test order"}</T>
          )}
          {order.items.map((item, i) => (
            <T key={i}>
              {item.name} × {item.quantity}
            </T>
          ))}
          <T style={{ marginTop: 12 }}>{order.recipient_name}</T>
          <T>{order.address}</T>
        </View>
      ))}
      {resource.data && !resource.data.orders.length && (
        <T>{ka ? "შეკვეთები ჯერ არ გაქვს." : "No orders yet."}</T>
      )}
      <View style={s.wrap}>
        {page > 0 && (
          <Chip
            selected={false}
            label={ka ? "წინა" : "Previous"}
            onPress={() => setPage(page - 1)}
          />
        )}{" "}
        {(resource.data?.hasMore || resource.data?.orders.length === 20) && (
          <Chip
            selected={false}
            label={ka ? "შემდეგი" : "Next"}
            onPress={() => setPage(page + 1)}
          />
        )}
      </View>
      <CTA
        light
        title={ka ? "მარკეტის გახსნა" : "Open market"}
        onPress={() => onNavigate("market")}
      />
    </View>
  );
}
