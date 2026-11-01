import { ANON_USER, Actor, DbMgr, SUPER_USER, normalActor, teamActor } from "@/wab/server/db/DbMgr";
import { DataSource, Project } from "@/wab/server/entities/Entities";
import { transformErrors } from "@/wab/shared/ApiErrors/errors";
import { TeamId, UserId } from "@/wab/shared/ApiSchema";
import { Connection, EntityManager } from "typeorm";
import { mockDeep } from "vitest-mock-extended";

function makeDb(identity: Actor = normalActor("self" as UserId), opts?: ConstructorParameters<typeof DbMgr>[2]) {
  const db = new DbMgr(new EntityManager(mockDeep<Connection>()), identity, opts);
  const actor = vi.spyOn(db as any, "describeActor").mockResolvedValue("User self@example.com");
  const sudo = (db as any).sudo() as DbMgr;
  vi.spyOn(db as any, "sudo").mockReturnValue(sudo);
  const project = Object.assign(new Project(), {
    id: "private-project", inviteOnly: true, createdById: "owner", defaultAccessLevel: "viewer",
    projectApiToken: "read-token", secretApiToken: "write-token",
  });
  vi.spyOn(sudo, "getProjectById").mockResolvedValue(project);
  return { db, actor, project };
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
test("omitted and explicit false share one project permission check, including concurrent calls", async () => {
  const { db } = makeDb();
  const access = vi.spyOn(db as any, "_getActorAccessLevelToProject").mockResolvedValue("editor");
  await Promise.all([
    db.checkProjectPerms("private-project", "viewer", "view"),
    db.checkProjectPerms("private-project", "viewer", "view", undefined, false),
  ]);
  expect(access).toHaveBeenCalledOnce();
  await db.checkProjectPerms("private-project", "viewer", "view", undefined, true);
  await db.checkProjectPerms("private-project", "editor", "edit");
  await db.checkProjectPerms("another-project", "viewer", "view");
  expect(access).toHaveBeenCalledTimes(4);
});
test("default normalization does not share project checks between actors", async () => {
  const first = makeDb(), second = makeDb();
  vi.spyOn(first.db as any, "_getActorAccessLevelToProject").mockResolvedValue("editor");
  vi.spyOn(second.db as any, "_getActorAccessLevelToProject").mockResolvedValue("blocked");
  await first.db.checkProjectPerms("private-project", "viewer", "view");
  await expect(second.db.checkProjectPerms("private-project", "viewer", "view", undefined, false)).rejects.toMatchObject({ name: "ForbiddenError" });
});

describe("authentication failures across shared permission gates", () => {
  const actions = {
    "project read": (db: DbMgr) => db.getProjectById("private-project"),
    "project edit": (db: DbMgr) => db.checkProjectPerms("private-project", "editor", "edit"),
    "comment read": (db: DbMgr) => db.getThreadsForProject({ projectId: "private-project" }),
    "comment edit": (db: DbMgr) => db.editCommentInProject("comment" as never, "updated"),
    "workspace read": (db: DbMgr) => db.getWorkspaceById("workspace" as never),
    "organization read": (db: DbMgr) => db.checkTeamsPerms(["team" as TeamId], "viewer", "read"),
    "account permissions": (db: DbMgr) => db.getSelfPerms(),
    "personal API tokens": (db: DbMgr) => db.listPersonalApiTokens(),
    "trusted host edit": (db: DbMgr) => db.addTrustedHost("https://host.example"),
    "admin access": (db: DbMgr) => db.listAllTeams(),
    "data source edit": (db: DbMgr) => db.checkDataSourceEditPerms(Object.assign(new DataSource(), { id: "source", workspaceId: "workspace" })),
  };

  test.each(Object.entries(actions))("anonymous %s reports HTTP 401", async (_name, action) => {
    const { db } = makeDb(ANON_USER);
    vi.spyOn(db as any, "_getActorAccessLevelToProject").mockResolvedValue("blocked");
    vi.spyOn(db as any, "_getActorAccessLevelToResources").mockResolvedValue({});
    await expect(action(db)).rejects.toMatchObject({ name: "UnauthorizedError", statusCode: 401 });
  });

  test.each([normalActor("self" as UserId), teamActor("team" as TeamId)])("authenticated $type without a project grant still reports 403", async (identity) => {
    const { db } = makeDb(identity);
    vi.spyOn(db as any, "_getActorAccessLevelToProject").mockResolvedValue("blocked");
    await expect(db.checkProjectPerms("private-project", "viewer", "get").catch(error => { throw transformErrors(error); })).rejects.toMatchObject({ name: "ForbiddenError", statusCode: 403 });
  });

  test("anonymous public and unowned projects remain accessible", async () => {
    const first = makeDb(ANON_USER);
    Object.assign(first.project, { inviteOnly: false, defaultAccessLevel: "viewer" });
    await first.db.checkProjectPerms("private-project", "viewer", "get");
    const second = makeDb(ANON_USER);
    Object.assign(second.project, { createdById: null, readableByPublic: true });
    vi.spyOn(second.db as any, "_getActorAccessLevelToProject").mockResolvedValue("blocked");
    await second.db.checkProjectPerms("private-project", "editor", "edit");
    await expect(first.db.listTrustedHostsForSelf()).resolves.toEqual([]);
  });

  test.each([["read-token", "viewer"], ["write-token", "editor"]] as const)("valid %s still grants its access level without a browser login", async (token, level) => {
    const { db } = makeDb(ANON_USER, { projectIdsAndTokens: [{ projectId: "private-project", projectApiToken: token }] });
    await db.checkProjectPerms("private-project", level, "access");
  });

  test.each(["invalid-token", "read-token"])("a token with insufficient access remains a 403: %s", async (token) => {
    const { db } = makeDb(ANON_USER, { projectIdsAndTokens: [{ projectId: "private-project", projectApiToken: token }] });
    vi.spyOn(db as any, "_getActorAccessLevelToProject").mockResolvedValue("blocked");
    await expect(db.checkProjectPerms("private-project", "editor", "edit").catch(error => { throw transformErrors(error); })).rejects.toMatchObject({ statusCode: 403 });
  });

  test("normal users retain their account identity and non-admin 403; superusers retain access", async () => {
    const { db } = makeDb();
    expect(db.checkUserIdIsSelf()).toBe("self");
    expect(() => db.checkUserIdIsSelf("other" as UserId)).toThrow("Can only do this for self");
    await expect(db.listAllTeams()).rejects.toMatchObject({ name: "ForbiddenError" });
    await makeDb(SUPER_USER).db.checkProjectPerms("private-project", "owner", "access");
  });

  test.each([ANON_USER, teamActor("team" as TeamId), normalActor("other" as UserId)])("$type cannot impersonate a comment author or a missing author", identity => {
    const { db } = makeDb(identity);
    expect(db.isUserIdSelf("owner")).toBe(false);
    expect(db.isUserIdSelf(undefined)).toBe(false);
  });

  test("only the actual author or superuser matches a known comment author", () => {
    const { db } = makeDb();
    expect(db.isUserIdSelf("self")).toBe(true);
    expect(db.isUserIdSelf("other")).toBe(false);
    const admin = makeDb(SUPER_USER).db;
    expect(admin.isUserIdSelf("owner")).toBe(true);
    expect(admin.isUserIdSelf(undefined)).toBe(false);
  });

  test.each([
    [ANON_USER, 401],
    [normalActor("other" as UserId), 403],
  ] as const)("comment mutations recheck project permissions: %j returns %s", async (identity, statusCode) => {
    for (const action of ["resolve", "delete-comment", "delete-thread"] as const) {
      const { db, project } = makeDb(identity);
      const save = vi.spyOn(db.getEntMgr(), "save");
      Object.assign(project, { inviteOnly: false, defaultAccessLevel: "viewer" });
      vi.spyOn(db as any, "_getActorAccessLevelToProject").mockResolvedValue("blocked");
      const thread = { id: "thread", projectId: project.id, createdById: "owner" };
      vi.spyOn(db as any, "commentThreads").mockReturnValue({ findOne: async () => thread, find: async () => [thread] });
      const query = {
        innerJoin: vi.fn().mockReturnThis(), where: vi.fn().mockReturnThis(), andWhere: vi.fn().mockReturnThis(),
        getOne: async () => ({ id: "comment", createdById: "owner" }),
      };
      vi.spyOn(db as any, "comments").mockReturnValue({ createQueryBuilder: () => query });
      const pending = action === "resolve"
        ? db.resolveThreadInProject("history" as never, "thread" as never, true)
        : action === "delete-comment"
          ? db.deleteCommentInProject({ projectId: project.id }, "comment" as never)
          : db.deleteThreadInProject({ projectId: project.id }, "thread" as never);
      await expect(pending.catch(error => { throw transformErrors(error); })).rejects.toMatchObject({ statusCode });
      expect(save).not.toHaveBeenCalled();
    }
  });

  test.each([normalActor("self" as UserId), SUPER_USER])("$type can still edit an authorized comment", async identity => {
    const { db } = makeDb(identity);
    const comment = { id: "comment", createdById: "self", body: "before" };
    vi.spyOn(db as any, "comments").mockReturnValue({ find: async () => [comment] });
    const save = vi.spyOn(db.getEntMgr(), "save").mockResolvedValue(comment as never);
    await expect(db.editCommentInProject("comment" as never, "after")).resolves.toMatchObject({ body: "after" });
    expect(save).toHaveBeenCalledExactlyOnceWith(comment);
  });

  test("a valid secret project token can still resolve comments through its project permission", async () => {
    const { db, project } = makeDb(ANON_USER, { projectIdsAndTokens: [{ projectId: "private-project", projectApiToken: "write-token" }] });
    const thread = { id: "thread", projectId: project.id, createdById: "owner" };
    vi.spyOn(db as any, "commentThreads").mockReturnValue({ find: async () => [thread] });
    vi.spyOn(db as any, "commentThreadHistory").mockReturnValue({ create: (value: object) => value });
    const save = vi.spyOn(db.getEntMgr(), "save").mockResolvedValue([] as never);
    await expect(db.resolveThreadInProject("00000000-0000-4000-8000-000000000001" as never, "thread" as never, true)).resolves.toMatchObject({ resolved: true });
    expect(save).toHaveBeenCalledOnce();
  });
});
