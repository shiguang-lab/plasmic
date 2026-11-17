import {
  createDesignTemplate,
  deleteDesignTemplate,
  listDesignTemplates,
  publishDesignTemplate,
  unpublishDesignTemplate,
  updateDesignTemplate,
} from "@/wab/server/routes/template-center";
import { beforeEach, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  record: undefined as any,
  preview: undefined as any,
  deleted: false,
  version: 0,
  snapshot: vi.fn(),
  queries: [] as string[],
  em: undefined as any,
}));
vi.mock("@/wab/server/entities/CustomEntities", () => ({
  DesignTemplate: class {},
  PreviewPublication: class {},
}));
vi.mock("@/wab/server/entities/Entities", () => ({ Project: class {} }));
vi.mock("@/wab/server/db/DbBundleLoader", () => ({
  unbundleProjectFromData: async () => ({
    components: [{ pageMeta: { path: "/" } }],
    projectDependencies: [{ name: "Material UI" }],
  }),
}));
vi.mock("@/wab/server/db/DbMgr", () => ({
  SUPER_USER: {},
  DbMgr: class {
    constructor(private em: any) {}
    getEntMgr = () => this.em;
    getLatestProjectRev = async () => ({ revision: 3 });
    publishProject = async () => ({
      pkgVersion: { version: `1.0.${++state.version}` },
    });
    getPkgByProjectId = async () => ({ id: "pkg" });
    getLatestPkgVersionNumber = async () => `1.0.${state.version}`;
    createProjectAndSaveRev = async () => ({ project: { id: "template" } });
  },
}));
vi.mock("@/wab/server/routes/preview-publications", () => ({
  publishWebsiteSnapshot: state.snapshot,
  serializePreviewPublication: (value: any) => value,
}));
vi.mock("@/wab/server/routes/util", async () => {
  const { UnauthorizedError } = await import("@/wab/shared/ApiErrors/errors");
  return {
    getUser: (req: any) => {
      if (!req.user) {
        throw new UnauthorizedError();
      }
      return req.user;
    },
    superDbMgr: () => ({ getEntMgr: () => state.em }),
  };
});
const draft = {
  name: "登录页",
  description: "手机号登录",
  kind: "page",
  device: "mobile",
  category: "登录",
  thumbnailUrl: "",
};
const req = (admin = true, body = draft) =>
  ({
    user: { id: "user" },
    shiguangIdentity: { roles: admin ? ["system-admin"] : [] },
    body,
    params: { templateId: "template" },
    noTxMgr: state.em,
  }) as any;
const res = () => ({ json: vi.fn(), setHeader: vi.fn() }) as any;

beforeEach(() => {
  state.record = {
    projectId: "template",
    draft: { ...draft },
    published: null,
    updatedAt: new Date(0),
  };
  state.preview = undefined;
  state.deleted = false;
  state.version = 0;
  state.queries = [];
  state.snapshot
    .mockReset()
    .mockImplementation(async (_mgr, _req, _id, _path, version) => {
      state.preview = {
        version,
        url: "https://preview.test/s/reference",
        publishedAt: new Date().toISOString(),
      };
      return state.preview;
    });
  state.em = {
    query: vi.fn(),
    getRepository: () => ({
      createQueryBuilder: () => {
        let publishedOnly = false;
        const qb = {
          innerJoin: () => qb,
          where: () => qb,
          orderBy: () => qb,
          andWhere: (sql: string) => {
            state.queries.push(sql);
            publishedOnly ||= sql.includes("template.published IS NOT NULL");
            return qb;
          },
          getOne: async () => (state.deleted ? undefined : state.record),
          getMany: async () =>
            state.deleted || (publishedOnly && !state.record.published)
              ? []
              : [state.record],
        };
        return qb;
      },
    }),
    create: (_entity: any, value: any) => value,
    save: async (value: any) => {
      state.record = value;
      return value;
    },
    update: async (_entity: any, _id: any, values: any) => {
      if (values.deletedAt) {
        state.deleted = true;
      }
      if (values.enabled === false) {
        state.preview = null;
      }
    },
    transaction: async (fn: any) => {
      const before = structuredClone({
        record: state.record,
        preview: state.preview,
        deleted: state.deleted,
      });
      try {
        return await fn(state.em);
      } catch (err) {
        Object.assign(state, before);
        throw err;
      }
    },
  };
});

it.each([
  createDesignTemplate,
  updateDesignTemplate,
  publishDesignTemplate,
  unpublishDesignTemplate,
  deleteDesignTemplate,
])("blocks non-admin maintenance before any mutation: %s", async (action) => {
  await expect(action(req(false), res())).rejects.toMatchObject({
    name: "ForbiddenError",
  });
  expect(state.em.query).not.toHaveBeenCalled();
  expect(state.snapshot).not.toHaveBeenCalled();
});
it("requires login even to list published references", async () => {
  await expect(
    listDesignTemplates({ ...req(false), user: undefined }, res()),
  ).rejects.toMatchObject({ name: "UnauthorizedError" });
});
it("hides drafts, publishes a snapshot, and keeps it unchanged when metadata is edited", async () => {
  const before = res();
  await listDesignTemplates(req(false), before);
  expect(before.json.mock.calls[0][0]).toEqual({
    templates: [],
    canManage: false,
  });
  await publishDesignTemplate(req(), res());
  const published = structuredClone(state.record.published);
  await updateDesignTemplate(req(true, { ...draft, name: "新草稿" }), res());
  const reader = res();
  await listDesignTemplates(req(false), reader);
  expect(reader.json.mock.calls[0][0]).toEqual({
    templates: [{ id: "template", published }],
    canManage: false,
  });
  expect(published).toMatchObject({
    name: "登录页",
    version: "1.0.1",
    libraries: ["Material UI"],
  });
  const admin = res();
  await listDesignTemplates(req(), admin);
  expect(admin.json.mock.calls[0][0].templates[0].draft.name).toBe("新草稿");
  await publishDesignTemplate(req(), res());
  expect(state.record.published).toMatchObject({
    name: "新草稿",
    version: "1.0.2",
  });
  expect(state.snapshot.mock.calls[1][4]).toBe("1.0.2");
});
it("keeps the previous reference available if code generation fails", async () => {
  await publishDesignTemplate(req(), res());
  const before = structuredClone({
    published: state.record.published,
    preview: state.preview,
  });
  state.snapshot.mockRejectedValue(new Error("Code generation failed"));
  await expect(publishDesignTemplate(req(), res())).rejects.toThrow(
    "Code generation failed",
  );
  expect(state.record.published).toEqual(before.published);
  expect(state.preview).toEqual(before.preview);
});
it("unpublishes the reference and requires unpublishing before deletion", async () => {
  await publishDesignTemplate(req(), res());
  await expect(deleteDesignTemplate(req(), res())).rejects.toThrow("Unpublish");
  await unpublishDesignTemplate(req(), res());
  expect(state.preview).toBeNull();
  const reader = res();
  await listDesignTemplates(req(false), reader);
  expect(reader.json.mock.calls[0][0].templates).toEqual([]);
  await deleteDesignTemplate(req(), res());
  expect(state.deleted).toBe(true);
});
it("rejects invalid metadata instead of persisting arbitrary fields or URL schemes", async () => {
  for (const body of [
    { ...draft, name: " " },
    { ...draft, kind: "project" },
    { ...draft, thumbnailUrl: "javascript:alert(1)" },
    { ...draft, published: {} },
  ]) {
    await expect(
      updateDesignTemplate(req(true, body as any), res()),
    ).rejects.toMatchObject({ name: "BadRequestError" });
  }
  expect(state.record.draft).toEqual(draft);
});
