import type { ProjectId } from "@/wab/shared/ApiSchema";

// Resolved independently in each frame before mounting project consumers.
const projects = new Map<string, ProjectId>();
export function registerPresentationProject(
  code: string,
  projectId: ProjectId,
) {
  projects.set(code, projectId);
}
export function presentationProject(code: string) {
  return projects.get(code);
}
