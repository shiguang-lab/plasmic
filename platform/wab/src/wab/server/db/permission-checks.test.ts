import { DbMgr, normalActor } from "@/wab/server/db/DbMgr";
import { Project } from "@/wab/server/entities/Entities";
import { TeamId, UserId } from "@/wab/shared/ApiSchema";
import { Connection, EntityManager } from "typeorm";
import { mockDeep } from "vitest-mock-extended";

function makeDb() {
  const db = new DbMgr(new EntityManager(mockDeep<Connection>()), normalActor("self" as UserId));
  const actor = vi.spyOn(db as any, "describeActor").mockResolvedValue("User self@example.com");
  const sudo = (db as any).sudo() as DbMgr;
  vi.spyOn(db as any, "sudo").mockReturnValue(sudo);
  vi.spyOn(sudo, "getProjectById").mockResolvedValue(Object.assign(new Project(), {
    id: "private-project", inviteOnly: true, createdById: "owner", defaultAccessLevel: "blocked",
  }));
  return { db, actor };
}

test("successful project checks do not fetch a user just to format an unused error", async () => {
  const { db, actor } = makeDb();
  vi.spyOn(db as any, "_getActorAccessLevelToProject").mockResolvedValue("editor");
  await db.checkProjectPerms("private-project", "editor", "edit");
  expect(actor).not.toHaveBeenCalled();
});

test("insufficient project access still throws the descriptive permission error", async () => {
  const { db, actor } = makeDb();
  vi.spyOn(db as any, "_getActorAccessLevelToProject").mockResolvedValue("viewer");
  await expect(db.checkProjectPerms("private-project", "editor", "edit")).rejects.toMatchObject({ name: "ForbiddenError", message: expect.stringContaining("User self@example.com tried to edit project private-project") });
  expect(actor).toHaveBeenCalledOnce();
});

test("multi-resource checks still reject a missing grant after accepting authorized resources", async () => {
  const { db, actor } = makeDb();
  vi.spyOn(db as any, "_getActorAccessLevelToResources").mockResolvedValue({ allowed: "editor" });
  await db.checkTeamsPerms(["allowed" as TeamId], "editor", "edit");
  expect(actor).not.toHaveBeenCalled();
  await expect(db.checkTeamsPerms(["allowed" as TeamId, "denied" as TeamId], "viewer", "read")).rejects.toMatchObject({ name: "ForbiddenError", message: expect.stringContaining("organization denied") });
  expect(actor).toHaveBeenCalledOnce();
});
