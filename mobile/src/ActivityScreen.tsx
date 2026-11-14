import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, Pressable, Switch, View } from "react-native";
import { activityGroups, activityKinds } from "./activity.mjs";
import { supabase } from "./supabase";
import { C, Chip, T, s } from "./ui";
import { changePushDevice, pushAvailable, pushDeviceEnabled } from "./push-device";
import type { Lang, Tab } from "./types";

type Item = {
  id: string;
  kind: keyof typeof activityKinds;
  post_id: string | null;
  comment_id: string | null;
  created_at: string;
  read_at: string | null;
};
type Preferences = Record<string, boolean>;
export type ActivityPost = { postId: string; commentId: string | null };

export function useActivityBadge(userId: string | undefined, refreshKey: string) {
  const [snapshot, setSnapshot] = useState({ userId, unread: false });
  useEffect(() => {
    const client = supabase;
    if (!client || !userId) return;
    let live = true;
    let pending = false;
    async function refresh() {
      if (pending || AppState.currentState === "background") return;
      pending = true;
      try {
        const { data, error } = await client!
          .from("activity_notifications")
          .select("id")
          .eq("user_id", userId!)
          .is("read_at", null)
          .limit(1);
        if (live && !error) setSnapshot({ userId, unread: !!data?.length });
      } catch {
        // Keep the last known badge during a temporary connection failure.
      } finally {
        pending = false;
      }
    }
    void refresh();
    const timer = setInterval(() => void refresh(), 30_000);
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") void refresh();
    });
    return () => {
      live = false;
      clearInterval(timer);
      sub.remove();
    };
  }, [userId, refreshKey]);
  return !!userId && snapshot.userId === userId && snapshot.unread;
}

export function ActivityScreen({
  lang, userId, onOpen, onRead,
}: {
  lang: Lang;
  userId: string;
  onOpen: (page: Tab, post?: ActivityPost) => void;
  onRead: () => void;
}) {
  const ka = lang === "ka";
  const t = (a: string, b: string) => (ka ? a : b);
  const [items, setItems] = useState<Item[]>([]);
  const [prefs, setPrefs] = useState<Preferences | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [writeError, setWriteError] = useState(false);
  const [push, setPush] = useState<boolean | null>(null);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const sequence = useRef(0);
  const lock = useRef(false);
  const refresh = useCallback(async () => {
    const seq = ++sequence.current;
    const client = supabase;
    if (!client) {
      setError(true);
      setLoading(false);
      return;
    }
    try {
      const [inbox, preferences] = await Promise.all([
        client.from("activity_notifications")
          .select("id,kind,post_id,comment_id,created_at,read_at")
          .eq("user_id", userId).order("created_at", { ascending: false })
          .order("id", { ascending: false }).limit(50),
        client.from("activity_preferences")
          .select("post_comment,comment_reply,care,market,premium")
          .eq("user_id", userId).maybeSingle(),
      ]);
      if (seq !== sequence.current) return;
      if (!inbox.error) setItems(inbox.data as Item[]);
      if (!preferences.error) setPrefs(preferences.data ?? {});
      setError(!!(inbox.error || preferences.error));
    } catch {
      if (seq === sequence.current) setError(true);
    } finally {
      if (seq === sequence.current) setLoading(false);
    }
  }, [userId]);
  useEffect(() => {
    const initial = setTimeout(() => void refresh(), 0);
    const requestSequence = sequence;
    const timer = setInterval(() => {
      if (!lock.current && AppState.currentState !== "background") void refresh();
    }, 30_000);
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active" && !lock.current) void refresh();
    });
    return () => {
      requestSequence.current++;
      clearTimeout(initial);
      clearInterval(timer);
      sub.remove();
    };
  }, [refresh]);
  useEffect(() => {
    if (!pushAvailable || !showSettings) return;
    let live = true;
    void pushDeviceEnabled(userId).then(
      (value) => { if (live) setPush(value); },
      () => { if (live) setWriteError(true); },
    );
    return () => { live = false; };
  }, [showSettings, userId]);

  const write = async (operation: () => Promise<void>) => {
    if (lock.current) return;
    lock.current = true;
    ++sequence.current;
    setBusy(true);
    setWriteError(false);
    try {
      await operation();
    } catch {
      setWriteError(true);
    } finally {
      lock.current = false;
      setBusy(false);
      void refresh();
    }
  };
  const toggle = (key: string, value: boolean) => write(async () => {
    if (!supabase) throw Error();
    const init = await supabase.from("activity_preferences")
      .upsert({ user_id: userId }, { onConflict: "user_id", ignoreDuplicates: true });
    if (init.error) throw init.error;
    const result = await supabase.from("activity_preferences")
      .update({ [key]: value }).eq("user_id", userId).select(key).single();
    if (result.error) throw result.error;
    setPrefs((current) => ({ ...current, [key]: value }));
  });
  const markRead = async (id?: string) => {
    if (!supabase) throw Error();
    const at = new Date().toISOString();
    let query = supabase.from("activity_notifications").update({ read_at: at })
      .eq("user_id", userId).is("read_at", null);
    if (id) query = query.eq("id", id);
    const { error } = await query;
    if (error) throw error;
    setItems((current) => current.map((row) =>
      !row.read_at && (!id || row.id === id) ? { ...row, read_at: at } : row,
    ));
    onRead();
  };

  return (
    <View style={s.content}>
      <View style={[s.wrap, { marginBottom: 14 }]}>
        <Chip label={t("პარამეტრები", "Settings")} selected={showSettings}
          onPress={() => setShowSettings((value) => !value)} />
        <Chip label={t("განახლება", "Refresh")} selected={false}
          onPress={() => { if (!lock.current) void refresh(); }} />
      </View>
      {error ? <T accessibilityRole="alert">{t("შეტყობინებები სრულად ვერ ჩაიტვირთა.", "Could not load all notification data.")}</T> : null}
      {writeError ? <T accessibilityRole="alert">{t("ცვლილება ვერ შეინახა. სცადე ხელახლა.", "Could not save the change. Try again.")}</T> : null}
      {showSettings && prefs ? (
        <View style={s.card}>
          {pushAvailable ? <>
            <View style={[s.row, { minHeight: 54, justifyContent: "space-between" }]}>
              <T style={{ flex: 1 }}>{t("შეტყობინებები ამ ტელეფონზე", "Push notifications on this phone")}</T>
              <Switch accessibilityLabel={t("შეტყობინებები ამ ტელეფონზე", "Push notifications on this phone")}
                disabled={busy || push === null} value={push === true}
                onValueChange={(value) => void write(async () => {
                  setPermissionDenied(false);
                  const result = await changePushDevice(value, lang, userId);
                  if (result === "permission") setPermissionDenied(true);
                  else setPush(value);
                })} />
            </View>
            {permissionDenied ? <T accessibilityRole="alert">{t("თუთას შეტყობინებები ტელეფონის პარამეტრებში დაუშვი.", "Allow Tuta notifications in your phone settings.")}</T> : null}
          </> : null}
          <T style={s.muted}>{t("აირჩიე, რა შეტყობინებები გამოჩნდეს აქ მომავალში.", "Choose which new notifications appear here.")}</T>
          {activityGroups.map(([key, ge, en]) => (
            <View key={key} style={[s.row, { minHeight: 54, justifyContent: "space-between" }]}>
              <T style={{ flex: 1 }}>{t(ge, en)}</T>
              <Switch accessibilityLabel={t(ge, en)} disabled={busy}
                value={prefs[key] ?? true} onValueChange={(value) => void toggle(key, value)}
                trackColor={{ true: C.ink, false: C.lav }} />
            </View>
          ))}
        </View>
      ) : null}
      {items.some((item) => !item.read_at) ? (
        <View style={{ alignSelf: "flex-start", marginBottom: 14 }}>
          <Chip label={t("ყველას წაკითხულად მონიშვნა", "Mark all as read")}
            selected={false} onPress={() => void write(() => markRead())} />
        </View>
      ) : null}
      {loading ? <T>{t("იტვირთება…", "Loading…")}</T> : null}
      {!loading && !error && !items.length ? <T style={s.muted}>{t("ახალი შეტყობინებები აქ გამოჩნდება.", "New notifications will appear here.")}</T> : null}
      {items.map((item) => {
        const event = activityKinds[item.kind];
        if (!event) return null;
        return (
          <Pressable key={item.id} accessibilityRole="button" disabled={busy}
            style={[s.card, !item.read_at && { backgroundColor: C.yellow }]}
            onPress={() => void write(async () => {
              if (!item.read_at) await markRead(item.id);
              onOpen(event[2] as Tab, item.post_id ? { postId: item.post_id, commentId: item.comment_id } : undefined);
            })}>
            <T weight={item.read_at ? undefined : "bold"}>{t(event[0], event[1])}</T>
            <T style={s.muted}>{new Date(item.created_at).toLocaleString(ka ? "ka-GE" : "en", { dateStyle: "medium", timeStyle: "short" })}</T>
          </Pressable>
        );
      })}
    </View>
  );
}
