import type { ProjectId } from "@/wab/shared/ApiSchema";
import { PRESENTATION_BRANCH_HEADER, PRESENTATION_CODE_HEADER } from "@/wab/shared/presentation-access";
import { APP_ROUTES, SEARCH_PARAM_BRANCH } from "@/wab/shared/route/app-routes";

export function presentationRequestHeaders(): Record<string, string> {
  const code = APP_ROUTES.projectPresentation.parse(window.location.pathname)?.code;
  if (!code) { return {}; }
  const branch = new URLSearchParams(window.location.search).get(SEARCH_PARAM_BRANCH);
  return {
    [PRESENTATION_CODE_HEADER]: code,
    ...(branch ? { [PRESENTATION_BRANCH_HEADER]: encodeURIComponent(branch) } : {}),
  };
}

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
