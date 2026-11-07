import { Api } from "@/wab/client/api";
import { AppCtx, loadAppCtx, NonAuthCtx } from "@/wab/client/app-ctx";
import type { App } from "@/wab/client/components/top-view";
import type { PromisifyMethods } from "@/wab/commons/promisify-methods";
import { toOpaque } from "@/wab/commons/types";
import type { ApiTeam, ApiUser, ApiWorkspace, AppCtxResponse } from "@/wab/shared/ApiSchema";
import { DEVFLAGS } from "@/wab/shared/devflags";
import { mock } from "vitest-mock-extended";

vi.mock("@/wab/client/cli-routes", async (original) => ({ ...(await original<typeof import("@/wab/client/cli-routes")>()), isHostFrame: () => false }));
function team(id: string, name: string, personal = false) {
  return mock<ApiTeam>({ id: toOpaque(id), name, personalTeamOwnerId: personal ? toOpaque("personal-user") : null, parentTeamId: null });
}
function space(id: string, name: string, owner: ApiTeam) {
  return mock<ApiWorkspace>({ id: toOpaque(id), name, team: owner });
}
async function setup(data: AppCtxResponse) {
  const api = mock<PromisifyMethods<Api>>();
  api.getSelfInfo.mockResolvedValue({ user: mock<ApiUser>({ id: toOpaque("navigation-user"), email: "navigation@example.test" }), isAdmin: false });
  api.getAppConfig.mockResolvedValue({ config: { ...DEVFLAGS } });
  api.getAppCtx.mockResolvedValue(data);
  const source = new NonAuthCtx(mock<NonAuthCtx>({ api, topFrameApi: null, app: mock<App>(), change: (callback) => callback(), lastBundleVersion: "test" }));
  return { api, app: await loadAppCtx(source) };
}

it("leaves unused AppCtx navigation uninitialized and constructs its first snapshot without event subscriptions", () => {
  const app = new AppCtx(mock<ConstructorParameters<typeof AppCtx>[0]>());
  const capture = vi.spyOn(app, "getAllTeams");
  const subscribe = vi.spyOn(app, "subscribeUiEnvironmentInputs");
  app.publishUiEnvironmentInputs();
  expect(capture).not.toHaveBeenCalled();
  Object.assign(app, { teams: [], workspaces: [] });
  const store = app.navigationStore;
  expect(store.getState()).toEqual({ teams: [], workspaces: [] });
  expect(app.navigationStore).toBe(store);
  expect(capture).toHaveBeenCalledOnce();
  expect(subscribe).not.toHaveBeenCalled();
});

it("uses canonical team sorting/dedupe/personal filtering and structurally shares committed scalar rows", async () => {
  const first = team("first", "Zulu"), second = team("second", "Alpha"), personal = team("personal", "Personal", true);
  const firstSpace = space("one", "Zulu space", first), secondSpace = space("two", "Alpha space", second);
  const data = { teams: [first, personal, { ...first, name: "Duplicate" }], workspaces: [firstSpace, secondSpace, space("private", "Personal", personal)], perms: [] };
  const { app, api } = await setup(data);
  const store = app.navigationStore, initial = store.getState();
  expect(initial.teams).toEqual(app.getAllTeams().map(({ id, name }) => ({ id, name })));
  expect(initial.teams.map((row) => row.name)).toEqual(["Alpha", "Zulu"]);
  expect(initial.workspaces[0]).toEqual({ id: firstSpace.id, name: "Zulu space", teamId: first.id });
  expect(Object.isFrozen(initial)).toBe(true);
  expect(Object.isFrozen(initial.teams)).toBe(true);
  expect(Object.isFrozen(initial.teams[0])).toBe(true);
  expect(Object.isFrozen(initial.workspaces[0])).toBe(true);
  first.name = "Unpublished input";
  expect(initial.teams[1]?.name).toBe("Zulu");
  first.name = "Zulu";
  const published = vi.fn(), stop = store.subscribe(published);
  const seen = vi.fn(() => store.getState());
  const stopInputs = app.subscribeUiEnvironmentInputs(seen);
  api.getAppCtx.mockResolvedValueOnce({ ...data, teams: data.teams.map((item) => ({ ...item, billingEmail: "unrelated@example.test" })), workspaces: data.workspaces.map((item) => ({ ...item, description: "Unrelated" })) });
  await app.reloadAppCtx();
  expect(store.getState()).toBe(initial);
  expect(published).not.toHaveBeenCalled();
  const renamed = { ...first, name: "Aardvark" }, renamedSpace = { ...firstSpace, name: "Renamed space" };
  api.getAppCtx.mockResolvedValueOnce({ teams: [renamed, personal], workspaces: [renamedSpace, secondSpace, data.workspaces[2]], perms: [] });
  await app.reloadAppCtx();
  const next = store.getState();
  expect(next.teams.map((row) => row.name)).toEqual(["Aardvark", "Alpha"]);
  expect(next.teams[1]).toBe(initial.teams[0]);
  expect(next.workspaces[1]).toBe(initial.workspaces[1]);
  expect(next.workspaces[0]?.name).toBe("Renamed space");
  expect(seen.mock.results[1].value).toBe(next);
  expect(published).toHaveBeenCalledOnce();
  api.getAppCtx.mockResolvedValueOnce({ teams: [renamed], workspaces: [renamedSpace], perms: [] });
  await app.reloadAppCtx();
  expect(store.getState().teams).toHaveLength(1);
  expect(store.getState().workspaces).toHaveLength(1);
  expect(store.getState().teams[0]).toBe(next.teams[0]);
  stopInputs(); stop();
});

it("keeps the last navigation commit on failed reloads and ignores unrelated successful account/config changes", async () => {
  const owner = team("owner", "Organization"), workspace = space("space", "Workspace", owner);
  const data = { teams: [owner], workspaces: [workspace], perms: [] };
  const { app, api } = await setup(data);
  const store = app.navigationStore, initial = store.getState(), published = vi.fn();
  const stop = store.subscribe(published);
  const failure = new Error("Navigation reload failed");
  api.getAppCtx.mockRejectedValueOnce(failure);
  await expect(app.reloadAppCtx()).rejects.toBe(failure);
  api.getAppCtx.mockRejectedValueOnce(failure);
  await expect(app.reloadAll()).rejects.toBe(failure);
  expect(store.getState()).toBe(initial);
  expect(published).not.toHaveBeenCalled();
  api.getSelfInfo.mockResolvedValueOnce({ user: mock<ApiUser>({ id: toOpaque("other-user"), email: "other@example.test" }), isAdmin: false });
  await app.reloadAll();
  expect(app.selfInfo?.email).toBe("other@example.test");
  expect(store.getState()).toBe(initial);
  expect(published).not.toHaveBeenCalled();
  api.getAppCtx.mockResolvedValueOnce({ teams: [], workspaces: [], perms: [] });
  await app.reloadAll();
  expect(store.getState()).toEqual({ teams: [], workspaces: [] });
  expect(published).toHaveBeenCalledOnce();
  stop();
});
