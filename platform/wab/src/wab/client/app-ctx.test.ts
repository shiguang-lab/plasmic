import { Api } from "@/wab/client/api";
import { loadAppCtxData } from "@/wab/client/app-ctx";
import { PromisifyMethods } from "@/wab/commons/promisify-methods";
import { HttpError } from "@/wab/shared/ApiErrors/ApiError";
import { DEVFLAGS } from "@/wab/shared/devflags";
import { mock } from "vitest-mock-extended";

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
