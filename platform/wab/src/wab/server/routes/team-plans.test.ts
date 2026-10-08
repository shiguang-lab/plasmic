import {
  DbTestArgs,
  getTeamAndWorkspace,
  withDb,
} from "@/wab/server/__testonly__/backend-util";
import { seedTestFeatureTiers } from "@/wab/server/db/seed/feature-tier";
import { Permission } from "@/wab/server/entities/Entities";
import {
  checkFreeTrialDuration,
  maybeTriggerPaywall,
} from "@/wab/server/routes/team-plans";
import { ensure } from "@/wab/shared/common";
import { DEVFLAGS } from "@/wab/shared/devflags";
import { pluralizeResourceId } from "@/wab/shared/perms";
import { Request } from "express-serve-static-core";
import { mock } from "vitest-mock-extended";

vi.mock("@/wab/server/app-backend-real", () => ({ runAppServer: vi.fn() }));
vi.mock("@/wab/server/secrets", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/wab/server/secrets")>()),
  getStripeSecrets: () => undefined,
}));
vi.mock("@/wab/server/analytics/paywall", () => ({
  isUnderMonthlyViewsLimit: vi.fn(async () => ({ valid: true })),
}));

function withTeam(
  run: (fixture: Awaited<ReturnType<typeof setupTeam>>) => Promise<void>,
) {
  return withDb(async (...args) => run(await setupTeam(...args)));
}

async function setupTeam(...[sudo, users, dbs, project, em]: DbTestArgs) {
  const { team, workspace } = await getTeamAndWorkspace(dbs[0]());
  const { teamFt } = await seedTestFeatureTiers(em);
  await sudo.sudoUpdateTeam({
    id: team.id,
    featureTierId: teamFt.id,
    seats: 10,
  });
  const req = Object.assign(mock<Request>(), {
    txMgr: em,
    user: users[0],
    cookies: {},
    body: {},
    headers: {},
    timingStore: undefined,
    devflags: { ...DEVFLAGS },
    analytics: mock<Request["analytics"]>({ track: vi.fn() }),
  });
  const resources = [
    { type: "team" as const, id: team.id },
    { type: "workspace" as const, id: workspace.id },
    { type: "project" as const, id: project.id },
  ];
  return { sudo, users, em, team, req, resources };
}

describe("role permissions independent of feature tiers", () => {
  it("preserves designer/content roles at all scopes, including pending invitations, when removing a tier", () =>
    withTeam(async ({ sudo, users, em, team, req, resources }) => {
      for (const resource of resources) {
        for (const role of ["designer", "content"] as const) {
          for (const email of [
            users[role === "designer" ? 1 : 2].email,
            `${role}@pending.test`,
          ]) {
            await sudo.grantResourcesPermissionByEmail(
              pluralizeResourceId(resource),
              email,
              role,
            );
          }
        }
      }
      const before = await em.find(Permission);
      const rolePerms = before.filter((p) =>
        ["designer", "content"].includes(p.accessLevel),
      );
      expect(rolePerms).toHaveLength(12);
      expect(rolePerms.filter((p) => !p.userId)).toHaveLength(6);
      await sudo.sudoUpdateTeam({
        id: team.id,
        featureTierId: null,
        seats: null,
      });
      await checkFreeTrialDuration(req, await sudo.getTeamById(team.id));
      const after = await em.find(Permission);
      expect(after).toHaveLength(before.length);
      expect(after).toEqual(expect.arrayContaining(before));
      expect(await sudo.getTeamById(team.id)).toMatchObject({
        featureTierId: null,
        seats: null,
      });
    }));

  it.each(["team", "workspace", "project"] as const)(
    "does not impose a publishing paywall for designer/content roles at %s scope without a tier",
    (scope) =>
      withTeam(async ({ sudo, users, em, team, req, resources }) => {
        const resource = ensure(
          resources.find((r) => r.type === scope),
          "Missing test resource",
        );
        for (const [index, role] of (
          ["designer", "content"] as const
        ).entries()) {
          await sudo.grantResourcesPermissionByEmail(
            pluralizeResourceId(resource),
            users[index + 1].email,
            role,
          );
        }
        const before = await em.find(Permission);
        await sudo.sudoUpdateTeam({
          id: team.id,
          featureTierId: null,
          seats: null,
        });
        expect(
          await maybeTriggerPaywall(req, resources, {}, "publish", undefined, {
            verifyMonthlyViews: true,
          }),
        ).toEqual({ paywall: "pass", response: "publish" });
        expect(await em.find(Permission)).toEqual(
          expect.arrayContaining(before),
        );
      }),
  );
});
