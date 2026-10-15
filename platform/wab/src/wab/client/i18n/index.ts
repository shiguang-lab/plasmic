import {
  isLanguagePreference,
  loadMessages,
  LanguagePreference,
  resolveUiLocale,
  translate,
  translateUiLabel,
  UiLocale,
} from "@/wab/client/i18n/locales";
import * as React from "react";

export { languageOptions } from "@/wab/client/i18n/locales";
export type { LanguagePreference, UiLocale } from "@/wab/client/i18n/locales";

export const LANGUAGE_STORAGE_KEY = "shiguang.ui.language";

function readPreference(): LanguagePreference {
  try {
    const stored = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
    return isLanguagePreference(stored) ? stored : "system";
  } catch {
    return "system";
  }
}

function systemLanguages(): readonly string[] {
  const desktop = (
    window as Window & { desktopEnvironment?: { systemLanguages: string[] } }
  ).desktopEnvironment;
  return (
    desktop?.systemLanguages ?? navigator.languages ?? [navigator.language]
  );
}

let preference = readPreference();
let locale = resolveUiLocale(preference, systemLanguages());
const listeners = new Set<() => void>();
let followsTopFrame = false;
let localeRequest = 0;

export async function initializeUiLocale() {
  await loadMessages(locale);
}

async function applyLocale(value: UiLocale, nextPreference = preference) {
  const request = ++localeRequest;
  await loadMessages(value);
  if (request !== localeRequest) {return;}
  locale = value;
  preference = nextPreference;
  notify();
}

function syncDesktopLocale() {
  if (window.top === window) {
    const desktop = (
      window as Window & {
        desktopEnvironment?: {
          setUiLocale?: (locale: UiLocale) => Promise<void>;
        };
      }
    ).desktopEnvironment;
    void desktop?.setUiLocale?.(locale);
  }
}
syncDesktopLocale();

function notify() {
  syncDesktopLocale();
  listeners.forEach((listener) => listener());
}

export function getUiLocale(): UiLocale {
  return locale;
}

// The host editor receives this from the top frame. It must not persist a
// second preference in the custom app host's origin.
export function setUiLocale(value: UiLocale) {
  followsTopFrame = true;
  return applyLocale(value);
}

export function subscribeUiLocale(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function setLanguagePreference(value: LanguagePreference) {
  // Save before applying, so a failed write cannot appear to be persisted.
  window.localStorage.setItem(LANGUAGE_STORAGE_KEY, value);
  return applyLocale(resolveUiLocale(value, systemLanguages()), value);
}

window.addEventListener("storage", (event) => {
  if (
    !followsTopFrame &&
    (event.key === LANGUAGE_STORAGE_KEY || event.key === null)
  ) {
    const value = readPreference();
    void applyLocale(resolveUiLocale(value, systemLanguages()), value).catch(console.error);
  }
});
window.addEventListener("languagechange", () => {
  if (!followsTopFrame && preference === "system") {
    void applyLocale(resolveUiLocale(preference, systemLanguages())).catch(console.error);
  }
});

export function useI18n() {
  const currentLocale = React.useSyncExternalStore(
    subscribeUiLocale,
    getUiLocale,
  );
  const currentPreference = React.useSyncExternalStore(
    subscribeUiLocale,
    () => preference,
  );
  const t = React.useCallback(
    (
      key: Parameters<typeof translate>[1],
      values?: Parameters<typeof translate>[2],
    ) => translate(currentLocale, key, values),
    [currentLocale],
  );
  const label = React.useCallback(
    (text: string) => translateUiLabel(currentLocale, text),
    [currentLocale],
  );
  return {
    locale: currentLocale,
    preference: currentPreference,
    label,
    setLanguagePreference,
    t,
  };
}
