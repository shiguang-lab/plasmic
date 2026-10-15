export type MessageKey = keyof typeof import("./locales/en.json");
export type Messages = Record<MessageKey, string>;
export type UiLocale = "en" | "zh-CN" | "zh-TW" | "ja" | "ko";
const packs = new Map<UiLocale, Messages>();
const pendingPacks = new Map<UiLocale, Promise<Messages>>();
const loaders = {
  en: () => import("./locales/en.json"),
  "zh-CN": () => import("./locales/zh-CN.json"),
  "zh-TW": () => import("./locales/zh-TW.json"),
  ja: () => import("./locales/ja.json"),
  ko: () => import("./locales/ko.json"),
};

export function getMessages(locale: UiLocale) {
  return packs.get(locale);
}

export function loadMessages(locale: UiLocale): Promise<Messages> {
  const loaded = packs.get(locale);
  if (loaded) {return Promise.resolve(loaded);}
  const pending = pendingPacks.get(locale);
  if (pending) {return pending;}
  const request = loaders[locale]().then(({ default: messages }) => {
    packs.set(locale, messages);
    pendingPacks.delete(locale);
    return messages;
  }, (error) => {
    pendingPacks.delete(locale);
    throw error;
  });
  pendingPacks.set(locale, request);
  return request;
}

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

export { resolveUiLocale } from "@/wab/client/i18n/locale-resolution.cjs";

export function translate(
  locale: UiLocale,
  key: MessageKey,
  values: Record<string, string | number> = {},
): string {
  return (packs.get(locale)?.[key] ?? key).replace(
    /\{(\w+)\}/g,
    (placeholder, name: string) =>
      values[name] === undefined ? placeholder : String(values[name]),
  );
}

/** Translate presentation labels from editor metadata without changing stored values. */
export function translateUiLabel(locale: UiLocale, label: string): string {
  return packs.get(locale)?.[label as MessageKey] ?? label;
}
