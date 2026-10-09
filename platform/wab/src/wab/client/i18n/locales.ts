import en from "@/wab/client/i18n/locales/en.json";
import ja from "@/wab/client/i18n/locales/ja.json";
import ko from "@/wab/client/i18n/locales/ko.json";
import zhCN from "@/wab/client/i18n/locales/zh-CN.json";
import zhTW from "@/wab/client/i18n/locales/zh-TW.json";

export type MessageKey = keyof typeof en;
export type Messages = Record<MessageKey, string>;
export const messages = {
  en,
  "zh-CN": zhCN,
  "zh-TW": zhTW,
  ja,
  ko,
} satisfies Record<string, Messages>;
export type UiLocale = keyof typeof messages;
export type LanguagePreference = UiLocale | "system";
export const languageOptions: { value: UiLocale; label: string }[] = [
  { value: "en", label: "English" },
  { value: "zh-CN", label: "简体中文" },
  { value: "zh-TW", label: "繁體中文" },
  { value: "ja", label: "日本語" },
  { value: "ko", label: "한국어" },
];

export function isLanguagePreference(
  value: unknown,
): value is LanguagePreference {
  return (
    value === "system" ||
    languageOptions.some((option) => option.value === value)
  );
}

export function resolveUiLocale(
  preference: LanguagePreference,
  systemLanguages: readonly string[],
): UiLocale {
  if (preference !== "system") {
    return preference;
  }
  for (const language of systemLanguages) {
    const parts = language.toLowerCase().replace(/_/g, "-").split("-");
    if (parts[0] === "zh") {
      if (parts.includes("hant")) {
        return "zh-TW";
      }
      if (parts.includes("hans")) {
        return "zh-CN";
      }
      return parts.some((part) => ["tw", "hk", "mo"].includes(part))
        ? "zh-TW"
        : "zh-CN";
    }
    if (parts[0] === "en" || parts[0] === "ja" || parts[0] === "ko") {
      return parts[0];
    }
  }
  return "en";
}

export function translate(
  locale: UiLocale,
  key: MessageKey,
  values: Record<string, string | number> = {},
): string {
  return messages[locale][key].replace(
    /\{(\w+)\}/g,
    (placeholder, name: string) =>
      values[name] === undefined ? placeholder : String(values[name]),
  );
}
