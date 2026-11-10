import { loadDepPackages } from "@/wab/server/db/DbBundleLoader";
import { ANON_USER, DbMgr } from "@/wab/server/db/DbMgr";
import { findPresentationProject } from "@/wab/server/routes/presentations";
import { parseProjectIdsAndTokensHeader } from "@/wab/server/routes/util";
import { MainBranchId, ProjectId } from "@/wab/shared/ApiSchema";
import { parseBundle } from "@/wab/shared/bundles";
import { ensure } from "@/wab/shared/common";
import { PRESENTATION_BRANCH_HEADER, PRESENTATION_CODE_HEADER } from "@/wab/shared/presentation-access";
import type { NextFunction, Request, Response } from "express";

/** A presentation code authorizes only the reads needed by the preview runtime. */
export async function presentationAccess(req: Request, _res: Response, next: NextFunction) {
  const code = req.headers[PRESENTATION_CODE_HEADER];
  const resourceRead = /^\/api\/v1\/(dependency-models\/[^/]+|hostless-libraries\/[^/]+\/(canvas|release)|pkgs\/[^/]+)$/.test(req.path);
  const projectRead = /^\/api\/v1\/projects(?:\/[^/]+(?:\/branches(?:\/[^/]+)?)?)?$/.test(req.path);
  if (req.method !== "GET" || typeof code !== "string" || (!resourceRead && !projectRead)) {
    next();
    return;
  }
  try {
    const project = await findPresentationProject(req, code);
    // Reuse read-token permission checks without returning credentials to the caller.
    const tokens = [{ projectId: project.id as ProjectId, projectApiToken: ensure(project.projectApiToken, "Missing project read token") }];
    if (resourceRead) {
      const mgr = new DbMgr(req, ANON_USER, { projectIdsAndTokens: tokens });
      const rawBranch = req.headers[PRESENTATION_BRANCH_HEADER];
      const branchName = typeof rawBranch === "string" ? decodeURIComponent(rawBranch) : MainBranchId;
      const branch = branchName !== MainBranchId ? await mgr.getProjectBranchByName(project.id as ProjectId, branchName) : undefined;
      const revision = await mgr.getLatestProjectRev(project.id, { branchId: branch?.id });
      await loadDepPackages(mgr, parseBundle(revision), { extendTokens: true, dontMigrateBundle: true });
    }
    req.body ??= {};
    req.body.projectIdsAndTokens = [
      ...(req.body.projectIdsAndTokens ?? parseProjectIdsAndTokensHeader(req.headers["x-plasmic-api-project-tokens"]) ?? []),
      ...tokens,
    ];
    next();
  } catch (error) { next(error); }
}
