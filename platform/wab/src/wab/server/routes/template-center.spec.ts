import { withDb } from "@/wab/server/__testonly__/backend-util";
import { DbMgr, normalActor } from "@/wab/server/db/DbMgr";
import {
  DesignTemplate,
  PreviewPublication,
} from "@/wab/server/entities/CustomEntities";
import { Project } from "@/wab/server/entities/Entities";
import { AddTemplateCenter1794873600000 } from "@/wab/server/migrations/1794873600000-AddTemplateCenter";
import {
  createDesignTemplate,
  deleteDesignTemplate,
  listDesignTemplates,
  publishDesignTemplate,
  unpublishDesignTemplate,
  updateDesignTemplate,
} from "@/wab/server/routes/template-center";
import { Bundler } from "@/wab/shared/bundler";
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
    await publishDesignTemplate(req, response());
    const initial = await em.findOneOrFail(DesignTemplate, { projectId: id });
    expect(initial.published?.name).toBe("登录页");
    req.body = { ...req.body, name: "登录页新草稿" };
    await updateDesignTemplate(req, response());
    const listing = response();
    await listDesignTemplates(
      { ...req, shiguangIdentity: { roles: [] } },
      listing,
    );
    expect(listing.json.mock.calls[0][0].templates).toEqual([
      { id, published: initial.published },
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
    expect(
      (await em.findOneOrFail(DesignTemplate, { projectId: id })).published
        ?.name,
    ).toBe("登录页新草稿");
    await unpublishDesignTemplate(req, response());
    expect(
      (await em.findOneOrFail(PreviewPublication, { projectId: id })).enabled,
    ).toBe(false);
    await deleteDesignTemplate(req, response());
    const removed = response();
    await listDesignTemplates(req, removed);
    expect(removed.json.mock.calls[0][0].templates).toEqual([]);
  }));

it("applies and reverses the migration without changing business projects", () =>
  withDb(async (_sudo, _users, _dbs, project, em) => {
    const migration = new AddTemplateCenter1794873600000();
    const runner = em.queryRunner;
    if (!runner) {
      throw new Error("Expected transaction runner");
    }
    await migration.down(runner);
    await migration.up(runner);
    expect((await em.findOneOrFail(Project, project.id)).isTemplate).toBe(
      false,
    );
    expect(await em.count(DesignTemplate)).toBe(0);
  }));
