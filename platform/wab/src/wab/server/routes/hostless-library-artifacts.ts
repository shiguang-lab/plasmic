import { HostlessLibraryVersion } from "@/wab/server/entities/CustomEntities";
import { userDbMgr } from "@/wab/server/routes/util";
import { ensure, ensureArray, ensureString } from "@/wab/shared/common";
import { BadRequestError, NotFoundError } from "@/wab/shared/ApiErrors/errors";
import { DEVFLAGS } from "@/wab/shared/devflags";
import type { Request, Response } from "express-serve-static-core";
import { createHash } from "crypto";
import semver from "semver";

async function resolveLibrary(req: Request) {
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
  if (req.query.pkgId && ensureString(req.query.pkgId) !== pkg.id) {
    throw new BadRequestError("Component library package does not match the requested release");
  }
  const version = req.query.version ? ensureString(req.query.version) : undefined;
  if (version && semver.valid(version) !== version) {
    throw new BadRequestError("An exact component library version is required");
  }
  const pkgVersion = await db.getPkgVersion(pkg.id, version);
  return { db, pkg, pkgVersion };
}

/** Library authoring resolves latest once, then loads the same exact-version path. */
export async function getHostlessLibraryRelease(req: Request, res: Response) {
  const { db, pkg, pkgVersion } = await resolveLibrary(req);
  ensure(await db.getEntMgr().findOne(HostlessLibraryVersion, { pkgVersionId: pkgVersion.id }), "Component library version has no code artifact");
  res.setHeader("Cache-Control", "private, no-store");
  res.json({ pkgId: pkg.id, version: pkgVersion.version });
}

export async function getHostlessLibraryCanvas(req: Request, res: Response) {
  const { db, pkg, pkgVersion } = await resolveLibrary(req);
  const artifact = await db.getEntMgr().findOne(HostlessLibraryVersion, { pkgVersionId: pkgVersion.id });
  if (!artifact) {
    throw new NotFoundError("Component library version has no code artifact");
  }
  res.setHeader("Content-Type", "application/javascript; charset=utf-8");
  // Every network request checks access. Desktop may serve an already authorized
  // immutable release locally; ordinary browsers revalidate their HTTP cache.
  res.setHeader("Cache-Control", "private, no-cache");
  res.setHeader("ETag", `"${artifact.artifact.digest}"`);
  res.setHeader("X-Plasmic-Library-Release", JSON.stringify({
    pkgId: pkg.id,
    version: pkgVersion.version,
    digest: createHash("sha256").update(artifact.artifact.canvas).digest("hex"),
  }));
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.send(artifact.artifact.canvas);
}
