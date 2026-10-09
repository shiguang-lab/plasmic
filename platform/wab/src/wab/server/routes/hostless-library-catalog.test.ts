import { expect, it, vi } from "vitest";

const state = vi.hoisted(() => {
  let close: () => void;
  const finished = new Promise<void>((resolve) => { close = resolve; });
  return { flags: { hostLessComponents: ["antd5", "antd6", "overseas"].map((codeName) => ({ codeName, projectId: [`${codeName}-project`] })) } as any, close: () => close(), finished };
});
vi.mock("@/wab/server/entities/CustomEntities", () => ({ HostlessLibraryVersion: class {} }));
vi.mock("@/wab/server/config", () => ({ loadConfig: () => ({ databaseUri: "fixture" }) }));
vi.mock("@/wab/shared/devflags", () => ({ DEVFLAGS: { hostLessComponents: [] } }));
vi.mock("@/wab/shared/bundler", () => ({ Bundler: class {} }));
vi.mock("@/wab/shared/model/classes", () => ({ HostLessPackageInfo: class {} }));
vi.mock("@/wab/server/db/PublishHostless", () => ({ publishHostlessProject: async () => false }));
vi.mock("@/wab/server/db/DbBundleLoader", () => ({
  unbundlePkgVersion: async (_db: any, _bundler: any, version: any) => ({
    version: "1.0.0", projectId: `${version.id.split("@")[0]}-project`,
    site: { components: [{ name: "Button", codeComponentMeta: { displayName: "Button" } }] },
  }),
}));
const manager = vi.hoisted(() => ({
  findOne: async (_entity: any, where: any) => where.pkgVersionId.startsWith("overseas")
    ? undefined : { artifact: { canvas: "versioned-registration" } },
}));
const db = vi.hoisted(() => ({
  tryGetDevFlagOverrides: async () => ({ data: JSON.stringify(state.flags) }),
  setDevFlagOverrides: async (data: string) => { state.flags = JSON.parse(data); },
  getPkgByProjectId: async (id: string) => ({ id: id.replace("-project", "") }),
  getPkgVersion: async (id: string) => ({ id: `${id}@1.0.0`, version: "1.0.0" }),
  updateProject: async () => undefined,
  checkProjectPerms: async () => undefined,
  getEntMgr: () => manager,
}));
vi.mock("@/wab/server/db/DbMgr", () => ({ DbMgr: class { constructor() { return db; } }, SUPER_USER: {} }));
vi.mock("@/wab/server/db/DbCon", () => ({ ensureDbConnection: async () => ({
  transaction: async (callback: any) => callback(manager), close: state.close,
}) }));
vi.mock("@/wab/server/routes/util", () => ({ userDbMgr: () => db }));

import { getHostlessLibraryCanvas } from "@/wab/server/routes/hostless-library-artifacts";

it("keeps versioned registration downloadable after NAS catalog rebuilding and only marks stored artifacts", async () => {
  await import("../../../../../../deploy/nas-antd6");
  await state.finished;
  const entries = state.flags.hostLessComponents;
  expect(entries.filter((entry: any) => entry.codeName === "antd6")).toHaveLength(2);
  expect(entries.filter((entry: any) => entry.codeName === "antd6").every((entry: any) => entry.hasCodeArtifacts)).toBe(true);
  expect(entries.filter((entry: any) => entry.codeName === "overseas").every((entry: any) => entry.hasCodeArtifacts === false)).toBe(true);
  const res = { setHeader: vi.fn(), send: vi.fn() };
  await getHostlessLibraryCanvas({ params: { name: "antd6" }, query: { version: "1.0.0" } } as any, res as any);
  expect(res.send).toHaveBeenCalledWith("versioned-registration");
  await expect(getHostlessLibraryCanvas({ params: { name: "overseas" }, query: { version: "1.0.0" } } as any, res as any)).rejects.toThrow("Component library not found");
});
