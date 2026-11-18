import { getMigratedBundle } from "@/wab/server/db/BundleMigrator";
import {
  loadDepPackages,
  unbundleProjectFromData,
} from "@/wab/server/db/DbBundleLoader";
import { DbMgr, SUPER_USER } from "@/wab/server/db/DbMgr";
import {
  DesignTemplate,
  PreviewPublication,
} from "@/wab/server/entities/CustomEntities";
import { Project } from "@/wab/server/entities/Entities";
import {
  publishWebsiteSnapshot,
  serializePreviewPublication,
} from "@/wab/server/routes/preview-publications";
import { getCurrentModelVersion } from "@/wab/server/routes/projects";
import { getUser, superDbMgr } from "@/wab/server/routes/util";
import {
  BadRequestError,
  ForbiddenError,
  NotFoundError,
} from "@/wab/shared/ApiErrors/errors";
import { getArenaFrames } from "@/wab/shared/Arenas";
import type { GetProjectResponse } from "@/wab/shared/ApiSchema";
import { Bundler } from "@/wab/shared/bundler";
import { ComponentType } from "@/wab/shared/core/components";
import { createSite } from "@/wab/shared/core/sites";
import type {
  ApiDesignTemplate,
  TemplateCenterResponse,
  TemplateMetadata,
} from "@/wab/shared/template-center";
import { TplMgr } from "@/wab/shared/TplMgr";
import type { Request, Response } from "express-serve-static-core";
import type { EntityManager } from "typeorm";
import { z } from "zod";

const metadataSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    description: z.string().trim().max(4000),
    kind: z.enum(["page", "section"]),
    device: z.enum(["mobile", "desktop", "responsive"]),
    category: z.string().trim().max(80),
    thumbnailUrl: z
      .string()
      .max(2048)
      .refine((value) => {
        if (!value) {
          return true;
        }
        try {
          return ["https:", "http:"].includes(new URL(value).protocol);
        } catch {
          return false;
        }
      }),
  })
  .strict();

function readMetadata(body: unknown): TemplateMetadata {
  const result = metadataSchema.safeParse(body);
  if (!result.success) {
    throw new BadRequestError("Invalid template metadata");
  }
  return result.data;
}

function requireAdmin(req: Request) {
  getUser(req);
  if (!req.shiguangIdentity?.roles.includes("system-admin")) {
    throw new ForbiddenError(
      "Only system administrators can maintain templates",
    );
  }
}

function serialize(
  record: DesignTemplate,
  canManage: boolean,
): ApiDesignTemplate {
  return {
    id: record.projectId,
    metadata: record.metadata,
    published: record.published,
    ...(canManage ? { updatedAt: record.updatedAt.toISOString() } : {}),
  };
}

async function findTemplate(em: EntityManager, id: string) {
  const record = await em
    .getRepository(DesignTemplate)
    .createQueryBuilder("template")
    .innerJoin(Project, "project", 'project.id = template."projectId"')
    .where('template."projectId" = :id', { id })
    .andWhere('project."deletedAt" IS NULL AND project."isTemplate" = true')
    .getOne();
  if (!record) {
    throw new NotFoundError("Template not found");
  }
  return record;
}

export async function listDesignTemplates(req: Request, res: Response) {
  getUser(req);
  const canManage =
    req.shiguangIdentity?.roles.includes("system-admin") ?? false;
  const query = superDbMgr(req)
    .getEntMgr()
    .getRepository(DesignTemplate)
    .createQueryBuilder("template")
    .innerJoin(Project, "project", 'project.id = template."projectId"')
    .where('project."deletedAt" IS NULL AND project."isTemplate" = true')
    .orderBy('template."updatedAt"', "DESC");
  if (!canManage) {
    query.andWhere("template.published IS NOT NULL");
  }
  const records = await query.getMany();
  res.setHeader("Cache-Control", "no-store");
  res.json({
    templates: records.map((record) => serialize(record, canManage)),
    canManage,
  } satisfies TemplateCenterResponse);
}

export async function getPublishedDesignTemplateStudio(
  req: Request,
  res: Response,
) {
  getUser(req);
  const mgr = superDbMgr(req);
  const record = await findTemplate(mgr.getEntMgr(), req.params.templateId);
  const published = record.published;
  if (!published) {
    throw new NotFoundError("Template is not published");
  }

  const projectId = record.projectId;
  const pkg = await mgr.getPkgByProjectId(projectId);
  const version = pkg && await mgr.tryGetPkgVersion(pkg.id, published.version);
  if (!version || version.version !== published.version || version.branchId) {
    throw new NotFoundError("Published template version not found");
  }
  const [bundle, modelVersion, hostlessVersion] = await Promise.all([
    getMigratedBundle(version),
    getCurrentModelVersion(mgr.getEntMgr()),
    mgr.getHostlessVersion(),
  ]);
  const dependencies = await loadDepPackages(mgr, bundle);
  const depPkgs = dependencies.map((dep) => ({
    ...dep,
    model: JSON.parse(dep.model),
  }));

  // Combine current catalog metadata with the published model and its host.
  const response: GetProjectResponse = {
    project: {
      id: projectId,
      isTemplate: true,
      publishedTemplateVersion: published.version,
      name: record.metadata.name,
      createdAt: published.publishedAt,
      updatedAt: record.updatedAt.toISOString(),
      createdById: null,
      updatedById: null,
      deletedAt: null,
      deletedById: null,
      hostUrl: version.hostUrl,
      inviteOnly: true,
      defaultAccessLevel: "viewer",
      readableByPublic: false,
      clonedFromProjectId: null,
      projectApiToken: null,
      workspaceId: null,
      workspaceName: null,
      parentTeamId: null,
      teamId: null,
      teamName: null,
      featureTier: null,
      uiConfig: null,
      contentCreatorConfig: null,
      extraData: {},
      revisions: [],
      perms: [],
      owner: undefined,
      latestRevisionSynced: 0,
      hasAppAuth: false,
      isMainBranchProtected: true,
    },
    // A package snapshot has no live revision cursor for saves or updates.
    rev: { projectId, data: JSON.stringify(bundle), revision: 0 },
    depPkgs,
    perms: [],
    modelVersion,
    hostlessDataVersion: hostlessVersion.versionCount,
    owner: undefined,
    latestRevisionSynced: 0,
    hasAppAuth: false,
    isMainBranchProtected: true,
  };
  res.setHeader("Cache-Control", "no-store");
  res.json(response);
}

export async function createDesignTemplate(req: Request, res: Response) {
  requireAdmin(req);
  const metadata = readMetadata(req.body);
  const record = await superDbMgr(req)
    .getEntMgr()
    .transaction(async (em) => {
      const mgr = new DbMgr(em, SUPER_USER);
      const site = createSite();
      const page = new TplMgr({ site }).addComponent({
        type: ComponentType.Page,
        name: metadata.name,
        pageMeta: { path: "/" },
      });
      if ("name" in page.tplTree) {
        page.tplTree.name = "Root";
      }
      if (metadata.device === "mobile") {
        for (const arena of site.pageArenas) {
          for (const frame of getArenaFrames(arena)) {
            frame.width = 390;
            frame.height = 844;
          }
        }
      }
      const { project } = await mgr.createProjectAndSaveRev({
        site,
        bundler: new Bundler(),
        name: metadata.name,
      });
      await em.update(Project, project.id, {
        isTemplate: true,
        createdById: getUser(req).id,
      });
      return em.save(
        em.create(DesignTemplate, {
          projectId: project.id,
          metadata,
          published: null,
          updatedAt: new Date(),
        }),
      );
    });
  res.json({ template: serialize(record, true) });
}

async function maintain(
  req: Request,
  action: (em: EntityManager, record: DesignTemplate) => Promise<void>,
  manager = superDbMgr(req).getEntMgr(),
) {
  requireAdmin(req);
  return manager.transaction(async (em) => {
    await em.query("SELECT pg_advisory_xact_lock(hashtext($1))", [
      `template:${req.params.templateId}`,
    ]);
    const record = await findTemplate(em, req.params.templateId);
    await action(em, record);
    record.updatedAt = new Date();
    await em.save(record);
    return record;
  });
}

export async function updateDesignTemplate(req: Request, res: Response) {
  requireAdmin(req);
  const metadata = readMetadata(req.body);
  const record = await maintain(req, async (em, template) => {
    template.metadata = metadata;
    await em.update(Project, template.projectId, { name: metadata.name });
  });
  res.json({ template: serialize(record, true) });
}

export async function publishDesignTemplate(req: Request, res: Response) {
  requireAdmin(req);
  // Codegen workers use their own DB connections. Commit the private model
  // version first; only the final transaction switches the published canvas.
  const prepared = await req.noTxMgr.transaction(async (em) => {
    await em.query("SELECT pg_advisory_xact_lock(hashtext($1))", [
      `template:${req.params.templateId}`,
    ]);
    const template = await findTemplate(em, req.params.templateId);
    const mgr = new DbMgr(em, SUPER_USER);
    const revision = await mgr.getLatestProjectRev(template.projectId);
    const site = await unbundleProjectFromData(mgr, new Bundler(), revision);
    const paths = site.components.flatMap((component) =>
      component.pageMeta ? [component.pageMeta.path] : [],
    );
    const entryPath =
      paths.find((path) => path === "/") ??
      paths.find((path) => !path.includes("["));
    if (!entryPath) {
      throw new BadRequestError(
        "A template needs a preview page with a fixed URL",
      );
    }
    const { pkgVersion } = await mgr.publishProject(
      template.projectId,
      undefined,
      [],
      "",
      revision.revision,
    );
    return {
      previousVersion: template.published?.version,
      version: pkgVersion.version,
      entryPath,
      libraries: [...new Set(site.projectDependencies.map((dep) => dep.name))],
    };
  });
  const record = await maintain(
    req,
    async (em, template) => {
      const mgr = new DbMgr(em, SUPER_USER);
      const pkg = await mgr.getPkgByProjectId(template.projectId);
      if (
        template.published?.version !== prepared.previousVersion ||
        !pkg ||
        (await mgr.getLatestPkgVersionNumber(pkg.id, undefined)) !==
          prepared.version
      ) {
        throw new BadRequestError(
          "The template changed during publication. Review it and publish again.",
        );
      }
      const publication = serializePreviewPublication(
        await publishWebsiteSnapshot(
          mgr,
          req,
          template.projectId,
          prepared.entryPath,
          prepared.version,
        ),
      );
      template.published = {
        version: publication.version,
        publishedAt: publication.publishedAt,
        previewUrl: publication.url,
        libraries: prepared.libraries,
      };
    },
    req.noTxMgr,
  );
  res.json({ template: serialize(record, true) });
}

export async function unpublishDesignTemplate(req: Request, res: Response) {
  const record = await maintain(req, async (em, template) => {
    template.published = null;
    await em.update(
      PreviewPublication,
      { projectId: template.projectId },
      { enabled: false, bundle: null },
    );
  });
  res.json({ template: serialize(record, true) });
}

export async function deleteDesignTemplate(req: Request, res: Response) {
  await maintain(req, async (em, template) => {
    if (template.published) {
      throw new BadRequestError("Unpublish the template before deleting it");
    }
    await em.update(Project, template.projectId, {
      deletedAt: new Date(),
      deletedById: getUser(req).id,
    });
  });
  res.json({});
}
