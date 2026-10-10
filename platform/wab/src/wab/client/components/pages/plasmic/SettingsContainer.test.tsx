import { AntdConfigProvider } from "@/wab/client/antd-theme";
import { APPEARANCE_STORAGE_KEY, setAppearancePreference } from "@/wab/client/ui-theme";
import SettingsContainer from "@/wab/client/components/pages/plasmic/SettingsContainer";
import { setLanguagePreference } from "@/wab/client/i18n";
import { languageOptions, translate } from "@/wab/client/i18n/locales";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import * as React from "react";

function setup(overrides: Partial<React.ComponentProps<typeof SettingsContainer>> = {}) {
  const props = {
    name: "Test User", email: "test@example.com",
    tokensState: { loading: false, value: [], retry: vitest.fn() },
    hostsState: [], copiedToken: "",
    onNewToken: vitest.fn(), onDeleteToken: vitest.fn(), onCopyToken: vitest.fn(),
    onDeleteTrustedHost: vitest.fn(), onNewTrustedHost: vitest.fn(),
    ...overrides,
  };
  render(<AntdConfigProvider><SettingsContainer {...props} /></AntdConfigProvider>);
  return props;
}
beforeEach(() => { setLanguagePreference("en"); setAppearancePreference("dark"); });
afterEach(cleanup);

it.each(languageOptions)("renders all settings sections in $label and sets document language", ({ value }) => {
  setLanguagePreference(value);
  setup();
  for (const key of ["Settings", "Account", "Preferences", "Personal access tokens", "Trusted host apps"] as const) {
    expect(screen.getByRole("heading", { name: translate(value, key) })).toBeTruthy();
  }
  expect(document.documentElement.lang).toBe(value);
  expect(screen.getByText("Test User")).toBeTruthy();
  expect(screen.getByText("test@example.com")).toBeTruthy();
});
it("offers system and all five languages, applies a selection, and caches it", async () => {
  setup();
  fireEvent.mouseDown(screen.getByLabelText("Language"));
  for (const { label } of languageOptions) {
    expect(screen.getAllByText(label).length).toBeGreaterThan(0);
  }
  expect(screen.getAllByText("Follow system")[0]).toBeTruthy();
  fireEvent.click(screen.getByText("简体中文"));
  expect(await screen.findByRole("heading", { name: "设置" })).toBeTruthy();
  expect(localStorage.getItem("shiguang.ui.language")).toBe("zh-CN");
});
it("preserves account, token, copy and trusted-host actions", () => {
  const host = { id: "host-1", hostUrl: "https://example.com" };
  const props = setup({ tokensState: { loading: false, value: [{ token: "test-token", createdDate: new Date() }], retry: vitest.fn() }, hostsState: [host] });
  expect(screen.getByRole("link", { name: "Manage Shiguang account" }).getAttribute("href")).toBe("https://shiguanglab.com/account");
  fireEvent.click(screen.getByRole("button", { name: "New token" }));
  expect(props.onNewToken).toHaveBeenCalledOnce();
  fireEvent.click(screen.getByRole("button", { name: "Copy" }));
  expect(props.onCopyToken).toHaveBeenCalledWith(expect.anything(), "test-token");
  fireEvent.click(screen.getByRole("button", { name: "Revoke" }));
  expect(props.onDeleteToken).toHaveBeenCalledWith("test-token");
  fireEvent.click(screen.getByRole("button", { name: "Add URL" }));
  expect(props.onNewTrustedHost).toHaveBeenCalledOnce();
  fireEvent.click(screen.getByRole("button", { name: "Delete" }));
  expect(props.onDeleteTrustedHost).toHaveBeenCalledWith(host);
});
it("renders loading and failure states", () => {
  setup({ tokensState: { loading: true, retry: vitest.fn() }, hostsState: "error" });
  expect(screen.getByRole("status").textContent).toBe("Loading…");
  expect(screen.getByRole("alert").textContent).toBe("Unable to load trusted hosts.");
});
it("shows a persistence error if the device cannot store the preference", () => {
  setup();
  vitest.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("Storage denied"); });
  fireEvent.mouseDown(screen.getByLabelText("Language"));
  fireEvent.click(screen.getByText("한국어"));
  expect(screen.getByRole("alert").textContent).toBe("Unable to save language preference on this device.");
  expect(screen.getByRole("heading", { name: "Settings" })).toBeTruthy();
});

it("defaults to following the system when no appearance is cached", () => {
  localStorage.removeItem(APPEARANCE_STORAGE_KEY);
  window.dispatchEvent(new StorageEvent("storage", { key: APPEARANCE_STORAGE_KEY }));
  setup();
  expect(screen.getByLabelText("Appearance").closest(".ant-select")?.textContent).toContain("Follow system");
  expect(document.documentElement.dataset.uiAppearance).toBe(window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  expect(localStorage.getItem(APPEARANCE_STORAGE_KEY)).toBeNull();
});

it("applies and persists all appearance choices without changing the language", () => {
  setup();
  fireEvent.mouseDown(screen.getByLabelText("Appearance"));
  fireEvent.click(screen.getByText("Light"));
  expect(localStorage.getItem(APPEARANCE_STORAGE_KEY)).toBe("light");
  expect(document.documentElement.dataset.uiAppearance).toBe("light");
  expect(screen.getByRole("heading", { name: "Settings" })).toBeTruthy();
  fireEvent.mouseDown(screen.getByLabelText("Appearance"));
  fireEvent.click(screen.getByText("Dark"));
  expect(localStorage.getItem(APPEARANCE_STORAGE_KEY)).toBe("dark");
  expect(document.documentElement.dataset.uiAppearance).toBe("dark");
  fireEvent.mouseDown(screen.getByLabelText("Appearance"));
  fireEvent.click(screen.getByText("Follow system", { selector: ".ant-select-item-option-content" }));
  expect(localStorage.getItem(APPEARANCE_STORAGE_KEY)).toBe("system");
  expect(document.documentElement.dataset.uiAppearance).toBe(window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  expect(localStorage.getItem("shiguang.ui.language")).toBe("en");
});
