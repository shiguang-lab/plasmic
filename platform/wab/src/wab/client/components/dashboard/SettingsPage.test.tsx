import { fakeAppCtx } from "@/wab/client/__testonly__/fake-init-ctx";
import { AntdConfigProvider } from "@/wab/client/antd-theme";
import { AppCtx, AppOps } from "@/wab/client/app-ctx";
import SettingsPage from "@/wab/client/components/dashboard/SettingsPage";
import { AppCtxContext } from "@/wab/client/contexts/AppContexts";
import { showError } from "@/wab/client/ErrorNotifications";
import { setLanguagePreference } from "@/wab/client/i18n";
import { ApiUser } from "@/wab/shared/ApiSchema";
import { ensure } from "@/wab/shared/common";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import * as React from "react";
import { mock } from "vitest-mock-extended";
import { createStore } from "zustand/vanilla";

vi.mock("@/wab/client/ErrorNotifications", async (original) => ({
  ...(await original<typeof import("@/wab/client/ErrorNotifications")>()),
  showError: vi.fn(),
}));

vi.mock("@/wab/client/components/AddTrustedHostModal", () => ({
  AddTrustedHostModal: () => <div role="dialog">Add trusted host</div>,
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

it("renders settings content through the page wrapper and retains account actions", async () => {
  await setLanguagePreference("en");
  const createPersonalApiToken = vi.fn();
  const appCtx = mock<AppCtx>({
    selfInfo: mock<ApiUser>({
      displayName: "Test User",
      email: "test@example.com",
    }),
    personalApiTokensStore: createStore(() => []),
    api: mock<AppCtx["api"]>({
      getTrustedHostsList: vi.fn().mockResolvedValue({ trustedHosts: [] }),
    }),
  });
  appCtx.ops = mock<NonNullable<AppCtx["ops"]>>({ createPersonalApiToken });
  render(
    <AntdConfigProvider productUI>
      <AppCtxContext.Provider value={appCtx}>
        <SettingsPage appCtx={appCtx} />
      </AppCtxContext.Provider>
    </AntdConfigProvider>,
  );
  for (const name of [
    "Settings",
    "Account",
    "Preferences",
    "Personal access tokens",
    "Trusted host apps",
  ]) {
    expect(screen.getByRole("heading", { name })).toBeTruthy();
  }
  expect(screen.getByText("Test User")).toBeTruthy();
  expect(screen.getByLabelText("Appearance")).toBeTruthy();
  expect(screen.getByLabelText("Language")).toBeTruthy();
  expect(await screen.findByText("No trusted hosts yet.")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "New token" }));
  expect(createPersonalApiToken).toHaveBeenCalledOnce();
  fireEvent.click(screen.getByRole("button", { name: "Add URL" }));
  expect(screen.getByRole("dialog").textContent).toBe("Add trusted host");
});

it("reports trusted-host request failures through messages and retries from settings", async () => {
  await setLanguagePreference("en");
  const error = new Error("Offline");
  const hosts = vi
    .fn()
    .mockRejectedValueOnce(error)
    .mockResolvedValueOnce({ trustedHosts: [] });
  const appCtx = mock<AppCtx>({
    selfInfo: mock<ApiUser>({
      displayName: "Test User",
      email: "test@example.com",
    }),
    personalApiTokensStore: createStore(() => []),
    api: mock<AppCtx["api"]>({ getTrustedHostsList: hosts }),
  });
  appCtx.ops = mock<NonNullable<AppCtx["ops"]>>();
  render(
    <AntdConfigProvider productUI>
      <AppCtxContext.Provider value={appCtx}>
        <SettingsPage appCtx={appCtx} />
      </AppCtxContext.Provider>
    </AntdConfigProvider>,
  );
  await waitFor(() =>
    expect(showError).toHaveBeenCalledWith(error, {
      title: "Unable to load trusted hosts.",
    }),
  );
  expect(screen.queryByRole("alert")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Retry" }));
  expect(await screen.findByText("No trusted hosts yet.")).toBeTruthy();
  expect(hosts).toHaveBeenCalledTimes(2);
});

it("refreshes account fields when the existing app owner receives a new identity", async () => {
  await setLanguagePreference("en");
  const appCtx = mock<AppCtx>({
    selfInfo: mock<ApiUser>({
      displayName: "Original User",
      email: "original@example.com",
    }),
    personalApiTokensStore: createStore(() => []),
    api: mock<AppCtx["api"]>({
      getTrustedHostsList: vi.fn().mockResolvedValue({ trustedHosts: [] }),
    }),
    ops: mock<NonNullable<AppCtx["ops"]>>(),
  });
  const page = () => (
    <AntdConfigProvider productUI>
      <AppCtxContext.Provider value={appCtx}>
        <SettingsPage appCtx={appCtx} />
      </AppCtxContext.Provider>
    </AntdConfigProvider>
  );
  const view = render(page());
  expect(screen.getByText("Original User")).toBeTruthy();
  appCtx.selfInfo = mock<ApiUser>({
    displayName: "Updated User",
    email: "updated@example.com",
  });
  view.rerender(page());
  expect(screen.getByText("Updated User")).toBeTruthy();
  expect(screen.getByText("updated@example.com")).toBeTruthy();
  expect(screen.queryByText("Original User")).toBeNull();
  await screen.findByText("No trusted hosts yet.");
});

it("refreshes the compiled token list after the actual create and revoke API actions", async () => {
  await setLanguagePreference("en");
  const { appCtx, api } = fakeAppCtx();
  appCtx.selfInfo = mock<ApiUser>({
    displayName: "Token User",
    email: "tokens@example.com",
  });
  appCtx.ops = new AppOps({ appCtx });
  const existing = { token: "existing-test-token", createdDate: new Date(100) };
  const created = { token: "created-test-token", createdDate: new Date(200) };
  api.getTrustedHostsList.mockResolvedValue({ trustedHosts: [] });
  api.listPersonalApiTokens
    .mockResolvedValueOnce([existing])
    .mockResolvedValueOnce([existing, created])
    .mockResolvedValueOnce([created]);
  api.createPersonalApiToken.mockResolvedValue(created);
  api.revokePersonalApiToken.mockResolvedValue(undefined);
  render(
    <AntdConfigProvider productUI>
      <AppCtxContext.Provider value={appCtx}>
        <SettingsPage appCtx={appCtx} />
      </AppCtxContext.Provider>
    </AntdConfigProvider>,
  );
  expect(await screen.findByText(existing.token)).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "New token" }));
  expect(await screen.findByText(created.token)).toBeTruthy();
  const row = screen.getByText(existing.token).closest("li");
  expect(row).not.toBeNull();
  fireEvent.click(
    within(ensure(row, "Token row")).getByRole("button", { name: "Revoke" }),
  );
  await waitFor(() => expect(screen.queryByText(existing.token)).toBeNull());
  expect(screen.getByText(created.token)).toBeTruthy();
  expect(appCtx.personalApiTokensStore.getState()).toEqual([created]);
  expect(api.createPersonalApiToken).toHaveBeenCalledOnce();
  expect(api.revokePersonalApiToken).toHaveBeenCalledWith(existing.token);
  expect(api.listPersonalApiTokens).toHaveBeenCalledTimes(3);
});
