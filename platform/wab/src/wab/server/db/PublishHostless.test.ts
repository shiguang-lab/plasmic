import { afterEach, beforeEach, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  changed: true,
  removedParams: {} as Record<string, string[]>,
  site: {},
  save: vi.fn(),
  publish: vi.fn(),
  externalize: vi.fn(),
}));

vi.mock("@/wab/server/code-components/code-components", () => ({
  updateHostlessPackage: async () => state.removedParams,
}));
vi.mock("@/wab/server/config", () => ({ DEFAULT_DATABASE_URI: "fixture" }));
vi.mock("@/wab/server/db/BundleMigrator", () => ({
  getLastBundleVersion: async () => "test",
  getMigratedBundle: async () => ({ revision: 1 }),
}));
vi.mock("@/wab/server/db/DbCon", () => ({}));
vi.mock("@/wab/server/db/DbMgr", () => ({ DbMgr: class {}, SUPER_USER: {} }));
vi.mock("@/wab/server/db/bundle-migration-utils", () => ({
  unbundleSite: async () => ({ siteOrProjectDep: { site: state.site } }),
}));
vi.mock("@/wab/server/observability", () => ({
  logger: () => ({ info: vi.fn(), error: vi.fn() }),
}));
vi.mock("@/wab/server/workers/worker-utils", () => ({}));
vi.mock("@/wab/shared/bundler", () => ({
  Bundler: class {
    bundle() {
      return { revision: state.changed ? 2 : 1 };
    }
  },
}));
vi.mock("@/wab/shared/devflags", () => ({ DEVFLAGS: {} }));
vi.mock("@/wab/shared/model/classes", () => ({
  ensureKnownProjectDependency: (value: unknown) => value,
}));
vi.mock("@/wab/shared/site-invariants", () => ({ assertSiteInvariants: vi.fn() }));
vi.mock("@/wab/server/entities/CustomEntities", () => ({ HostlessLibraryVersion: class {} }));
vi.mock("@/wab/server/loader/library-artifacts", () => ({
  captureLibraryArtifact: async () => ({ digest: "new-code" }),
}));
vi.mock("@/wab/server/loader/library-thumbnails", () => ({
  externalizeSiteThumbnails: state.externalize,
}));

import { publishHostlessProject } from "@/wab/server/db/PublishHostless";

const db = {
  getProjectById: async () => ({ name: "React UI" }),
  getPkgByProjectId: async () => ({ id: "pkg" }),
  getPkgVersion: async () => ({ id: "version", version: "1.2.0" }),
  getLatestProjectRev: async () => ({ revision: 3 }),
  getEntMgr: () => ({
    findOne: async () => ({ artifact: { digest: "old-code" } }),
  }),
  saveProjectRev: state.save,
  publishProject: state.publish,
};

beforeEach(() => {
  vi.stubEnv("PREVIEW_ORIGIN", "");
  state.changed = true;
  state.removedParams = {};
  state.save.mockReset();
  state.publish.mockReset();
  state.externalize.mockReset().mockResolvedValue(undefined);
});
afterEach(() => vi.unstubAllEnvs());

it.each([
  { breaking: false, removed: false, expected: "1.3.0" },
  { breaking: true, removed: false, expected: "2.0.0" },
  { breaking: false, removed: true, expected: "2.0.0" },
])("publishes $expected for breaking=$breaking, removed=$removed", async ({ breaking, removed, expected }) => {
  state.removedParams = removed ? { ActionGroup: ["oldProp"] } : {};
  expect(await publishHostlessProject(db as any, "project" as any, {
    plumeSite: state.site as any,
    breaking,
  })).toBe(true);
  expect(state.publish).toHaveBeenCalledExactlyOnceWith("project", expected, [], "");
});

it("does not republish an unchanged library when a breaking flag is repeated", async () => {
  state.changed = false;
  expect(await publishHostlessProject(db as any, "project" as any, {
    plumeSite: state.site as any,
    breaking: true,
  })).toBe(false);
  expect(state.save).not.toHaveBeenCalled();
  expect(state.publish).not.toHaveBeenCalled();
});

it("can publish a breaking code-only change without a top-level parameter removal", async () => {
  state.changed = false;
  vi.stubEnv("PREVIEW_ORIGIN", "https://preview.example.test");
  expect(await publishHostlessProject(db as any, "project" as any, {
    plumeSite: state.site as any,
    breaking: true,
  })).toBe(true);
  expect(state.publish).toHaveBeenCalledExactlyOnceWith("project", "2.0.0", [], "");
  expect(state.externalize).toHaveBeenCalledTimes(2);
});

it("does not save or publish a library whose thumbnail resources cannot be prepared", async () => {
  vi.stubEnv("PREVIEW_ORIGIN", "https://preview.example.test");
  state.externalize.mockRejectedValue(new Error("thumbnail unavailable"));
  await expect(publishHostlessProject(db as any, "project" as any, { plumeSite: state.site as any })).rejects.toThrow("thumbnail unavailable");
  expect(state.save).not.toHaveBeenCalled();
  expect(state.publish).not.toHaveBeenCalled();
});
