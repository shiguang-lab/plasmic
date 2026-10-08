import { Team, Workspace } from "@/wab/server/entities/Entities";
import { getAppCtx } from "@/wab/server/routes/appctx";
import * as routeUtil from "@/wab/server/routes/util";
import { getWorkspace, getWorkspaces } from "@/wab/server/routes/workspaces";
import { Request, Response } from "express-serve-static-core";
import { vi } from "vitest";

const team = { id: "team", name: "shuhe" } as Team;
const workspace = { id: "prototypes", name: "Prototypes", team } as Workspace;
const systemWorkspace = {
  id: "components",
  name: "Installed components",
  team,
} as Workspace;

function fixture(systemWorkspaceId?: string) {
  const perms = [{ id: "existing-permission" }];
  const mgr = {
    tryGetNormalActorId: () => "user",
    getAffiliatedWorkspaces: vi.fn(async () => [systemWorkspace, workspace]),
    getAffiliatedTeams: vi.fn(async () => [team]),
    getSelfPerms: vi.fn(async () => ({ perms })),
    getWorkspaceById: vi.fn(async () => systemWorkspace),
    getPermissionsForWorkspaces: vi.fn(async () => perms),
  };
  vi.spyOn(routeUtil, "userDbMgr").mockReturnValue(
    mgr as unknown as ReturnType<typeof routeUtil.userDbMgr>,
  );
  const req = {
    devflags: { hostLessWorkspaceId: systemWorkspaceId },
    params: { workspaceId: systemWorkspace.id },
  } as unknown as Request;
  const json = vi.fn();
  const res = { json } as unknown as Response;
  return { mgr, req, res, json, perms };
}

describe("system component workspace navigation", () => {
  it("keeps organization and permissions while removing maintenance workspace from app navigation", async () => {
    const { req, res, json, perms } = fixture(systemWorkspace.id);
    await getAppCtx(req, res);
    expect(json.mock.calls[0][0]).toMatchObject({
      teams: [{ id: team.id }],
      workspaces: [{ id: workspace.id }],
      perms,
    });
    expect(json.mock.calls[0][0].workspaces).toHaveLength(1);
  });
  it("does not hide ordinary workspaces based on their name when no system workspace is configured", async () => {
    const { req, res, json } = fixture();
    await getWorkspaces(req, res);
    expect(
      json.mock.calls[0][0].workspaces.map((w: Workspace) => w.id),
    ).toEqual([systemWorkspace.id, workspace.id]);
  });
  it("preserves authorized direct access to system workspace for component maintenance", async () => {
    const { req, res, json, mgr, perms } = fixture(systemWorkspace.id);
    await getWorkspace(req, res);
    expect(mgr.getWorkspaceById).toHaveBeenCalledWith(systemWorkspace.id);
    expect(mgr.getPermissionsForWorkspaces).toHaveBeenCalledWith([
      systemWorkspace.id,
    ]);
    expect(json.mock.calls[0][0]).toMatchObject({
      workspace: { id: systemWorkspace.id },
      perms,
    });
  });
});
