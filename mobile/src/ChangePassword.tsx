import { useRef, useState } from "react";
import { View } from "react-native";
import PasswordInput from "./PasswordInput";
import { supabase } from "./supabase";
import { CTA, FieldLabel, T, s } from "./ui";

export function ChangePassword({ ka, userId, onSignIn, onForgot }: {
  ka: boolean;
  userId?: string;
  onSignIn: () => void;
  onForgot: () => void;
}) {
  const t = (ge: string, en: string) => ka ? ge : en;
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<"success" | "error" | null>(null);
  const lock = useRef(false);
  const valid = current.length > 0 && next.length >= 8 && next === confirm && next !== current;
  const submit = async () => {
    if (!supabase || !userId || !valid || lock.current) return;
    lock.current = true;
    setBusy(true);
    setResult(null);
    try {
      const { data, error } = await supabase.auth.getUser();
      if (error || data.user?.id !== userId) throw Error();
      const updated = await supabase.auth.updateUser({ password: next, current_password: current });
      if (updated.error) throw updated.error;
      setCurrent("");
      setNext("");
      setConfirm("");
      setResult("success");
    } catch {
      setResult("error");
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  const fields = [
    [t("მიმდინარე პაროლი", "Current password"), current, setCurrent],
    [t("ახალი პაროლი", "New password"), next, setNext],
    [t("გაიმეორე ახალი პაროლი", "Confirm new password"), confirm, setConfirm],
  ] as const;
  return (
    <View style={s.card}>
      <T weight="bold" style={{ fontSize: 20, marginBottom: 12 }}>{t("პაროლის შეცვლა", "Change password")}</T>
      {userId ? (
        <View style={{ gap: 12 }}>
          <T style={s.muted}>{t("ახალი პაროლი უნდა განსხვავდებოდეს მიმდინარე პაროლისგან და ჰქონდეს მინიმუმ 8 სიმბოლო.", "Use at least 8 characters and choose a different password.")}</T>
          {fields.map(([label, value, change], index) => (
            <View key={index}>
              <FieldLabel>{label}</FieldLabel>
              <PasswordInput label={label} value={value} onChange={(value) => {
                if (!lock.current) { change(value); setResult(null); }
              }} ka={ka} newPassword={index !== 0} />
            </View>
          ))}
          {confirm && confirm !== next ? <T>{t("ახალი პაროლები არ ემთხვევა.", "The new passwords do not match.")}</T> : null}
          <CTA title={busy ? t("ინახება…", "Saving…") : t("პაროლის შეცვლა", "Change password")}
            disabled={busy || !valid} onPress={() => void submit()} />
          {result ? <T accessibilityRole="alert">{result === "success"
            ? t("პაროლი შეიცვალა.", "Your password was changed.")
            : t("პაროლი ვერ შეიცვალა. გადაამოწმე მიმდინარე პაროლი და სცადე ხელახლა.", "Could not change the password. Check your current password and try again.")}</T> : null}
          <CTA title={t("დაგავიწყდა პაროლი?", "Forgot password?")} light onPress={onForgot} disabled={busy} />
        </View>
      ) : <CTA title={t("შესვლა პაროლის შესაცვლელად", "Sign in to change your password")} onPress={onSignIn} />}
    </View>
  );
}
