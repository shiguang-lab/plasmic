import { DbMgr, normalActor } from "@/wab/server/db/DbMgr";
import { Permission, Project, Workspace } from "@/wab/server/entities/Entities";
import { ProjectId, UserId } from "@/wab/shared/ApiSchema";
import { Connection, EntityManager, Repository } from "typeorm";
import { mockDeep } from "vitest-mock-extended";

function fixture(workspaceId: string | null) {
  const userId = "user" as UserId;
  const projectId = "project" as ProjectId;
  const em = new EntityManager(mockDeep<Connection>());
  const save = vi.spyOn(em, "save").mockResolvedValue([]);
  const db = new DbMgr(em, normalActor(userId));
  const project = Object.assign(new Project(), {
    id: projectId,
    createdById: null,
    workspaceId,
  });
  const projects = mockDeep<Repository<any>>();
  projects.find.mockResolvedValue([project]);
  const getRepository = vi.spyOn(em, "getRepository").mockReturnValue(projects);
  const workspace = Object.assign(new Workspace(), { id: "personal" });
  const personalWorkspace = vi
    .spyOn(db, "getPersonalWorkspace")
    .mockResolvedValue(workspace);
  vi.spyOn(db, "getUserById").mockResolvedValue({
    id: userId,
    email: "user@example.com",
    displayName: "User",
    loginName: "user",
    state: "STATE_ACTIVE",
    emailVerified: true,
  });
  const permissions = mockDeep<Repository<any>>();
  permissions.create.mockReturnValue(new Permission());
  getRepository.mockImplementation((entity) =>
    entity === Project ? projects : permissions,
  );
  return {
    db,
    save,
    userId,
    projectId,
    project,
    personalWorkspace,
    permissions,
  };
}

test("a shared workspace project cannot be claimed or moved by its viewer", async () => {
  const { db, save, userId, projectId, project, personalWorkspace } =
    fixture("shared-library");
  await expect(db.claimPublicProject(projectId, userId)).rejects.toThrow(
    "Cannot update project createdBy",
  );
  expect(personalWorkspace).not.toHaveBeenCalled();
  expect(save).not.toHaveBeenCalled();
  expect(project.workspaceId).toBe("shared-library");
  expect(project.createdById).toBeNull();
});

test("an unowned anonymous project uses the normal personal workspace lookup and assigns its owner", async () => {
  const {
    db,
    save,
    userId,
    projectId,
    project,
    personalWorkspace,
    permissions,
  } = fixture(null);
  await db.claimPublicProject(projectId, userId);
  expect(personalWorkspace).toHaveBeenCalledOnce();
  expect(project.workspaceId).toBe("personal");
  expect(project.createdById).toBe(userId);
  expect(permissions.create).toHaveBeenCalledWith(
    expect.objectContaining({ projectId, accessLevel: "owner" }),
  );
  expect(save).toHaveBeenCalledTimes(2);
});
