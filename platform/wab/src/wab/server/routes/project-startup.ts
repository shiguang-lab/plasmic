import { getSelfInfo } from "@/wab/server/auth/routes";
import { getLastBundleVersion } from "@/wab/server/db/BundleMigrator";
import { getAppCtxData } from "@/wab/server/routes/appctx";
import { getTrustedHostsData } from "@/wab/server/routes/hosts";
import { parseQueryParams, superDbMgr, userDbMgr } from "@/wab/server/routes/util";
import {
  ProjectStartupInfo,
  MainBranchId,
  ProjectId,
} from "@/wab/shared/ApiSchema";
import { ensureString } from "@/wab/shared/common";
import type { Request } from "express";

export function loadProjectStartup(req: Request, projectId: ProjectId) {
  const { branchName: rawBranchName } = parseQueryParams(req);
  const branchName = rawBranchName ? ensureString(rawBranchName) : undefined;
  const branchRead = branchName && branchName !== MainBranchId
    ? userDbMgr(req).listBranchesForProject(projectId)
    : Promise.resolve([]);
  const personalWorkspace = req.user
    ? superDbMgr(req).ensurePersonalWorkspace(req.user)
    : undefined;
  const data = Promise.all([
    req.user ? getSelfInfo(req, personalWorkspace) : Promise.resolve(null),
    getAppCtxData(req, personalWorkspace),
    getLastBundleVersion(),
    getTrustedHostsData(req),
    branchRead,
  ]).then(([selfInfo, appCtx, latestBundleVersion, hosts, branches]): Omit<ProjectStartupInfo, "projectData"> => ({
    selfInfo,
    appCtx,
    latestBundleVersion,
    hosts,
    branches,
    projectId,
    branchName,
    appConfig: { config: req.devflags },
  }));
  return { branches: branchRead, data };
}
