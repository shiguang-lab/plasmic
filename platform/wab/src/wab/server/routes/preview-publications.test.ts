import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  record: undefined as any,
  version: "1.0.0",
  pkg: { id: "pkg" } as { id: string } | undefined,
  generate: vi.fn(),
  perms: vi.fn(),
}));
vi.mock("@/wab/server/entities/CustomEntities", () => ({
  PreviewPublication: class {},
}));
vi.mock("@/wab/server/loader/gen-code-bundle", () => ({
  genPublishedLoaderCodeBundle: state.generate,
  LATEST_LOADER_VERSION: 10,
}));
vi.mock("@/wab/server/loader/project-library-artifacts", () => ({
  getProjectLibraryArtifacts: async () => [],
}));
vi.mock("@/wab/server/db/DbMgr", () => ({
  DbMgr: class {
    getProjectById = async () => ({ id: "project" });
    getPkgByProjectId = async () => state.pkg;
    getLatestPkgVersionNumber = async () => state.version;
  },
}));
vi.mock("@/wab/server/routes/util", () => {
  const em = {
    query: vi.fn(),
    findOne: async () => state.record,
    create: (_entity: any, values: any) => values,
    save: async (values: any) => {
      state.record = values;
    },
    update: async (_entity: any, _where: any, values: any) => {
      state.record = { ...state.record, ...values };
    },
    transaction: async (callback: any) => {
      const previous = state.record;
      try {
        return await callback(em);
      } catch (error) {
        state.record = previous;
        throw error;
      }
    },
  };
  return {
    userDbMgr: () => ({
      checkProjectPerms: state.perms,
      getEntMgr: () => em,
      actor: {},
      opts: {},
    }),
  };
});

import {
  getPreviewPublication,
  publishPreviewPublication,
  unpublishPreviewPublication,
} from "@/wab/server/routes/preview-publications";

const req = (entryPath?: string) =>
  ({
    params: { projectId: "project" },
    body: { entryPath },
    workerpool: {},
  }) as any;
const res = () => ({ json: vi.fn() }) as any;
const bundle = (paths = ["/groups", "/detail/[id]"]) => ({
  modules: { browser: [], server: [] },
  projects: [],
  components: paths.map((path) => ({
    id: path,
    projectId: "project",
    displayName: path,
    path,
    isPage: true,
    isCode: false,
  })),
});

beforeEach(() => {
  process.env.PREVIEW_ORIGIN = "https://preview.plasmic.shiguanglab.com";
  state.record = undefined;
  state.pkg = { id: "pkg" };
  state.version = "1.0.0";
  state.perms.mockReset();
  state.generate.mockReset().mockResolvedValue(bundle());
});

describe("website publication lifecycle", () => {
  it("pins the published version, keeps a stable short link and exposes metadata only", async () => {
    const response = res();
    await publishPreviewPublication(req(), response);
    const first = response.json.mock.calls[0][0].publication;
    expect(first.url).toMatch(
      /^https:\/\/preview\.plasmic\.shiguanglab\.com\/s\/[\w-]{10}$/,
    );
    expect(first.entryPath).toBe("/groups");
    expect(first.bundle).toBeUndefined();
    expect(state.generate.mock.calls[0][2]).toMatchObject({
      browserOnly: true,
      platform: "nextjs",
      projectVersions: { project: { version: "1.0.0", indirect: false } },
    });
    state.version = "1.1.0";
    await publishPreviewPublication(req("/groups"), res());
    expect(state.record.code).toBe(first.code);
    expect(state.record.version).toBe("1.1.0");
    const read = res();
    await getPreviewPublication(req(), read);
    expect(read.json.mock.calls[0][0].publication.bundle).toBeUndefined();
  });
  it("unpublishes by removing the public bundle, then reuses the same short link", async () => {
    await publishPreviewPublication(req(), res());
    const code = state.record.code;
    await unpublishPreviewPublication(req(), res());
    expect(state.record).toMatchObject({ enabled: false, bundle: null });
    await publishPreviewPublication(req(), res());
    expect(state.record).toMatchObject({ enabled: true, code });
  });
  it("requires editor permission before generating or modifying a website", async () => {
    state.perms.mockRejectedValue(new Error("Forbidden"));
    await expect(publishPreviewPublication(req(), res())).rejects.toThrow(
      "Forbidden",
    );
    await expect(unpublishPreviewPublication(req(), res())).rejects.toThrow(
      "Forbidden",
    );
    expect(state.generate).not.toHaveBeenCalled();
    expect(state.record).toBeUndefined();
    expect(state.perms).toHaveBeenCalledWith(
      "project",
      "editor",
      "publish website",
    );
  });
  it("preserves the last working publication when generation fails", async () => {
    await publishPreviewPublication(req(), res());
    const previous = state.record;
    state.generate.mockRejectedValue(new Error("Code generation failed"));
    await expect(publishPreviewPublication(req(), res())).rejects.toThrow(
      "Code generation failed",
    );
    expect(state.record).toBe(previous);
  });
  it("rejects unpublished projects, invalid entry pages and unavailable custom components", async () => {
    state.pkg = undefined;
    await expect(publishPreviewPublication(req(), res())).rejects.toThrow(
      "Publish a project version",
    );
    state.pkg = { id: "pkg" };
    await expect(
      publishPreviewPublication(req("/detail/[id]"), res()),
    ).rejects.toThrow("fixed URL");
    await expect(
      publishPreviewPublication(req("/missing"), res()),
    ).rejects.toThrow("fixed URL");
    state.generate.mockResolvedValue({
      ...bundle(),
      components: [...bundle().components, { isCode: true }],
    });
    await expect(publishPreviewPublication(req(), res())).rejects.toThrow(
      "custom code components",
    );
    expect(state.record).toBeUndefined();
  });
});
