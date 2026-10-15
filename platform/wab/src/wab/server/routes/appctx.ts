import { checkFreeTrialDuration } from "@/wab/server/routes/team-plans";
import { mkApiTeam } from "@/wab/server/routes/teams";
import { superDbMgr, userDbMgr } from "@/wab/server/routes/util";
import { mkApiWorkspace } from "@/wab/server/routes/workspaces";
import { ApiTeam, ApiWorkspace, AppCtxResponse } from "@/wab/shared/ApiSchema";
import { Request, Response } from "express-serve-static-core";

export async function getAppCtxData(req: Request): Promise<AppCtxResponse> {
  const userMgr = userDbMgr(req, { allowUnverifiedEmail: true });

  if (!userMgr.tryGetNormalActorId()) {
    // Return empty response if called by a non-normal user or user waiting
    // email verification.
    return { teams: [], workspaces: [], perms: [] };
  }

  if (req.user) {
    await superDbMgr(req).ensurePersonalWorkspace(req.user);
  }

  const teams: ApiTeam[] = await Promise.all(
    (await userMgr.getAffiliatedTeams()).map(async (t) => {
      await checkFreeTrialDuration(req, t);
      return mkApiTeam(t);
    }),
  );
  const workspaces: ApiWorkspace[] = (
    await userMgr.getAffiliatedWorkspaces()
  ).map(mkApiWorkspace);
  const { perms } = await userMgr.getSelfPerms();
  return { teams, workspaces, perms };
}

export async function getAppCtx(req: Request, res: Response) {
  res.json(await getAppCtxData(req));
}
