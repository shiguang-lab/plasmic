import * as React from "react";

export type AppearancePreference = "dark" | "light" | "system";
export type UiAppearance = "dark" | "light";
export const APPEARANCE_STORAGE_KEY = "shiguang.ui.appearance";
const listeners = new Set<() => void>();
const systemTheme = window.matchMedia("(prefers-color-scheme: dark)");
const isPreference = (value: unknown): value is AppearancePreference =>
  value === "dark" || value === "light" || value === "system";

function readPreference(): AppearancePreference {
  try {
    const value = localStorage.getItem(APPEARANCE_STORAGE_KEY);
    return isPreference(value) ? value : "dark";
  } catch {
    return "dark";
  }
}

let preference = readPreference();
const studioArgs = (window as Window & { __PlasmicStudioArgs?: string })
  .__PlasmicStudioArgs;
const startupAppearance = studioArgs
  ? new URLSearchParams(studioArgs.replace(/^#/, "?")).get("uiAppearance")
  : undefined;
let inheritedAppearance: UiAppearance | undefined =
  startupAppearance === "dark" || startupAppearance === "light"
    ? startupAppearance
    : undefined;
function syncDesktopAppearance() {
  if (window.top !== window) {
    return;
  }
  const desktop = (
    window as Window & {
      desktopEnvironment?: {
        setUiAppearance: (appearance: UiAppearance) => Promise<void>;
      };
    }
  ).desktopEnvironment;
  void desktop?.setUiAppearance?.(getUiAppearance());
}
const notify = () => {
  document.documentElement.dataset.uiAppearance = getUiAppearance();
  syncDesktopAppearance();
  listeners.forEach((listener) => listener());
};
notify();
export function subscribeUiAppearance(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
export function getUiAppearance(): UiAppearance {
  if (inheritedAppearance) {
    return inheritedAppearance;
  }
  return preference === "system"
    ? systemTheme.matches
      ? "dark"
      : "light"
    : preference;
}
export function setAppearancePreference(value: AppearancePreference) {
  localStorage.setItem(APPEARANCE_STORAGE_KEY, value);
  preference = value;
  inheritedAppearance = undefined;
  notify();
}
systemTheme.addEventListener("change", () => {
  if (!inheritedAppearance && preference === "system") {
    notify();
  }
});
window.addEventListener("storage", (event) => {
  if (
    !inheritedAppearance &&
    (event.key === APPEARANCE_STORAGE_KEY || event.key === null)
  ) {
    preference = readPreference();
    notify();
  }
});
// The editor host inherits the top frame appearance without storing a second preference.
export function setUiAppearance(value: UiAppearance) {
  inheritedAppearance = value;
  notify();
}
export function useUiAppearance() {
  return {
    appearance: React.useSyncExternalStore(
      subscribeUiAppearance,
      getUiAppearance,
    ),
    preference: React.useSyncExternalStore(
      subscribeUiAppearance,
      () => preference,
    ),
    setAppearancePreference,
  };
}

export function usesProductTheme(pathname: string) {
  return (
    !["/login", "/register", "/logout", "/authorize"].includes(
      pathname.replace(/\/$/, ""),
    ) && !pathname.startsWith("/auth/")
  );
}
