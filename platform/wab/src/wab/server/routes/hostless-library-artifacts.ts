import { HostlessLibraryVersion } from "@/wab/server/entities/CustomEntities";
import { userDbMgr } from "@/wab/server/routes/util";
import { ensure, ensureArray, ensureString } from "@/wab/shared/common";
import { NotFoundError } from "@/wab/shared/ApiErrors/errors";
import { DEVFLAGS } from "@/wab/shared/devflags";
import type { Request, Response } from "express-serve-static-core";

export async function getHostlessLibraryCanvas(req: Request, res: Response) {
  const db = userDbMgr(req);
  const overrides = JSON.parse((await db.tryGetDevFlagOverrides())?.data ?? "{}");
  const catalog: NonNullable<typeof DEVFLAGS.hostLessComponents> = overrides.hostLessComponents ?? DEVFLAGS.hostLessComponents ?? [];
  const entry = catalog.find((lib) => lib.codeName === req.params.name && lib.hasCodeArtifacts);
  if (!entry) {
    throw new NotFoundError("Component library not found");
  }
  const projectId = ensure(ensureArray(entry.projectId)[0], "Missing library project");
  await db.checkProjectPerms(projectId, "viewer", "read component library code");
  const pkg = ensure(await db.getPkgByProjectId(projectId), "Missing library package");
  const version = req.query.version ? ensureString(req.query.version) : undefined;
  const pkgVersion = await db.getPkgVersion(pkg.id, version);
  const artifact = await db.getEntMgr().findOne(HostlessLibraryVersion, { pkgVersionId: pkgVersion.id });
  if (!artifact) {
    throw new NotFoundError("Component library version has no code artifact");
  }
  res.setHeader("Content-Type", "application/javascript; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.send(artifact.artifact.canvas);
}
