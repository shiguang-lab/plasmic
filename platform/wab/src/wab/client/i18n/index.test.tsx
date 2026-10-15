import {
  getUiLocale,
  LANGUAGE_STORAGE_KEY,
  setLanguagePreference,
  setUiLocale,
  useI18n,
} from "@/wab/client/i18n";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import * as React from "react";

function Label() {
  const { t, preference } = useI18n();
  return (
    <div>
      <span>{t("Settings")}</span>
      <output>{preference}</output>
    </div>
  );
}
afterEach(() => {
  cleanup();
  window.localStorage.clear();
});
it("applies language immediately across separate React roots and persists it", async () => {
  render(<Label />);
  render(<Label />);
  await act(async () => { await setLanguagePreference("ja"); });
  expect(screen.getAllByText("設定")).toHaveLength(2);
  expect(getUiLocale()).toBe("ja");
  expect(localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe("ja");
  await act(async () => { await setLanguagePreference("system"); });
  expect(screen.getAllByText("system")).toHaveLength(2);
});
it("reacts to cached preference changes from another window", async () => {
  render(<Label />);
  localStorage.setItem(LANGUAGE_STORAGE_KEY, "zh-TW");
  await act(async () => {
    window.dispatchEvent(
      new StorageEvent("storage", { key: LANGUAGE_STORAGE_KEY }),
    );
  });
  await waitFor(() => expect(getUiLocale()).toBe("zh-TW"));
  expect(screen.getByText("設定")).toBeTruthy();
});
it("follows system language changes until a manual preference is selected", async () => {
  const languages = vitest
    .spyOn(navigator, "languages", "get")
    .mockReturnValue(["ja-JP"]);
  await setLanguagePreference("system");
  expect(getUiLocale()).toBe("ja");
  languages.mockReturnValue(["ko-KR"]);
  await act(async () => {
    window.dispatchEvent(new Event("languagechange"));
  });
  await waitFor(() => expect(getUiLocale()).toBe("ko"));
  await setLanguagePreference("en");
  languages.mockReturnValue(["zh-CN"]);
  await act(async () => {
    window.dispatchEvent(new Event("languagechange"));
  });
  expect(getUiLocale()).toBe("en");
});
it("does not claim persistence when storage fails", async () => {
  const previous = getUiLocale();
  vitest.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw new Error("Storage denied");
  });
  expect(() => setLanguagePreference("ko")).toThrow("Storage denied");
  expect(getUiLocale()).toBe(previous);
});
it("uses the top frame locale in the host without persisting it on the host origin", async () => {
  render(<Label />);
  await act(async () => { await setUiLocale("ko"); });
  expect(screen.getByText("설정")).toBeTruthy();
  expect(localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBeNull();
  localStorage.setItem(LANGUAGE_STORAGE_KEY, "en");
  await act(async () => {
    window.dispatchEvent(
      new StorageEvent("storage", { key: LANGUAGE_STORAGE_KEY }),
    );
  });
  expect(getUiLocale()).toBe("ko");
});
it("restores a saved choice at startup before the first render", async () => {
  localStorage.setItem(LANGUAGE_STORAGE_KEY, "ja");
  vitest.resetModules();
  const fresh = await import("@/wab/client/i18n");
  expect(fresh.getUiLocale()).toBe("ja");
});
it("reads the desktop OS language and ignores an invalid saved choice", async () => {
  localStorage.setItem(LANGUAGE_STORAGE_KEY, "invalid");
  Object.defineProperty(window, "desktopEnvironment", {
    value: { systemLanguages: ["zh-Hant-TW"] },
    configurable: true,
  });
  vitest.resetModules();
  const fresh = await import("@/wab/client/i18n");
  expect(fresh.getUiLocale()).toBe("zh-TW");
  Reflect.deleteProperty(window, "desktopEnvironment");
});

it("keeps the last language choice when downloads overlap", async () => {
  vitest.resetModules();
  const fresh = await import("@/wab/client/i18n");
  const older = fresh.setLanguagePreference("ja");
  const latest = fresh.setLanguagePreference("ko");
  await Promise.all([older, latest]);
  expect(fresh.getUiLocale()).toBe("ko");
  expect(localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe("ko");
});
