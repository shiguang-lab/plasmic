import { createHash } from "crypto";
import type { Request, Response } from "express-serve-static-core";
import { BadRequestError } from "@/wab/shared/ApiErrors/errors";

const HEADER = "X-Plasmic-Model-Cache";

/** Negotiate immutable model contents after permissions, migrations and upgrades. */
export function sendWithDependencyModels(req: Request, res: Response, payload: {
  pkg?: unknown;
  depPkgs?: unknown[];
  [key: string]: unknown;
}) {
  res.vary(HEADER);
  const hint = req.get(HEADER);
  if (req.method !== "POST" || hint !== "1") {
    return res.json(payload);
  }
  const digests: unknown = req.body?.modelDigests;
  if (!Array.isArray(digests) || !digests.every(value => typeof value === "string" && /^[a-f0-9]{64}$/.test(value))) {
    throw new BadRequestError("Invalid dependency model cache digests");
  }
  const known = new Set<string>(digests);
  const snapshots: Record<string, string> = {};
  const encode = (value: any) => {
    if (!value?.model) {
      return value;
    }
    // Entity.toJSON normalizes dates and parses the persisted model string.
    const pkg = typeof value.toJSON === "function" ? value.toJSON() : { ...value };
    const model = typeof pkg.model === "string" ? JSON.parse(pkg.model) : pkg.model;
    const digest = createHash("sha256").update(JSON.stringify(model)).digest("hex");
    snapshots[pkg.id] = digest;
    const { model: _model, ...meta } = pkg;
    return known.has(digest) ? meta : { ...meta, model };
  };
  res.setHeader(HEADER, "1");
  // The envelope includes current permissions and mutable revision metadata.
  res.setHeader("Cache-Control", "private, no-store");
  return res.json({
    ...payload,
    ...(payload.pkg ? { pkg: encode(payload.pkg) } : {}),
    ...(payload.depPkgs ? { depPkgs: payload.depPkgs.map(encode) } : {}),
    modelSnapshots: snapshots,
  });
}
