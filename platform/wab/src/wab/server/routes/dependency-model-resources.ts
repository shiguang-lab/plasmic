import { DependencyModelResource } from "@/wab/server/entities/CustomEntities";
import { userDbMgr, withNext } from "@/wab/server/routes/util";
import { NotFoundError } from "@/wab/shared/ApiErrors/errors";
import { ensure } from "@/wab/shared/common";
import { createHash, randomUUID } from "crypto";
import type { NextFunction, Request, Response } from "express-serve-static-core";

/** Replace dependency bodies with immutable resource identities, never client cache hints. */
export async function dependencyModelResources<T extends { pkg?: unknown; depPkgs?: unknown[]; [key: string]: unknown }>(req: Request, payload: T) {
  const packages = [...(payload.pkg ? [payload.pkg] : []), ...(payload.depPkgs ?? [])];
  const entries = new Map<string, { pkg: any; digest: string; model: string }>();
  for (const value of packages as any[]) {
    if (!value?.model) { continue; }
    const pkg = typeof value.toJSON === "function" ? value.toJSON() : { ...value };
    const model = JSON.stringify(typeof pkg.model === "string" ? JSON.parse(pkg.model) : pkg.model);
    const digest = createHash("sha256").update(model).digest("hex");
    entries.set(pkg.id, { pkg, digest, model });
  }
  if (!entries.size) { return payload; }
  // Cache artifacts must be committed before their URLs are sent to clients;
  // the surrounding project-read transaction may still be open at that point.
  const repository = req.noTxMgr.getRepository(DependencyModelResource);
  const existing = await repository.find({
    select: ["id", "pkgVersionId", "digest"],
    where: [...entries.values()].map(({ pkg, digest }) => ({ pkgVersionId: pkg.id, digest })),
  });
  const resources = new Map(existing.map(value => [value.pkgVersionId, value.id]));
  // Stable ordering also protects concurrent first reads of overlapping libraries.
  for (const [id, { pkg, digest, model }] of [...entries].sort(([a], [b]) => a.localeCompare(b))) {
    if (resources.has(id)) { continue; }
    await repository.createQueryBuilder().insert().values({
      id: randomUUID(), pkgVersionId: id, pkgId: ensure(pkg.pkgId, "Missing dependency package identity"), digest, model,
    }).orIgnore().execute();
    resources.set(id, ensure(await repository.findOne({ pkgVersionId: id, digest }, { select: ["id"] }), "Missing dependency model resource").id);
  }
  const reference = (value: any) => {
    const entry = entries.get(value?.id);
    if (!entry) { return value; }
    const { model: _model, ...meta } = entry.pkg;
    return { ...meta, modelResourceId: ensure(resources.get(entry.pkg.id), "Missing model resource identity") };
  };
  return { ...payload, ...(payload.pkg ? { pkg: reference(payload.pkg) } : {}), ...(payload.depPkgs ? { depPkgs: payload.depPkgs.map(reference) } : {}) };
}

/** Finish the read transaction before materializing/sending immutable resource URLs. */
export function withDependencyModelResources(handler: (req: Request, res: Response, next: NextFunction) => Promise<void> | void) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const json = res.json;
    const end = res.end;
    let finish: (() => void) | undefined;
    let pending: { payload: Parameters<typeof dependencyModelResources>[1] } | undefined;
    let failure: { error: unknown } | undefined;
    res.json = payload => { pending = { payload }; return res; };
    res.end = (...args: unknown[]) => {
      finish = () => { Reflect.apply(end, res, args); };
      return res;
    };
    try {
      await withNext(handler)(req, res, error => { failure = { error }; });
    } finally {
      res.json = json;
      res.end = end;
    }
    if (failure) { next(failure.error); return; }
    try {
      if (!pending) { finish?.(); return; } // Send bodyless 304 only after commit.
      const payload = await dependencyModelResources(req, pending.payload);
      res.setHeader("Cache-Control", "private, no-store");
      res.json(payload);
    } catch (error) { next(error); }
  };
}

/** Exact immutable resource GET: authentication is checked, no negotiation/cropping. */
export async function getDependencyModelResource(req: Request, res: Response) {
  const mgr = userDbMgr(req);
  const repository = mgr.getEntMgr().getRepository(DependencyModelResource);
  const resource = await repository.findOne(req.params.resourceId, { select: ["id", "pkgId", "digest"] });
  if (!resource) { throw new NotFoundError("Dependency model resource not found"); }
  await mgr.getPkgById(resource.pkgId);
  const body = ensure(await repository.findOne(resource.id, { select: ["model"] }), "Dependency model resource disappeared").model;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "private, max-age=31536000, immutable");
  res.setHeader("X-Plasmic-Model-Resource", JSON.stringify({ id: resource.id, digest: resource.digest }));
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.send(body);
}
