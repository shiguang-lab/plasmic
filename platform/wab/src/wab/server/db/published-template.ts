import type { DbMgr } from "@/wab/server/db/DbMgr";
import { DesignTemplate } from "@/wab/server/entities/CustomEntities";
import { Project } from "@/wab/server/entities/Entities";
import { NotFoundError } from "@/wab/shared/ApiErrors/errors";
import type { EntityManager } from "typeorm";

export async function findTemplate(em: EntityManager, id: string) {
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

export async function getPublishedTemplateVersion(mgr: DbMgr, templateId: string) {
  const record = await findTemplate(mgr.getEntMgr(), templateId);
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
  return { record, published, version };
}
