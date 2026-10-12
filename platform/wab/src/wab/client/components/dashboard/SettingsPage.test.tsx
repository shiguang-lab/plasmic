import { AntdConfigProvider } from "@/wab/client/antd-theme";
import { AppCtx } from "@/wab/client/app-ctx";
import SettingsPage from "@/wab/client/components/dashboard/SettingsPage";
import { AppCtxContext } from "@/wab/client/contexts/AppContexts";
import { setLanguagePreference } from "@/wab/client/i18n";
import { ApiUser } from "@/wab/shared/ApiSchema";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import * as React from "react";
import { mock } from "vitest-mock-extended";

vi.mock("@/wab/client/components/AddTrustedHostModal", () => ({
  AddTrustedHostModal: () => <div role="dialog">Add trusted host</div>,
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

it("renders settings content through the page wrapper and retains account actions", async () => {
  setLanguagePreference("en");
  const createPersonalApiToken = vi.fn();
  const appCtx = mock<AppCtx>({
    selfInfo: mock<ApiUser>({
      displayName: "Test User",
      email: "test@example.com",
    }),
    personalApiTokens: [],
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
