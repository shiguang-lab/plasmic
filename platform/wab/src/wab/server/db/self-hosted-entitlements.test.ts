import { withDb } from "@/wab/server/__testonly__/backend-util";
import { ANON_USER, DbMgr, normalActor } from "@/wab/server/db/DbMgr";
import type { Team, Workspace } from "@/wab/server/entities/Entities";
import { createTeam, deleteTeam, mkApiTeam } from "@/wab/server/routes/teams";
import { ForbiddenError } from "@/wab/shared/ApiErrors/errors";
import type { TeamId, UserId } from "@/wab/shared/ApiSchema";
import { ensure } from "@/wab/shared/common";
import { DEVFLAGS } from "@/wab/shared/devflags";
import { Request, Response } from "express-serve-static-core";
import { Connection, EntityManager } from "typeorm";
import { mock } from "vitest-mock-extended";
vi.hoisted(() => {
  vi.resetModules();
  vi.stubEnv("PLASMIC_SELF_HOSTED", "1");
});
afterAll(() => {
  vi.unstubAllEnvs();
});
function manager() {
  const em = new EntityManager({} as Connection);
  vi.spyOn(em, "save").mockImplementation(async (team) => team as never);
  vi.spyOn(em, "getRepository").mockImplementation(() => {
    throw new Error("Unexpected subscription query");
  });
  return {
    em,
    mgr: new DbMgr(
      em as unknown as EntityManager,
      normalActor("user" as UserId),
    ),
  };
}

it("allows additional organizations and AI usage without subscription/quota queries", async () => {
  const { mgr, em } = manager();
  await expect(mgr.checkCanCreateTeam()).resolves.toBeUndefined();
  await expect(mgr.useCopilotAndCheckRateLimit()).resolves.toBeUndefined();
  expect(em.getRepository).not.toHaveBeenCalled();
});

it("still requires an authenticated user", async () => {
  const mgr = new DbMgr({} as EntityManager, ANON_USER);
  await expect(mgr.checkCanCreateTeam()).rejects.toThrow();
  await expect(mgr.useCopilotAndCheckRateLimit()).rejects.toThrow();
});

it("allows organization UI customization while retaining editor permission checks", async () => {
  const { mgr, em } = manager();
  const team = { id: "team", featureTier: null } as Team;
  const perms = vi.spyOn(mgr, "checkTeamPerms").mockResolvedValue(undefined);
  vi.spyOn(mgr, "getTeamById").mockResolvedValue(team);
  await mgr.updateTeam({
    id: team.id as TeamId,
    uiConfig: { canInsertBasics: true },
  });
  expect(em.save).toHaveBeenCalled();
  perms.mockRejectedValueOnce(new ForbiddenError("Access denied"));
  await expect(
    mgr.updateTeam({
      id: team.id as TeamId,
      uiConfig: { canInsertBasics: false },
    }),
  ).rejects.toThrow("Access denied");
});

it("serves all self-hosted features for existing free/trial organizations without changing their subscription", () => {
  const team = {
    id: "org",
    name: "Organization",
    featureTierId: "old-tier",
    featureTier: { name: "Trial", localization: false, analytics: false },
    stripeSubscriptionId: null,
    trialStartDate: new Date(),
  } as Team;
  const api = mkApiTeam(team);
  expect(api.featureTier).toMatchObject({
    localization: true,
    analytics: true,
    contentRole: true,
    designerRole: true,
    editContentCreatorMode: true,
    splitContent: true,
    maxUsers: null,
    versionHistoryDays: null,
  });
  expect(api.onTrial).toBe(false);
  expect(team.featureTier?.analytics).toBe(false);
  expect(team.stripeSubscriptionId).toBeNull();
});

it("creates additional self-hosted organizations and deletes only the selected organization through the routes", () =>
  withDb(async (_sudo, [user], [db1], existingProject, em) => {
    const originalTeams = await db1().getAffiliatedTeams();
    const created: { team: Team; workspace: Workspace }[] = [];
    for (const name of ["C020 first test org", "C020 second test org"]) {
      const req = Object.assign(mock<Request>(), {
        user,
        shiguangIdentity: undefined,
        txMgr: em,
        timingStore: undefined,
        body: { name },
        cookies: {},
        headers: {},
        devflags: { ...DEVFLAGS, freeTrial: true },
        analytics: mock<Request["analytics"]>(),
      });
      const res = mock<Response>();
      await createTeam(req, res);
      const team = ensure(
        (await db1().getAffiliatedTeams()).find((item) => item.name === name),
        "Created test organization must be persisted",
      );
      expect(res.json).toHaveBeenCalledWith({
        team: expect.objectContaining({ id: team.id, name, onTrial: false }),
      });
      expect(team.stripeSubscriptionId).toBeNull();
      const workspaces = await db1().getWorkspacesByTeams([team.id]);
      expect(workspaces).toHaveLength(1);
      created.push({
        team,
        workspace: ensure(workspaces[0], "Automatic workspace must exist"),
      });
    }
    await expect(db1().checkCanCreateTeam()).resolves.toBeUndefined();
    const target = ensure(created[0], "Deletion target must exist");
    const req = Object.assign(mock<Request>(), {
      user,
      shiguangIdentity: undefined,
      txMgr: em,
      timingStore: undefined,
      body: {},
      cookies: {},
      headers: {},
      params: { teamId: target.team.id },
      analytics: mock<Request["analytics"]>(),
    });
    const res = mock<Response>();
    await deleteTeam(req, res);
    expect(res.json).toHaveBeenCalledWith({ deletedId: target.team.id });
    await expect(db1().getTeamById(target.team.id)).rejects.toThrow();
    await expect(db1().getWorkspaceById(target.workspace.id)).rejects.toThrow();
    for (const team of originalTeams) {
      await expect(db1().getTeamById(team.id)).resolves.toMatchObject({
        id: team.id,
      });
    }
    const sibling = ensure(created[1], "Sibling organization must remain");
    await expect(db1().getTeamById(sibling.team.id)).resolves.toMatchObject({
      id: sibling.team.id,
    });
    await expect(
      db1().getProjectById(existingProject.id),
    ).resolves.toMatchObject({ id: existingProject.id });
    expect(
      (await db1().getAffiliatedTeams()).some(
        (item) => item.id === target.team.id,
      ),
    ).toBe(false);
  }));
