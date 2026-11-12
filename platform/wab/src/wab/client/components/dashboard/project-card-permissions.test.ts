import { projectCardPermissions } from "@/wab/client/components/dashboard/project-card-permissions";
import { toOpaque } from "@/wab/commons/types";
import type { ApiPermission, ApiProject, ApiUser } from "@/wab/shared/ApiSchema";
import { getAccessLevelToParent, getAccessLevelToResource } from "@/wab/shared/perms";
import { mock } from "vitest-mock-extended";

it("preserves direct and inherited access while ignoring unrelated rows", () => {
  const user = mock<ApiUser>({ id: toOpaque("self") });
  const project = mock<ApiProject>({
    id: toOpaque("same-id"),
    workspaceId: toOpaque("workspace"),
    teamId: toOpaque("team"),
    parentTeamId: toOpaque("parent"),
  });
  const resource = { type: "project" as const, resource: project };
  const permission = (fields: Partial<ApiPermission>) => ({
    id: "", projectId: null, workspaceId: null, teamId: null, userId: user.id,
    email: null, user: null, accessLevel: "viewer", ...fields,
  } satisfies ApiPermission);
  const projectGrant = permission({ projectId: project.id, accessLevel: "editor" });
  const workspaceGrant = permission({ workspaceId: project.workspaceId });
  const parentGrant = permission({ teamId: project.parentTeamId, accessLevel: "owner" });
  const anotherUser = permission({ teamId: project.teamId, userId: toOpaque("other") });
  const irrelevant = permission({ teamId: toOpaque("same-id") });
  const perms = [irrelevant, projectGrant, workspaceGrant, parentGrant, anotherUser];

  const scoped = projectCardPermissions(project, perms);
  expect(scoped).toEqual([projectGrant, workspaceGrant, anotherUser, parentGrant]);
  for (const actor of [user, null]) {
    expect(getAccessLevelToResource(resource, actor, scoped)).toBe(getAccessLevelToResource(resource, actor, perms));
    expect(getAccessLevelToParent(resource, actor, scoped)).toBe(getAccessLevelToParent(resource, actor, perms));
  }
  expect(projectCardPermissions(project, [projectGrant])).toEqual([projectGrant]);
});
