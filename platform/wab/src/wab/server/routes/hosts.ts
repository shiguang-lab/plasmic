import { userDbMgr } from "@/wab/server/routes/util";
import { TrustedHostsListResponse } from "@/wab/shared/ApiSchema";
import { Request, Response } from "express-serve-static-core";
import { pick } from "lodash";

export async function getTrustedHostsData(req: Request): Promise<TrustedHostsListResponse> {
  const hosts = await userDbMgr(req).listTrustedHostsForSelf();
  return { trustedHosts: hosts.map((host) => pick(host, "id", "hostUrl")) };
}

export async function getTrustedHostsForSelf(req: Request, res: Response) {
  res.json(await getTrustedHostsData(req));
}

export async function addTrustedHost(req: Request, res: Response) {
  const mgr = userDbMgr(req);
  const { url } = req.body;
  await mgr.addTrustedHost(url);
  res.json({});
}

export async function deleteTrustedHost(req: Request, res: Response) {
  const { trustedHostId } = req.params;
  const mgr = userDbMgr(req);
  await mgr.deleteTrustedHost(trustedHostId);
  res.json({});
}
