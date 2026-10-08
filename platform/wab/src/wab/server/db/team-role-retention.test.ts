import { DbMgr, SUPER_USER, normalActor } from "@/wab/server/db/DbMgr";
import { Team } from "@/wab/server/entities/Entities";
import { FeatureTierId, TeamId, UserId } from "@/wab/shared/ApiSchema";
import { Connection, EntityManager } from "typeorm";
import { mockDeep } from "vitest-mock-extended";

test.each([null, "free-tier" as FeatureTierId])(
  "changing a team's tier to %s does not rewrite any member or pending invitation permissions",
  async (featureTierId) => {
    const em = new EntityManager(mockDeep<Connection>());
    const db = new DbMgr(em, SUPER_USER);
    const team = Object.assign(new Team(), {
      id: "org" as TeamId,
      featureTierId: "paid-tier",
    });
    vi.spyOn(db, "getTeamById").mockResolvedValue(team);
    const save = vi.spyOn(em, "save").mockResolvedValue(team);
    const repository = vi.spyOn(em, "getRepository");
    const result = await db.sudoUpdateTeam({ id: team.id, featureTierId });
    expect(result).toBe(team);
    expect(team.featureTierId).toBe(featureTierId);
    expect(save).toHaveBeenCalledExactlyOnceWith(team);
    // Permission changes, including invitation rows, go through repositories.
    expect(repository).not.toHaveBeenCalled();
  },
);

test("changing sensitive team fields still requires a superuser", async () => {
  const em = new EntityManager(mockDeep<Connection>());
  const db = new DbMgr(em, normalActor("self" as UserId));
  const save = vi.spyOn(em, "save");
  await expect(
    db.sudoUpdateTeam({ id: "org" as TeamId, featureTierId: null }),
  ).rejects.toThrow("Must be Super User");
  expect(save).not.toHaveBeenCalled();
});
