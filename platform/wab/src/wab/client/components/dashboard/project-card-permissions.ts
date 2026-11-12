import type { ApiPermission, ApiProject } from "@/wab/shared/ApiSchema";

// Dashboard data loaders replace permission arrays on refresh. Share the
// index across every card rendered from the same response.
const permissionIndexes = new WeakMap<ApiPermission[], Map<string, ApiPermission[]>>();

export function projectCardPermissions(project: ApiProject, perms: ApiPermission[]) {
  let index = permissionIndexes.get(perms);
  if (!index) {
    index = new Map();
    for (const perm of perms) {
      for (const type of ["project", "workspace", "team"] as const) {
        const id = perm[`${type}Id`];
        if (!id) { continue; }
        const key = `${type}:${id}`;
        const entries = index.get(key);
        if (entries) {
          entries.push(perm);
        } else {
          index.set(key, [perm]);
        }
      }
    }
    permissionIndexes.set(perms, index);
  }
  return [
    ...(index.get(`project:${project.id}`) ?? []),
    ...(index.get(`workspace:${project.workspaceId}`) ?? []),
    ...(index.get(`team:${project.teamId}`) ?? []),
    ...(project.parentTeamId && project.parentTeamId !== project.teamId
      ? index.get(`team:${project.parentTeamId}`) ?? []
      : []),
  ];
}
