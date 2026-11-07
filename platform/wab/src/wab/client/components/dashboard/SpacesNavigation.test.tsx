import { SpacesNavigation } from "@/wab/client/components/dashboard/SpacesNavigation";
import { Api } from "@/wab/client/api";
import { loadAppCtx, NonAuthCtx } from "@/wab/client/app-ctx";
import { AppCtxContext } from "@/wab/client/contexts/AppContexts";
import type { App } from "@/wab/client/components/top-view";
import type { PromisifyMethods } from "@/wab/commons/promisify-methods";
import { toOpaque } from "@/wab/commons/types";
import {
  HistoryProvider,
  useLocation,
} from "@/wab/client/route/HistoryProvider";
import {
  ApiTeam,
  ApiWorkspace,
  ApiUser,
} from "@/wab/shared/ApiSchema";
import { DEVFLAGS } from "@/wab/shared/devflags";
import { APP_ROUTES } from "@/wab/shared/route/app-routes";
import "@testing-library/jest-dom/vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { createMemoryHistory } from "history";
import * as React from "react";
import { mock } from "vitest-mock-extended";

const team = mock<ApiTeam>({ id: toOpaque("org"), name: "Example organization", personalTeamOwnerId: null, parentTeamId: null });
const otherTeam = mock<ApiTeam>({
  id: toOpaque("other-org"),
  name: "Other organization",
  personalTeamOwnerId: null,
  parentTeamId: null,
});
const workspace = mock<ApiWorkspace>({
  id: toOpaque("workspace"),
  name: "Workspace",
  team,
});
const otherWorkspace = mock<ApiWorkspace>({ id: toOpaque("other-workspace"), name: "Other workspace", team: otherTeam });
const personalTeam = mock<ApiTeam>({ id: toOpaque("private"), name: "Private", personalTeamOwnerId: toOpaque("user"), parentTeamId: null });
const personalWorkspace = mock<ApiWorkspace>({ id: toOpaque("personal"), name: "Personal", team: personalTeam });
vi.mock("@/wab/client/cli-routes", async (original) => ({ ...(await original<typeof import("@/wab/client/cli-routes")>()), isHostFrame: () => false }));
vi.mock("@/wab/client/i18n", async (original) => ({
  ...(await original<typeof import("@/wab/client/i18n")>()),
  useI18n: () => ({ t: (value: string) => value }),
}));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

async function setup() {
  const history = createMemoryHistory({
    initialEntries: ["/workspaces/workspace"],
  });
  const api = mock<PromisifyMethods<Api>>();
  api.getSelfInfo.mockResolvedValue({ user: mock<ApiUser>({ id: toOpaque("user"), email: "user@example.test" }), isAdmin: false });
  api.getAppConfig.mockResolvedValue({ config: { ...DEVFLAGS } });
  api.getAppCtx.mockResolvedValue({ teams: [team, otherTeam], workspaces: [workspace, otherWorkspace, personalWorkspace], perms: [] });
  const context = mock<NonAuthCtx>({ api, topFrameApi: null, app: mock<App>(), change: (callback) => callback(), lastBundleVersion: "test" });
  context.history = history;
  const appCtx = await loadAppCtx(new NonAuthCtx(context));
  function Navigation() {
    const { pathname } = useLocation();
    return (
      <SpacesNavigation
        team={team}
        workspace={APP_ROUTES.workspace.parse(pathname) ? workspace : undefined}
      />
    );
  }
  render(
    <AppCtxContext.Provider value={appCtx}><HistoryProvider history={history}>
      <Navigation />
    </HistoryProvider></AppCtxContext.Provider>,
  );
  return { history, api, appCtx };
}

it("shows organizations and workspaces without project leaves or the personal workspace", async () => {
  const { history } = await setup();
  expect(
    screen.getByRole("complementary", { name: "Spaces" }),
  ).toBeInTheDocument();
  expect(screen.queryByText("Project")).toBeNull();
  expect(screen.queryByText("Personal")).toBeNull();
  expect(screen.queryByText("Private project")).toBeNull();
  expect(screen.queryByText("Organizations")).toBeNull();
  expect(screen.getAllByText("Organization")).toHaveLength(2);
  expect(screen.getByText("Other workspace")).toBeVisible();
  const tree = screen.getByRole("tree");
  expect(tree.closest(".ant-tree")).toHaveClass("ant-tree-show-line");
  expect(tree.querySelector(".ant-tree-switcher-icon")).toBeNull();
  expect(tree.querySelector(".ant-tree-switcher-line-icon")).toBeNull();
  expect(
    screen.getByText("Workspace").closest(".ant-tree-node-content-wrapper"),
  ).toHaveClass("ant-tree-node-selected");
  fireEvent.click(screen.getByText(team.name));
  expect(history.location.pathname).toBe("/orgs/org");
  expect(
    screen.getByText(team.name).closest(".ant-tree-node-content-wrapper"),
  ).toHaveClass("ant-tree-node-selected");
  fireEvent.click(screen.getByText("Workspace"));
  expect(history.location.pathname).toBe("/workspaces/workspace");
  act(() => history.back());
  expect(
    screen.getByText(team.name).closest(".ant-tree-node-content-wrapper"),
  ).toHaveClass("ant-tree-node-selected");
});

it("shows same-length renames, team reassignment and list removal from real completed reloads", async () => {
  const { history, api, appCtx } = await setup();
  const renamed = { ...team, name: "Renamed organization" };
  const moved = { ...workspace, name: "Moved workspace", team: otherTeam };
  api.getAppCtx.mockResolvedValueOnce({ teams: [renamed, otherTeam], workspaces: [moved, otherWorkspace, personalWorkspace], perms: [] });
  await act(async () => { await appCtx.reloadAppCtx(); });
  expect(screen.queryByText("Example organization")).toBeNull();
  expect(screen.queryByText("Workspace")).toBeNull();
  expect(screen.getByText("Renamed organization")).toBeVisible();
  const titles = screen.getAllByRole("treeitem").map((item) => item.textContent);
  expect(titles).toEqual(["Other organizationOrganization", "Moved workspace", "Other workspace", "Renamed organizationOrganization"]);
  expect(screen.getByText("Moved workspace").closest(".ant-tree-node-content-wrapper")).toHaveClass("ant-tree-node-selected");
  fireEvent.click(screen.getByText("Other workspace"));
  expect(history.location.pathname).toBe("/workspaces/other-workspace");
  api.getAppCtx.mockResolvedValueOnce({ teams: [renamed], workspaces: [], perms: [] });
  await act(async () => { await appCtx.reloadAll(); });
  expect(screen.queryByText("Other organization")).toBeNull();
  expect(screen.queryByText("Moved workspace")).toBeNull();
  expect(screen.getByText("Renamed organization")).toBeVisible();
});

it("retains the rendered navigation when reload fails and retains snapshot identity on unrelated account updates", async () => {
  const { appCtx, api } = await setup();
  const initial = appCtx.navigationStore.getState();
  const failure = new Error("Navigation unavailable");
  api.getAppCtx.mockRejectedValueOnce(failure);
  await act(async () => { await expect(appCtx.reloadAppCtx()).rejects.toBe(failure); });
  expect(screen.getByText("Workspace")).toBeVisible();
  expect(appCtx.navigationStore.getState()).toBe(initial);
  api.getSelfInfo.mockResolvedValueOnce({ user: mock<ApiUser>({ id: toOpaque("other"), email: "other@example.test" }), isAdmin: false });
  await act(async () => { await appCtx.reloadAll(); });
  expect(appCtx.navigationStore.getState()).toBe(initial);
  expect(screen.getByText("Workspace")).toBeVisible();
});
