import { toOpaque } from "@/wab/commons/types";
import { loadProjectStartup } from "@/wab/server/routes/project-startup";
import type { Request } from "express";
import { mock } from "vitest-mock-extended";

const db = vi.hoisted(() => ({
  ensurePersonalWorkspace: vi.fn(),
  getAffiliatedTeams: vi.fn(async () => []),
  getAffiliatedWorkspaces: vi.fn(async () => []),
  getSelfPerms: vi.fn(async () => ({ perms: [] })),
}));
vi.mock("@/wab/server/db/BundleMigrator", () => ({
  getLastBundleVersion: async () => "bundle-version",
}));
vi.mock("@/wab/server/routes/hosts", () => ({
  getTrustedHostsData: async () => ({ trustedHosts: [] }),
}));
vi.mock("@/wab/server/routes/util", async (original) => ({
  ...await original<typeof import("@/wab/server/routes/util")>(),
  superDbMgr: () => db,
  userDbMgr: () => ({ ...db, tryGetNormalActorId: () => "user" }),
}));

it("initializes the personal workspace once before returning identity and app context", async () => {
  let finishWorkspace = () => {};
  db.ensurePersonalWorkspace.mockImplementation(() => new Promise<void>((resolve) => {
    finishWorkspace = resolve;
  }));
  const user = { id: "user" } as NonNullable<Request["user"]>;
  const readPreferences = vi.fn(async () => undefined);
  const req = mock<Request>();
  req.query = {};
  req.cookies = {};
  req.user = user;
  req.shiguangIdentity = undefined;
  req.noTxMgr = mock<Request["noTxMgr"]>({ findOne: readPreferences });
  const pending = loadProjectStartup(req, toOpaque("project")).data;

  expect(db.ensurePersonalWorkspace).toHaveBeenCalledExactlyOnceWith(user);
  expect(db.getAffiliatedWorkspaces).not.toHaveBeenCalled();
  expect(readPreferences).not.toHaveBeenCalled();
  finishWorkspace();
  const result = await pending;
  expect(result.selfInfo?.user).toBe(user);
  expect(result.appCtx).toEqual({ teams: [], workspaces: [], perms: [] });
});
