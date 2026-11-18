import { getUser, userDbMgr } from "@/wab/server/routes/util";
import { BadRequestError, ForbiddenError } from "@/wab/shared/ApiErrors/errors";
import type { Request, Response } from "express-serve-static-core";
import os from "os";
import path from "path";

const {
  ComponentEmbedding,
} = require("../component-reuse/component-embedding.cjs");
const {
  ComponentSearchService,
} = require("../component-reuse/search-service.cjs");
const { hash } = require("../component-reuse/component-reuse.cjs");
const service = new ComponentSearchService(
  process.env.COMPONENT_VECTOR_CACHE ||
    path.join(os.homedir(), ".cache/plasmic/component-vectors"),
  new ComponentEmbedding(
    process.env.COMPONENT_MODEL_DIRECTORY || "/opt/plasmic-component-search",
  ),
);

export async function prepareComponentSearch() {
  await service.prepare();
}

export async function componentSearch(req: Request, res: Response) {
  if (!req.devflags.enableComponentReuseAdvisory)
    throw new ForbiddenError("Component review disabled");
  const account = hash(getUser(req).id);
  const project = req.params.projectId;
  await userDbMgr(req).checkProjectPerms(
    project,
    "viewer",
    "Review project components",
  );
  const scope = { account, project };
  const abort = new AbortController();
  const close = () => abort.abort();
  res.once("close", close);
  try {
    const result =
      req.body?.command === "sync"
        ? await service.sync(scope, req.body)
        : req.body?.command === "search"
          ? await service.search(
              scope,
              req.body,
              AbortSignal.any([abort.signal, AbortSignal.timeout(5000)]),
            )
          : undefined;
    if (result === undefined)
      throw new BadRequestError("Invalid component search command");
    if (!result) {
      res.status(409).json({ error: "Component catalogue expired" });
      return;
    }
    res.json(result);
  } catch (error) {
    if (error instanceof TypeError) throw new BadRequestError(error.message);
    throw error;
  } finally {
    res.off("close", close);
  }
}
