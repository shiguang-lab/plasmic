import { createDatabase } from "@/wab/server/__testonly__/backend-util";
import { createTestUser } from "@/wab/server/__testonly__/shiguang-fixture";
import { getLastBundleVersion } from "@/wab/server/db/BundleMigrator";
import { DbMgr, SUPER_USER, normalActor } from "@/wab/server/db/DbMgr";
import { saveProjectRev } from "@/wab/server/routes/projects";
import { FastBundler } from "@/wab/shared/bundler";
import { createSite } from "@/wab/shared/core/sites";
import { modelSchemaHash } from "@/wab/shared/model/classes-metas";
import type { Request, Response } from "express-serve-static-core";

vi.mock("@/wab/server/socket-util", async (importOriginal) => ({
  ...(await importOriginal()),
  broadcastProjectsMessage: vi.fn(),
}));

it("persists and broadcasts an incremental save without reparsing its merged bundle", async () => {
  const db = await createDatabase();
  try {
    const sudo = new DbMgr(db.con.manager, SUPER_USER);
    const user = await createTestUser(sudo, { email: "incremental-save@test.com" });
    const mgr = new DbMgr(db.con.manager, normalActor(user.id));
    const { project } = await mgr.createProject({ name: "Incremental save" });
    const version = await getLastBundleVersion();
    const site = createSite();
    const bundle = new FastBundler().bundle(site, project.id, version);
    const previous = await mgr.getLatestProjectRev(project.id);
    await mgr.saveProjectRev({ projectId: project.id, data: JSON.stringify(bundle), revisionNum: previous.revision + 1 });
    const revision = previous.revision + 2;
    const flags = { ...site.flags, usePlasmicImg: false };
    const partial = { ...bundle, map: { [bundle.root]: { __type: "Site", flags } } };
    const [{ version: modelVersion }] = await db.con.query('SELECT COALESCE(MAX(id), -1) AS version FROM migrations');
    const req = {
      con: db.con, noTxMgr: db.con.manager, user, cookies: {}, headers: {},
      params: { projectBranchId: project.id, revision: String(revision) },
      body: {
        model: JSON.stringify(partial), incremental: true,
        modelSchemaHash, modelVersion,
        hostlessDataVersion: (await mgr.getHostlessVersion()).versionCount,
        toDeleteIids: [], modifiedComponentIids: ["changed-component"],
      },
      analytics: { track: vi.fn() }, promLabels: {},
    } as unknown as Request;
    const res = { json: vi.fn() } as unknown as Response;
    const originalParse = JSON.parse;
    const bundleParses: string[] = [];
    vi.spyOn(JSON, "parse").mockImplementation((input, reviver) => {
      if (new Error().stack?.includes("parseBundle")) {
        bundleParses.push(input);
      }
      return originalParse(input, reviver);
    });
    await saveProjectRev(req, res);
    vi.restoreAllMocks();
    const saved = await mgr.getLatestProjectRev(project.id);
    expect(saved.revision).toBe(revision);
    // Entity JSON validation stays enabled; the bundle parser must not parse
    // the already merged full payload again to construct the partial revision.
    expect(bundleParses.filter((input) => input === saved.data)).toHaveLength(0);
    const readback = JSON.parse(saved.data);
    expect(readback.map[bundle.root].flags).toEqual(flags);
    expect(readback.deps).toEqual(bundle.deps);
    expect(readback.version).toBe(version);
    const [change] = await db.con.query('SELECT data, "deletedIids", "modifiedComponentIids" FROM partial_revision_cache WHERE "projectId"=$1 AND revision=$2', [project.id, revision]);
    expect(JSON.parse(change.data)).toEqual({ ...bundle, map: { [bundle.root]: { __type: "Site", flags } } });
    expect(JSON.parse(change.deletedIids)).toEqual([]);
    expect(change.modifiedComponentIids).toEqual(["changed-component"]);
    expect(res.json).toHaveBeenCalledWith({ rev: expect.objectContaining({ revision }) });
  } finally {
    await db.cleanup();
  }
});
