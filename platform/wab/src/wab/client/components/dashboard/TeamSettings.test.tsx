import { AntdConfigProvider } from "@/wab/client/antd-theme";
import type { AppCtx } from "@/wab/client/app-ctx";
import TeamSettings from "@/wab/client/components/dashboard/TeamSettings";
import { AppCtxContext } from "@/wab/client/contexts/AppContexts";
import { setLanguagePreference } from "@/wab/client/i18n";
import { HistoryProvider } from "@/wab/client/route/HistoryProvider";
import { ApiTeam, ApiUser, TeamId } from "@/wab/shared/ApiSchema";
import { DEVFLAGS } from "@/wab/shared/devflags";
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { createMemoryHistory } from "history";
import * as React from "react";
import { mock } from "vitest-mock-extended";

vi.mock("@/wab/client/env", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/wab/client/env")>()),
  SELF_HOSTED: true,
}));
vi.mock("@/wab/client/components/dashboard/dashboard-actions", () => ({
  getTeamMenuItems: () => [],
  TeamMenu: () => null,
}));
afterEach(cleanup);

it("loads self-hosted organization management without any billing requests or controls", async () => {
  setLanguagePreference("en");
  const team = mock<ApiTeam>({ id: "org" as TeamId, name: "My organization" });
  const api = mock<AppCtx["api"]>();
  api.getTeam.mockResolvedValue({ team, members: [], perms: [] });
  api.getSubscription.mockRejectedValue(new Error("Billing unavailable"));
  api.getTeamMeta.mockRejectedValue(new Error("Billing unavailable"));
  api.listCurrentFeatureTiers.mockRejectedValue(new Error("Billing unavailable"));
  const appCtx = mock<AppCtx>({
    selfInfo: mock<ApiUser>(),
    appConfig: DEVFLAGS,
    teams: [team],
    api,
  });
  render(
    <AntdConfigProvider productUI>
      <HistoryProvider history={createMemoryHistory()}>
        <AppCtxContext.Provider value={appCtx}>
          <TeamSettings teamId={team.id} />
        </AppCtxContext.Provider>
      </HistoryProvider>
    </AntdConfigProvider>,
  );
  await screen.findByText("No matching members");
  expect(screen.getByText(team.name)).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "Members" })).toBeInTheDocument();
  expect(screen.queryByRole("heading", { name: "Billing" })).toBeNull();
  expect(screen.queryByText("Current plan")).toBeNull();
  expect(api.getTeam).toHaveBeenCalledWith(team.id);
  expect(api.getSubscription).not.toHaveBeenCalled();
  expect(api.getTeamMeta).not.toHaveBeenCalled();
  expect(api.listCurrentFeatureTiers).not.toHaveBeenCalled();
});
