import { withDb } from "@/wab/server/__testonly__/backend-util";
import { getLastBundleVersion } from "@/wab/server/db/BundleMigrator";
import { unbundleProjectFromData } from "@/wab/server/db/DbBundleLoader";
import { DbMgr, normalActor } from "@/wab/server/db/DbMgr";
import {
  DesignTemplate,
  PreviewPublication,
} from "@/wab/server/entities/CustomEntities";
import { Project } from "@/wab/server/entities/Entities";
import { AddTemplateCenter1794873600000 } from "@/wab/server/migrations/1794873600000-AddTemplateCenter";
import { SeparateTemplateMetadata1794960000000 } from "@/wab/server/migrations/1794960000000-SeparateTemplateMetadata";
import {
  createDesignTemplate,
  deleteDesignTemplate,
  getPublishedDesignTemplateStudio,
  listDesignTemplates,
  publishDesignTemplate,
  unpublishDesignTemplate,
  updateDesignTemplate,
} from "@/wab/server/routes/template-center";
import { Bundler, FastBundler } from "@/wab/shared/bundler";
import { getBundle } from "@/wab/shared/bundles";
import { unbundleSite } from "@/wab/shared/core/tagged-unbundle";
import { ComponentType } from "@/wab/shared/core/components";
import { TplMgr } from "@/wab/shared/TplMgr";
import { expect, it, vi } from "vitest";

const generation = vi.hoisted(() => ({ fail: false }));
vi.mock("@/wab/server/routes/preview-publications", () => ({
  publishWebsiteSnapshot: async (
    mgr: DbMgr,
    _req: unknown,
    projectId: string,
    _path: unknown,
    version: string,
  ) => {
    if (generation.fail) {
      throw new Error("Generation failed");
    }
    const em = mgr.getEntMgr();
    const previous = await em.findOne(PreviewPublication, { projectId });
    const snapshot = em.create(PreviewPublication, {
      projectId,
      code: previous?.code ?? "reference1",
      enabled: true,
      version,
      entryPath: "/",
      pages: [],
      bundle: null,
      publishedAt: new Date(),
    });
    await em.save(snapshot);
    return snapshot;
  },
  serializePreviewPublication: (snapshot: PreviewPublication) => ({
    ...snapshot,
    publishedAt: snapshot.publishedAt.toISOString(),
    url: "https://preview.test/s/reference1",
  }),
}));

it("persists isolated template canvases and atomic publications in PostgreSQL", () =>
  withDb(async (sudo, users, dbs, _project, em) => {
    const user = users[0];
    const req = {
      user,
      shiguangIdentity: { roles: ["system-admin"] },
      txMgr: em,
      noTxMgr: em,
      cookies: {},
      headers: {},
      bundler: new Bundler(),
      body: {
        name: "登录页",
        description: "移动端登录",
        kind: "page",
        device: "mobile",
        category: "登录",
        thumbnailUrl: "",
      },
      params: {} as Record<string, string>,
    } as any;
    const response = () => ({ json: vi.fn(), setHeader: vi.fn() }) as any;
    const created = response();
    await createDesignTemplate(req, created);
    const id = created.json.mock.calls[0][0].template.id;
    req.params.templateId = id;
    const project = await em.findOneOrFail(Project, id);
    expect(project).toMatchObject({
      isTemplate: true,
      workspaceId: null,
      createdById: user.id,
    });
    expect(
      (await sudo.listAllProjects()).some((value) => value.id === id),
    ).toBe(false);
    expect(
      (await dbs[0]().listProjectsForSelf()).some((value) => value.id === id),
    ).toBe(false);
    const reader = new DbMgr(em, normalActor(user.id));
    await expect(reader.getProjectById(id)).rejects.toMatchObject({
      name: "ForbiddenError",
    });
    await expect(reader.getProjectsById([id])).rejects.toMatchObject({
      name: "ForbiddenError",
    });
    const admin = new DbMgr(em, normalActor(users[1].id, false, true));
    await expect(admin.getProjectById(id)).resolves.toMatchObject({ id });
    const readerReq = { ...req, user: users[1], shiguangIdentity: { roles: [] } };
    await expect(getPublishedDesignTemplateStudio({ ...readerReq, user: undefined }, response()))
      .rejects.toMatchObject({ name: "UnauthorizedError" });
    await expect(getPublishedDesignTemplateStudio(readerReq, response()))
      .rejects.toMatchObject({ name: "NotFoundError" });
    const bundleVersion = await getLastBundleVersion();
    const addPage = async (name: string, path: string) => {
      const bundler = new Bundler();
      const rev = await sudo.getLatestProjectRev(id);
      const site = await unbundleProjectFromData(sudo, bundler, rev);
      new TplMgr({ site }).addComponent({ name, type: ComponentType.Page, pageMeta: { path } });
      return admin.saveProjectRev({
        projectId: id,
        revisionNum: rev.revision + 1,
        data: JSON.stringify(bundler.bundle(site, id, bundleVersion)),
      });
    };
    await addPage("Standalone calculator", "/calculator");
    await publishDesignTemplate(req, response());
    const initial = await em.findOneOrFail(DesignTemplate, { projectId: id });
    const initialPreview = await em.findOneOrFail(PreviewPublication, { projectId: id });
    expect(initial.metadata.name).toBe("登录页");
    req.body = { ...req.body, name: "新模板名称" };
    await updateDesignTemplate(req, response());
    expect(await em.findOneOrFail(PreviewPublication, { projectId: id })).toEqual(initialPreview);
    const draftRev = await addPage("Draft only", "/draft");
    await expect(reader.saveProjectRev({ projectId: id, revisionNum: draftRev.revision + 1, data: draftRev.data }))
      .rejects.toMatchObject({ name: "ForbiddenError" });
    const studio = response();
    await getPublishedDesignTemplateStudio(readerReq, studio);
    const { project: snapshot, rev, depPkgs } = studio.json.mock.calls[0][0];
    expect(snapshot).toMatchObject({ name: "新模板名称", publishedTemplateVersion: initial.published?.version, projectApiToken: null });
    const { site } = unbundleSite(new FastBundler(), id, getBundle(rev, bundleVersion), depPkgs);
    expect(site.components.map((page) => page.pageMeta?.path)).toEqual(["/", "/calculator"]);
    const listing = response();
    await listDesignTemplates(
      { ...req, shiguangIdentity: { roles: [] } },
      listing,
    );
    expect(listing.json.mock.calls[0][0].templates).toEqual([
      { id, metadata: req.body, published: initial.published },
    ]);
    generation.fail = true;
    await expect(publishDesignTemplate(req, response())).rejects.toThrow(
      "Generation failed",
    );
    expect(
      (await em.findOneOrFail(DesignTemplate, { projectId: id })).published,
    ).toEqual(initial.published);
    generation.fail = false;
    await publishDesignTemplate(req, response());
    const republished = await em.findOneOrFail(DesignTemplate, { projectId: id });
    expect(republished.metadata).toEqual(req.body);
    expect(republished.published?.version).not.toBe(initial.published?.version);
    await unpublishDesignTemplate(req, response());
    await expect(getPublishedDesignTemplateStudio(readerReq, response()))
      .rejects.toMatchObject({ name: "NotFoundError" });
    expect(
      (await em.findOneOrFail(PreviewPublication, { projectId: id })).enabled,
    ).toBe(false);
    await deleteDesignTemplate(req, response());
    const removed = response();
    await listDesignTemplates(req, removed);
    expect(removed.json.mock.calls[0][0].templates).toEqual([]);
  }));

it("migrates saved metadata and keeps the existing canvas publication", () =>
  withDb(async (sudo, _users, _dbs, project, em) => {
    const originalMigration = new AddTemplateCenter1794873600000();
    const migration = new SeparateTemplateMetadata1794960000000();
    const runner = em.queryRunner;
    if (!runner) {
      throw new Error("Expected transaction runner");
    }
    await originalMigration.down(runner);
    await originalMigration.up(runner);
    const { project: template } = await sudo.createProject({ name: "New name" });
    await em.update(Project, template.id, { isTemplate: true });
    const metadata = {
      name: "New name",
      description: "New description",
      kind: "page",
      device: "mobile",
      category: "New category",
      thumbnailUrl: "https://images.test/new.png",
    };
    const published = {
      version: "1.2.3",
      publishedAt: "2026-11-17T00:00:00.000Z",
      previewUrl: "https://preview.test/s/reference1",
      libraries: ["Material UI"],
    };
    await runner.query(
      `INSERT INTO "design_template" ("projectId", "draft", "published", "updatedAt") VALUES ($1, $2, $3, now())`,
      [template.id, metadata, { ...metadata, name: "Old name", ...published }],
    );
    await migration.up(runner);
    const migrated = await em.findOneOrFail(DesignTemplate, { projectId: template.id });
    expect(migrated.metadata).toEqual(metadata);
    expect(migrated.published).toEqual(published);
    expect((await em.findOneOrFail(Project, project.id)).isTemplate).toBe(
      false,
    );
    await migration.down(runner);
    expect(await runner.query(`SELECT "draft", "published" FROM "design_template"`))
      .toEqual([{ draft: metadata, published: { ...metadata, ...published } }]);
    await migration.up(runner);
  }));
