import { Project } from "@/wab/server/entities/Entities";
import { userDbMgr } from "@/wab/server/routes/util";
import {
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
} from "@/wab/shared/ApiErrors/errors";
import { ensureString } from "@/wab/shared/common";
import type { Request, Response } from "express";
import { nanoid } from "nanoid";

export async function createPresentation(req: Request, res: Response) {
  const mgr = userDbMgr(req);
  const project = await mgr.getProjectById(ensureString(req.params.projectId));
  // Allocate once, including when two viewers open a presentation concurrently.
  const [[result]] = await mgr
    .getEntMgr()
    .query(
      'UPDATE "project" SET "presentationCode" = COALESCE("presentationCode", $2) WHERE "id" = $1 RETURNING "presentationCode" AS code',
      [project.id, nanoid(10)],
    );
  res.setHeader("Cache-Control", "no-store");
  res.json({ code: result.code, projectId: project.id });
}

export async function getPresentation(req: Request, res: Response) {
  const code = ensureString(req.params.code);
  if (!/^[\w-]{10}$/.test(code)) {
    throw new NotFoundError("Presentation not found");
  }
  const mgr = userDbMgr(req);
  const project = await mgr
    .getEntMgr()
    .findOne(Project, { presentationCode: code });
  if (!project) {
    throw new NotFoundError("Presentation not found");
  }
  // A short identifier grants no access; deleted/private projects retain normal checks.
  try {
    await mgr.getProjectById(project.id);
  } catch (error) {
    if (!req.user && error instanceof ForbiddenError) {
      throw new UnauthorizedError();
    }
    throw error;
  }
  res.setHeader("Cache-Control", "no-store");
  res.json({ code, projectId: project.id });
}
