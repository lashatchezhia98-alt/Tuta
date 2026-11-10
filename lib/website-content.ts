import { copyFields, copyPages, memberCopyPages, type CopyLanguage, type CopyOverrides, emptyCopy, getCopyText, validateCopy } from "./site-copy";

export type WebsiteTextStyle = { fontSize: number; color: string };
export type WebsiteTextRecord = {
  key: string;
  page: string;
  section: string;
  ka_text: string;
  en_text: string;
  ka_style: WebsiteTextStyle;
  en_style: WebsiteTextStyle;
  published: boolean;
  updated_at: string;
};
export type WebsiteTextInput = Omit<WebsiteTextRecord, "updated_at">;
export type WebsiteTextStyles = Record<CopyLanguage, Record<string, WebsiteTextStyle>>;
export const emptyTextStyles = (): WebsiteTextStyles => ({ ka: {}, en: {} });
export const defaultTextStyle: WebsiteTextStyle = { fontSize: 16, color: "#1E1B2E" };
const safeKey = /^[a-z0-9][a-z0-9._-]{1,119}$/;
const safeColor = /^(#[\da-f]{3}|#[\da-f]{6})$/i;
const isRecord = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
function hasForbiddenControl(value: string, allowTextWhitespace: boolean) {
  for (let index = 0; index < value.length; index++) {
    const code = value.charCodeAt(index);
    if (code < 32 && !(allowTextWhitespace && (code === 9 || code === 10 || code === 13))) return true;
  }
  return false;
}

export function normalizeTextStyle(value: unknown): WebsiteTextStyle | null {
  if (!isRecord(value) || typeof value.color !== "string" || !safeColor.test(value.color) || typeof value.fontSize !== "number" || !Number.isFinite(value.fontSize) || value.fontSize < 12 || value.fontSize > 56) return null;
  return { fontSize: Math.round(value.fontSize * 10) / 10, color: value.color.toUpperCase() };
}

export function validateWebsiteCopy(input: unknown): CopyOverrides {
  const output = emptyCopy();
  if (!isRecord(input)) return output;
  for (const language of ["ka", "en"] as const) {
    const values = input[language];
    if (!isRecord(values)) continue;
    for (const [key, value] of Object.entries(values)) {
      if (!safeKey.test(key) || typeof value !== "string" || !value.trim() || value.length > 3500 || hasForbiddenControl(value, true)) continue;
      output[language][key] = value.trim();
    }
  }
  return output;
}

/** Parse the legacy published content object without allowing unknown keys through. */
export function legacyPublishedCopy(input: unknown): CopyOverrides {
  return validateCopy(input, false);
}

export function catalogWithLegacyPublishedValues(legacy: unknown) {
  const published = legacyPublishedCopy(legacy);
  return catalogDefaults().map(item => ({
    ...item,
    ka_text: published.ka[item.key] ?? item.ka_text,
    en_text: published.en[item.key] ?? item.en_text,
  }));
}

export function validateWebsiteText(input: unknown, requireUpdatedAt = false): WebsiteTextRecord {
  if (!isRecord(input)) throw new Error("invalid_record");
  const { key, page, section, ka_text, en_text, ka_style, en_style, published, updated_at } = input;
  if (typeof key !== "string" || !safeKey.test(key)) throw new Error("invalid_key");
  if (typeof page !== "string" || !page.startsWith("/") || page.length > 180 || /[?#]/.test(page) || hasForbiddenControl(page, false)) throw new Error("invalid_page");
  if (typeof section !== "string" || section.trim().length < 1 || section.trim().length > 100 || hasForbiddenControl(section, false)) throw new Error("invalid_section");
  if (typeof ka_text !== "string" || typeof en_text !== "string" || [ka_text, en_text].some(value => !value.trim() || value.length > 3500 || hasForbiddenControl(value, true))) throw new Error("invalid_text");
  const kaStyle = normalizeTextStyle(ka_style), enStyle = normalizeTextStyle(en_style);
  if (!kaStyle || !enStyle) throw new Error("invalid_style");
  if (typeof published !== "boolean") throw new Error("invalid_status");
  if (requireUpdatedAt && (typeof updated_at !== "string" || !Number.isFinite(Date.parse(updated_at)))) throw new Error("invalid_updated_at");
  return { key, page: page.trim(), section: section.trim(), ka_text: ka_text.trim(), en_text: en_text.trim(), ka_style: kaStyle, en_style: enStyle, published, updated_at: typeof updated_at === "string" ? updated_at : "" };
}

export function catalogDefaults() {
  return copyFields.map(field => {
    const page = [...copyPages, ...memberCopyPages].find(item => item[3].some(prefix => field.id.startsWith(prefix)))?.[0] ?? "/";
    const section = field.id.split(".").slice(0, -1).join(".") || "general";
    return { key: field.id, page, section, ka_text: field.ka, en_text: field.en, ka_style: defaultTextStyle, en_style: defaultTextStyle, published: true };
  });
}

export function copyFromPublishedRows(rows: unknown) {
  return copyAndStylesFromRows(rows, true);
}

export function copyAndStylesFromRows(rows: unknown, publishedOnly = false) {
  const copy = emptyCopy(), styles = emptyTextStyles();
  try {
    if (!Array.isArray(rows)) return { copy, styles };
    for (const raw of rows) {
      try {
        const item = validateWebsiteText(raw, true);
        if (publishedOnly && !item.published) continue;
        copy.ka[item.key] = item.ka_text;
        copy.en[item.key] = item.en_text;
        styles.ka[item.key] = item.ka_style;
        styles.en[item.key] = item.en_style;
      } catch { /* Invalid persisted entries are ignored in favor of the safe built-in copy. */ }
    }
  } catch { return { copy, styles }; }
  return { copy: validateWebsiteCopy(copy), styles };
}

export function mergePublishedContent(defaults: CopyOverrides, overrides: CopyOverrides, baseStyles = emptyTextStyles(), overridesStyles = emptyTextStyles()) {
  const copy = { ka: { ...defaults.ka, ...overrides.ka }, en: { ...defaults.en, ...overrides.en } };
  const styles = { ka: { ...baseStyles.ka, ...overridesStyles.ka }, en: { ...baseStyles.en, ...overridesStyles.en } };
  return { copy: validateWebsiteCopy(copy), styles };
}

export function textForLanguage(record: WebsiteTextRecord, language: CopyLanguage) { return record[language === "ka" ? "ka_text" : "en_text"]; }
export function styleForLanguage(record: WebsiteTextRecord, language: CopyLanguage) { return record[language === "ka" ? "ka_style" : "en_style"]; }
export function builtInValue(key: string, language: CopyLanguage) { return getCopyText(emptyCopy(), key, language); }

export function restoreWebsiteTextDefaults(record: WebsiteTextRecord): WebsiteTextRecord {
  return {
    ...record,
    ka_text: builtInValue(record.key, "ka") || record.ka_text,
    en_text: builtInValue(record.key, "en") || record.en_text,
    ka_style: defaultTextStyle,
    en_style: defaultTextStyle,
  };
}
