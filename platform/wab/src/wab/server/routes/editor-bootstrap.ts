import { getSelfInfo } from "@/wab/server/auth/routes";
import { getLastBundleVersion } from "@/wab/server/db/BundleMigrator";
import { getAppCtxData } from "@/wab/server/routes/appctx";
import { getTrustedHostsData } from "@/wab/server/routes/hosts";
import { getProjectsData } from "@/wab/server/routes/projects";
import { parseQueryParams, userDbMgr } from "@/wab/server/routes/util";
import {
  EditorBootstrapResponse,
  MainBranchId,
  ProjectId,
} from "@/wab/shared/ApiSchema";
import { ensureString } from "@/wab/shared/common";
import type { Request, Response } from "express";

export async function getEditorBootstrap(req: Request, res: Response) {
  const projectId = req.params.projectId;
  const { branchName: rawBranchName } = parseQueryParams(req);
  const branchName = rawBranchName ? ensureString(rawBranchName) : undefined;
  const [selfInfo, appCtx, latestBundleVersion, projectData, hosts, branches] =
    await Promise.all([
      req.user ? getSelfInfo(req) : Promise.resolve(null),
      getAppCtxData(req),
      getLastBundleVersion(),
      getProjectsData(req, { query: "byIds", projectIds: [projectId] }),
      getTrustedHostsData(req),
      branchName && branchName !== MainBranchId
        ? userDbMgr(req).listBranchesForProject(projectId as ProjectId)
        : Promise.resolve([]),
    ]);
  const data: EditorBootstrapResponse = {
    selfInfo,
    appCtx,
    latestBundleVersion,
    projectData,
    hosts,
    branches,
    projectId,
    branchName,
    appConfig: { config: req.devflags },
  };
  res.setHeader("Cache-Control", "no-store");
  res.json(data);
}
