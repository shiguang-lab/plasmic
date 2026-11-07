import { Api } from "@/wab/client/api";
import { loadAppCtx, loadAppCtxData, NonAuthCtx } from "@/wab/client/app-ctx";
import { PromisifyMethods } from "@/wab/commons/promisify-methods";
import { HttpError } from "@/wab/shared/ApiErrors/ApiError";
import { DEVFLAGS } from "@/wab/shared/devflags";
import { mock } from "vitest-mock-extended";
import type { App } from "@/wab/client/components/top-view";
import type { ApiTeam, TeamId } from "@/wab/shared/ApiSchema";
import { APP_ROUTES } from "@/wab/shared/route/app-routes";

vi.mock("@/wab/client/cli-routes", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/wab/client/cli-routes")>()),
  isHostFrame: () => false,
}));

function setup() {
  const api = mock<PromisifyMethods<Api>>();
  const self = { user: { id: "user", email: "user@example.test" }, isAdmin: false };
  api.getSelfInfo.mockResolvedValue(self as Awaited<ReturnType<Api["getSelfInfo"]>>);
  api.getAppConfig.mockResolvedValue({ config: { ...DEVFLAGS } });
  api.getAppCtx.mockResolvedValue({ teams: [], workspaces: [], perms: [] });
  return { api, self, ctx: { api, topFrameApi: null } };
}

it("only treats an explicit 401 as an anonymous identity", async () => {
  const { api, ctx } = setup();
  api.getSelfInfo.mockRejectedValue(new HttpError(401));
  expect((await loadAppCtxData(ctx, true))[0]).toBeUndefined();
  expect(api.getSelfInfo).toHaveBeenCalledOnce();
});

it("preserves the signed-in user when the identity service briefly returns 503", async () => {
  const { api, ctx, self } = setup();
  api.getSelfInfo.mockRejectedValueOnce(new HttpError(503));
  expect((await loadAppCtxData(ctx, true))[0]).toEqual(self);
  expect(api.getSelfInfo).toHaveBeenCalledTimes(2);
  expect(api.getAppCtx).toHaveBeenCalledOnce();
});

it("recovers the failed workspace startup read without repeating successful identity reads", async () => {
  const { api, ctx, self } = setup();
  api.getAppCtx.mockRejectedValueOnce(new HttpError(503));
  const [identity, , data] = await loadAppCtxData(ctx, true);
  expect(identity).toEqual(self);
  expect(data).toEqual({ teams: [], workspaces: [], perms: [] });
  expect(api.getAppCtx).toHaveBeenCalledTimes(2);
  expect(api.getSelfInfo).toHaveBeenCalledOnce();
});

it.each([403, 500, 503])("propagates an identity failure instead of silently signing out (%s)", async (status) => {
  const { api, ctx } = setup();
  const error = new HttpError(status);
  api.getSelfInfo.mockRejectedValue(error);
  await expect(loadAppCtxData(ctx, true)).rejects.toBe(error);
  expect(api.removeStorageItem).not.toHaveBeenCalled();
});


it("publishes UI-environment inputs only after real account reloads install their responses", async () => {
  const { api } = setup();
  const change = vi.fn((callback: () => void) => callback());
  const ctx = mock<NonAuthCtx>({ api, topFrameApi: null, app: mock<App>(), change, lastBundleVersion: "test" });
  const appCtx = await loadAppCtx(ctx);
  const seen: { teamId: string | undefined; userId: string | undefined; branching: boolean }[] = [];
  const stop = appCtx.subscribeUiEnvironmentInputs(() => seen.push({ teamId: appCtx.teams[0]?.id, userId: appCtx.selfInfo?.id, branching: appCtx.appConfig.branching }));
  const team = mock<ApiTeam>({ id: "first-team" as TeamId, name: "First", parentTeamId: null, personalTeamOwnerId: null });
  api.getAppCtx.mockResolvedValueOnce({ teams: [team], workspaces: [], perms: [] });
  await appCtx.reloadAppCtx();
  expect(seen).toHaveLength(1);
  expect(seen[0].teamId).toBe(team.id);
  const savedBranching = DEVFLAGS.branching;
  try {
    api.getSelfInfo.mockResolvedValueOnce({ user: { id: "next-user", email: "next@example.test" } } as Awaited<ReturnType<Api["getSelfInfo"]>>);
    api.getAppConfig.mockResolvedValueOnce({ config: { ...DEVFLAGS, branching: true } });
    api.getAppCtx.mockResolvedValueOnce({ teams: [], workspaces: [], perms: [] });
    await appCtx.reloadAll();
    expect(seen).toHaveLength(2);
    expect(seen[1]).toEqual({ teamId: undefined, userId: "next-user", branching: true });
    const failure = new Error("Context reload failed");
    api.getAppCtx.mockRejectedValueOnce(failure);
    await expect(appCtx.reloadAppCtx()).rejects.toBe(failure);
    expect(seen).toHaveLength(2);
    stop();
    await appCtx.reloadAppCtx();
    expect(seen).toHaveLength(2);
  } finally { stop(); DEVFLAGS.branching = savedBranching; }
});

it("publishes logout input changes after success and retains the account on failure", async () => {
  const { api } = setup();
  const ctx = mock<NonAuthCtx>({ api, topFrameApi: null, app: mock<App>(), change: (callback) => callback(), lastBundleVersion: "test" });
  const appCtx = await loadAppCtx(ctx);
  const changed = vi.fn(() => appCtx.selfInfo);
  const stop = appCtx.subscribeUiEnvironmentInputs(changed);
  const failure = new Error("Logout failed");
  api.logout.mockRejectedValueOnce(failure);
  await expect(appCtx.logout()).rejects.toBe(failure);
  expect(appCtx.selfInfo).not.toBeNull();
  expect(changed).not.toHaveBeenCalled();
  const target = { href: "" };
  vi.stubGlobal("window", { location: target });
  try {
    api.logout.mockResolvedValueOnce(undefined);
    await appCtx.logout();
    expect(changed).toHaveBeenCalledOnce();
    expect(changed.mock.results[0].value).toBeNull();
    expect(target.href).toBe(APP_ROUTES.login.fill({}));
  } finally { stop(); vi.unstubAllGlobals(); }
});
