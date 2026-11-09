import { Pressable, TextInput, View } from "react-native";
import { EMAIL_CODE_LENGTH } from "./email-verification.mjs";
import { supabase } from "./supabase";
import { CTA, FieldLabel, s, T } from "./ui";
import { useEmailVerification, type PendingEmail } from "./use-email-verification";

export default function EmailCodeScreen({ pending, lang, onBack }: {
  pending: PendingEmail;
  lang: "ka" | "en";
  onBack: () => void;
}) {
  const ka = lang === "ka";
  const t = (georgian: string, english: string) => ka ? georgian : english;
  const verification = useEmailVerification({
    auth: () => {
      if (!supabase) throw new Error("Account service is not configured");
      return supabase.auth;
    },
    pending,
    lang,
  });
  // verifyOtp publishes SIGNED_IN; Shell closes the auth screen on that event.
  const busy = verification.operation !== null;
  return (
    <View style={s.content}>
      <Pressable accessibilityRole="button" accessibilityState={{ disabled: busy }} disabled={busy} onPress={onBack} style={{ minHeight: 48, justifyContent: "center" }}>
        <T weight="bold">‹ {t("უკან", "Back")}</T>
      </Pressable>
      <T weight="display" style={s.title}>{t("დაადასტურე ელფოსტა", "Confirm your email")}</T>
      <T style={[s.muted, { marginBottom: 24 }]}>
        {t("შეიყვანე ამ მისამართზე მიღებული ექვსნიშნა კოდი:", "Enter the six-digit code sent to:")} {pending.email}. {t("თუ წერილი არ ჩანს, შეამოწმე სპამი.", "Check spam if you don’t see the email.")}
      </T>
      <View style={s.section}>
        <FieldLabel>{t("6-ნიშნა კოდი", "6-digit code")}</FieldLabel>
        <TextInput
          accessibilityLabel={t("6-ნიშნა კოდი", "6-digit code")}
          autoComplete="one-time-code"
          keyboardType="number-pad"
          maxLength={EMAIL_CODE_LENGTH}
          editable={!busy}
          value={verification.code}
          onChangeText={verification.changeCode}
          style={[s.input, { letterSpacing: 6, fontSize: 20 }]}
        />
      </View>
      {verification.error ? <View style={s.banner}><T accessibilityRole="alert">{verification.error}</T></View> : null}
      {verification.resent ? <View style={s.banner}><T accessibilityLiveRegion="polite">{t("ახალი კოდი გაიგზავნა. გამოიყენე ბოლო წერილი.", "A new code was sent. Use the latest email.")}</T></View> : null}
      <CTA
        title={verification.operation === "verify" ? t("მოწმდება…", "Verifying…") : t("ელფოსტის დადასტურება", "Verify email")}
        disabled={busy || !verification.valid}
        onPress={() => void verification.submit("verify")}
      />
      <Pressable accessibilityRole="button" accessibilityState={{ disabled: busy || verification.wait > 0 }} disabled={busy || verification.wait > 0} onPress={() => void verification.submit("resend")} style={{ minHeight: 52, alignItems: "center", justifyContent: "center", opacity: busy || verification.wait > 0 ? 0.5 : 1 }}>
        <T weight="bold">
          {verification.operation === "resend" ? t("იგზავნება…", "Sending…") : t("კოდის ხელახლა გაგზავნა", "Resend code")}
          {verification.wait > 0 ? ` (${verification.wait}${t(" წმ", "s")})` : ""}
        </T>
      </Pressable>
    </View>
  );
}
