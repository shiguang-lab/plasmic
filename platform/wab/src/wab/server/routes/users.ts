import { searchShiguangUsers } from "@/wab/server/auth/shiguang-directory";
import { userDbMgr } from "@/wab/server/routes/util";
import { BadRequestError } from "@/wab/shared/ApiErrors/errors";
import { UsersResponse } from "@/wab/shared/ApiSchema";
import { ensureType } from "@/wab/shared/common";
import { Request, Response } from "express-serve-static-core";

export async function getUsersById(req: Request, res: Response) {
  const mgr = userDbMgr(req);
  const users = await mgr.tryGetUsersById(req.params.userIds.split(","));
  res.json(ensureType<UsersResponse>({ users }));
}

export async function searchIdentities(req: Request, res: Response) {
  const query = req.query.query;
  if (
    typeof query !== "string" ||
    query.trim().length < 3 ||
    query.trim().length > 64
  ) {
    throw new BadRequestError("Invalid user search");
  }
  res.json({ users: await searchShiguangUsers(query.trim()) });
}
