import OrganizationsPage from "@/wab/client/components/dashboard/OrganizationsPage";
import { Api } from "@/wab/client/api";
import { loadAppCtx, NonAuthCtx } from "@/wab/client/app-ctx";
import { AppCtxContext } from "@/wab/client/contexts/AppContexts";
import type { App } from "@/wab/client/components/top-view";
import type { PromisifyMethods } from "@/wab/commons/promisify-methods";
import { toOpaque } from "@/wab/commons/types";
import type { ApiTeam, ApiUser } from "@/wab/shared/ApiSchema";
import { DEVFLAGS } from "@/wab/shared/devflags";
import { HistoryProvider } from "@/wab/client/route/HistoryProvider";
import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createMemoryHistory } from "history";
import * as React from "react";
import { mock } from "vitest-mock-extended";

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
}));
vi.mock("@/wab/client/cli-routes", async (original) => ({ ...(await original<typeof import("@/wab/client/cli-routes")>()), isHostFrame: () => false }));
vi.mock("@/wab/client/components/dashboard/dashboard-actions", () => ({
  promptNewTeam: mocks.create,
}));
vi.mock("@/wab/client/i18n", async (original) => ({
  ...(await original<typeof import("@/wab/client/i18n")>()),
  useI18n: () => ({ t: (message: string) => message }),
}));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
const team = mock<ApiTeam>({ id: toOpaque("org"), name: "Organization", personalTeamOwnerId: null, parentTeamId: null });
async function setup(teams = [team]) {
  const history = createMemoryHistory({ initialEntries: ["/orgs"] });
  const api = mock<PromisifyMethods<Api>>();
  api.getSelfInfo.mockResolvedValue({ user: mock<ApiUser>({ id: toOpaque("user"), email: "user@example.test" }), isAdmin: false });
  api.getAppConfig.mockResolvedValue({ config: { ...DEVFLAGS } });
  api.getAppCtx.mockResolvedValue({ teams, workspaces: [], perms: [] });
  const context = mock<NonAuthCtx>({ api, topFrameApi: null, app: mock<App>(), change: (callback) => callback(), lastBundleVersion: "test" });
  context.history = history;
  const appCtx = await loadAppCtx(new NonAuthCtx(context));
  render(
    <AppCtxContext.Provider value={appCtx}><HistoryProvider history={history}>
      <OrganizationsPage />
    </HistoryProvider></AppCtxContext.Provider>,
  );
  return { history, appCtx, api };
}
it("opens the first organization when entering Spaces", async () => {
  const { history } = await setup();
  expect(history.location.pathname).toBe("/orgs/org");
});
it("offers organization creation when none exist", async () => {
  const { history, appCtx } = await setup([]);
  expect(screen.getByText("No organizations yet.")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "New organization" }));
  expect(mocks.create).toHaveBeenCalledWith(appCtx, history);
});

it("redirects when a real reload adds an organization and restores the empty action after removal", async () => {
  const { history, appCtx, api } = await setup([]);
  expect(screen.getByText("No organizations yet.")).toBeInTheDocument();
  api.getAppCtx.mockResolvedValueOnce({ teams: [team], workspaces: [], perms: [] });
  await act(async () => { await appCtx.reloadAppCtx(); });
  expect(history.location.pathname).toBe("/orgs/org");
  expect(screen.queryByText("No organizations yet.")).toBeNull();
  api.getAppCtx.mockResolvedValueOnce({ teams: [], workspaces: [], perms: [] });
  await act(async () => { await appCtx.reloadAll(); });
  expect(screen.getByRole("button", { name: "New organization" })).toBeInTheDocument();
});
