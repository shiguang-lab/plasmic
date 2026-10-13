import { ANON_USER, DbMgr, normalActor } from "@/wab/server/db/DbMgr";
import type { Team } from "@/wab/server/entities/Entities";
import { mkApiTeam } from "@/wab/server/routes/teams";
import { ForbiddenError } from "@/wab/shared/ApiErrors/errors";
import type { TeamId, UserId } from "@/wab/shared/ApiSchema";
import { Connection, EntityManager } from "typeorm";
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
