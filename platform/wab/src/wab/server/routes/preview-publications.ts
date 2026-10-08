import { DbMgr } from "@/wab/server/db/DbMgr";
import { PreviewPublication } from "@/wab/server/entities/CustomEntities";
import {
  genPublishedLoaderCodeBundle,
  LATEST_LOADER_VERSION,
} from "@/wab/server/loader/gen-code-bundle";
import { mkVersionToSync } from "@/wab/server/loader/resolve-projects";
import { getProjectLibraryArtifacts } from "@/wab/server/loader/project-library-artifacts";
import { userDbMgr } from "@/wab/server/routes/util";
import { BadRequestError } from "@/wab/shared/ApiErrors/errors";
import type { ProjectId } from "@/wab/shared/ApiSchema";
import { ensure, ensureString } from "@/wab/shared/common";
import type { PreviewPublication as ApiPublication } from "@plasmic-shared/preview";
import type { Request, Response } from "express-serve-static-core";
import { nanoid } from "nanoid";

function previewOrigin() {
  const url = new URL(
    ensure(process.env.PREVIEW_ORIGIN, "PREVIEW_ORIGIN is not configured"),
  );
  if (
    url.protocol !== "https:" &&
    url.hostname !== "localhost" &&
    url.hostname !== "127.0.0.1"
  ) {
    throw new BadRequestError("PREVIEW_ORIGIN must use HTTPS");
  }
  return url.origin;
}

function serialize(publication: PreviewPublication): ApiPublication {
  const { bundle: _bundle, publishedAt, ...metadata } = publication;
  return {
    ...metadata,
    publishedAt: publishedAt.toISOString(),
    url: `${previewOrigin()}/s/${publication.code}`,
  };
}

export async function getPreviewPublication(req: Request, res: Response) {
  const mgr = userDbMgr(req);
  const projectId = ensureString(req.params.projectId);
  await mgr.checkProjectPerms(projectId, "viewer", "read published website");
  const publication = await mgr
    .getEntMgr()
    .findOne(PreviewPublication, { projectId });
  res.json({ publication: publication ? serialize(publication) : null });
}

async function publishWebsite(req: Request) {
  previewOrigin();
  const mgr = userDbMgr(req);
  const projectId = ensureString(req.params.projectId) as ProjectId;
  const publication = await mgr.getEntMgr().transaction(async (em) => {
    await em.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [
      `preview:${projectId}`,
    ]);
    const txMgr = new DbMgr(em, mgr.actor, mgr.opts);
    await txMgr.getProjectById(projectId);
    const pkg = await txMgr.getPkgByProjectId(projectId);
    if (!pkg) {
      throw new BadRequestError(
        "Publish a project version before publishing the website.",
      );
    }
    const version = await txMgr.getLatestPkgVersionNumber(pkg.id, undefined);
    const libraryArtifacts = await getProjectLibraryArtifacts(txMgr, projectId, version);
    const existing = await em.findOne(PreviewPublication, { projectId });
    const bundle = await genPublishedLoaderCodeBundle(txMgr, req.workerpool, {
      source: "live",
      platform: "nextjs",
      platformOptions: {},
      projectVersions: { [projectId]: mkVersionToSync(version) },
      loaderVersion: LATEST_LOADER_VERSION,
      browserOnly: true,
      libraryArtifacts,
      i18nKeyScheme: undefined,
      i18nTagPrefix: undefined,
    });
    const pages = bundle.components
      .filter((c) => c.projectId === projectId && c.isPage && c.path)
      .map((c) => ({
        id: c.id,
        name: c.displayName,
        path: ensure(c.path, "Page path missing"),
      }));
    if (!pages.length) {
      throw new BadRequestError("This project has no published pages.");
    }
    // A non-hostless custom component needs an application-specific registration.
    if (bundle.components.some((c) => c.isCode)) {
      throw new BadRequestError(
        "This project requires custom code components that are not installed in the preview runtime.",
      );
    }
    const requestedPath = req.body.entryPath ?? existing?.entryPath;
    const entryPath =
      requestedPath ||
      pages.find((page) => page.path === "/")?.path ||
      pages.find((page) => !page.path.includes("["))?.path;
    if (
      !entryPath ||
      !pages.some((page) => page.path === entryPath) ||
      entryPath.includes("[")
    ) {
      throw new BadRequestError(
        "Choose a published page with a fixed URL as the entry page.",
      );
    }
    const result = em.create(PreviewPublication, {
      projectId,
      code: existing?.code ?? nanoid(10),
      version,
      enabled: true,
      entryPath,
      pages,
      bundle,
      publishedAt: new Date(),
    });
    await em.save(result);
    return result;
  });
  return publication;
}

export async function publishPreviewPublication(req: Request, res: Response) {
  await userDbMgr(req).checkProjectPerms(
    req.params.projectId,
    "editor",
    "publish website",
  );
  const publication = await publishWebsite(req);
  res.json({
    publication: serialize(ensure(publication, "Published website missing")),
  });
}

export async function unpublishPreviewPublication(req: Request, res: Response) {
  const mgr = userDbMgr(req);
  const projectId = ensureString(req.params.projectId) as ProjectId;
  await mgr.checkProjectPerms(projectId, "editor", "unpublish website");
  await mgr.getEntMgr().transaction(async (em) => {
    await em.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [
      `preview:${projectId}`,
    ]);
    const publication = await em.findOne(PreviewPublication, { projectId });
    if (publication) {
      await em.update(
        PreviewPublication,
        { projectId },
        { enabled: false, bundle: null },
      );
    }
  });
  res.json({});
}
