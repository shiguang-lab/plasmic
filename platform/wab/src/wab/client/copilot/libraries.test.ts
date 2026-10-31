import { fakeStudioCtx } from "@/wab/client/__testonly__/fake-init-ctx";
import { COPILOT_TOOLS } from "@/wab/client/copilot";
import * as studioBundles from "@/wab/client/components/studio/studio-bundles";
import * as scriptUtils from "@/wab/client/script-exec";
import type { TeamId } from "@/wab/shared/ApiSchema";
import type { PkgVersionInfo } from "@/wab/shared/SharedApi";
import { FastBundler, type Bundle } from "@/wab/shared/bundler";
import { mkCodeComponent } from "@/wab/shared/code-components/code-components";
import { ensure } from "@/wab/shared/common";
import { createSite } from "@/wab/shared/core/sites";
import { unbundleProjectDependency, unbundleSite } from "@/wab/shared/core/tagged-unbundle";
import { mkParam } from "@/wab/shared/core/lang";
import { flattenTpls } from "@/wab/shared/core/tpls";
import { DEVFLAGS, type HostLessPackageInfo as CatalogEntry } from "@/wab/shared/devflags";
import { HostLessPackageInfo, ProjectDependency, isKnownTplComponent } from "@/wab/shared/model/classes";
import { typeFactory } from "@/wab/shared/model/model-util";
import { makeGlobalObservable, clearGlobalObservable } from "@/wab/shared/mobx-util";
import { runInAction } from "mobx";
import { runInNewContext } from "node:vm";

function entry(codeName: string, name: string, options: Partial<CatalogEntry> = {}): CatalogEntry {
  return { type: "hostless-package", name, codeName, projectId: [`library-${codeName}`], sectionLabel: "Business components", isInstallOnly: true, items: [], ...options };
}

function dependency(codeName: string, components: { name: string; displayName: string; description?: string; isContext?: boolean }[], version = "1.1.0") {
  const site = createSite({ hostLessPackageInfo: new HostLessPackageInfo({ name: codeName, npmPkg: [`@example/${codeName}`], cssImport: [], deps: [], registerCalls: [], minimumReactVersion: "18.0.0" }) });
  for (const component of components) {
    site.components.push(mkCodeComponent(component.name, {
      ...component, importPath: `@example/${codeName}`, importName: component.displayName, props: {},
      ...(component.isContext ? { __isContext: true, globalActions: {} } : {}),
    }, {}));
  }
  return new ProjectDependency({ name: codeName, pkgId: `pkg-${codeName}`, projectId: `library-${codeName}`, version, uuid: `dep-${codeName}`, site });
}

function publication(dep: ProjectDependency): PkgVersionInfo {
  const id = `${dep.pkgId}-${dep.version}`;
  return {
    id, pkgId: dep.pkgId, version: dep.version,
    model: new FastBundler().bundle(dep, id, "test"),
    createdAt: "2026-10-28", updatedAt: "2026-10-28", deletedAt: null,
    createdById: null, updatedById: null, deletedById: null,
  };
}

function fixture(catalog: CatalogEntry[] = [], published: ProjectDependency[] = [], installed: ProjectDependency[] = []) {
  const site = createSite();
  site.projectDependencies.push(...installed);
  const result = fakeStudioCtx({ site, devFlagOverrides: { hostLessComponents: catalog } });
  const versions = new Map(published.map((dep) => [dep.pkgId, publication(dep)]));
  result.api.getPkgByProjectId.mockImplementation(async (id) => {
    const dep = published.find((library) => library.projectId === id);
    return dep ? { pkg: { id: dep.pkgId, name: dep.name, projectId: id } } : {};
  });
  result.api.getPkgVersion.mockImplementation(async (id) => ({ pkg: ensure(versions.get(id), "Missing test publication"), depPkgs: [], etag: id }));
  const call = async (name: string, input: Record<string, unknown> = {}) =>
    JSON.parse(await ensure(COPILOT_TOOLS[name], "Missing tool").execute(result.studioCtx, input));
  return { ...result, call, versions };
}

it("lists and searches icons, overseas and React UI without installing or fetching publications", async () => {
  const icons = dependency("antd-icons", [], "1.0.0");
  const { studioCtx, call, api } = fixture([
    entry("antd-icons", "Ant Design Icons", { sectionLabel: "Icons" }),
    entry("overseas", "Overseas"),
    entry("react-ui", "React UI"),
    entry("overseas", "Overseas section", { isInstallOnly: false, sectionLabel: "Other" }),
    entry("private", "Private", { hidden: true }),
    entry("old", "Old", { onlyShownIn: "old" }),
    entry("synthetic", "Synthetic", { syntheticPackage: true }),
  ], [], [icons]);
  expect((await call("listLibraries")).libraries.map((library: { name: string }) => library.name)).toEqual(["Ant Design Icons", "Overseas", "React UI"]);
  expect((await call("listLibraries", { query: "reactUI" })).libraries[0].projectIds).toEqual(["library-react-ui"]);
  expect((await call("listLibraries", { installed: true })).libraries).toMatchObject([{ codeName: "antd-icons", installedProjects: [{ projectId: icons.projectId, version: "1.0.0" }] }]);
  expect((await call("listLibraries", { installed: false })).total).toBe(2);
  const first = await call("listLibraries", { limit: 1 });
  expect(first).toMatchObject({ total: 3, nextOffset: 1 });
  expect((await call("listLibraries", { offset: first.nextOffset, limit: 2 })).nextOffset).toBeUndefined();
  for (const id of ["library-antd-icons", "library-overseas", "library-react-ui"]) {
    expect(api.getPkgByProjectId).not.toHaveBeenCalledWith(id);
  }
  expect(studioCtx.site.projectDependencies).toEqual([icons]);
});

it("keeps multi-project installation requirements and uncatalogued installed libraries discoverable", async () => {
  const installed = dependency("custom", [], "1.0.0");
  const { call } = fixture([entry("suite", "Suite", { projectId: ["library-custom", "library-other"] })], [], [installed]);
  expect((await call("listLibraries")).libraries).toMatchObject([{ projectIds: ["library-custom", "library-other"], installed: false, installedProjects: [{ projectId: "library-custom" }] }]);
  const custom = fixture([], [], [installed]);
  expect((await custom.call("listLibraries", { installed: true })).libraries[0].projectIds).toEqual([installed.projectId]);
});

it("uses the store's team visibility rules", async () => {
  const allowed = entry("allowed", "Allowed", { hidden: true, whitelistTeams: ["team"] });
  const { studioCtx, call } = fixture([allowed, entry("denied", "Denied", { hidden: true })]);
  runInAction(() => { studioCtx.siteInfo.teamId = "team" as TeamId; });
  expect((await call("listLibraries")).libraries.map((library: { name: string }) => library.name)).toEqual(["Allowed"]);
});

it("reads latest published components and update availability without changing installed models or loading code", async () => {
  const installed = dependency("overseas", [{ name: "OldShell", displayName: "Old Shell" }], "1.0.0");
  const latest = dependency("overseas", [
    { name: "plasmic-overseas-app-shell", displayName: "AppShell", description: "Application navigation shell" },
    { name: "LibraryProvider", displayName: "LibraryProvider", isContext: true },
  ]);
  const { studioCtx, call } = fixture([entry("overseas", "Overseas")], [latest], [installed]);
  const registry = vi.spyOn(studioCtx, "updateCcRegistry");
  const bundler = vi.spyOn(studioCtx, "bundler");
  const result = await call("getLibrary", { projectId: latest.projectId, limit: 1 });
  expect(result).toMatchObject({ projectId: latest.projectId, version: "1.1.0", installedVersion: "1.0.0", updateAvailable: true, packages: ["@example/overseas"], total: 2, nextOffset: 1 });
  expect(result.components[0]).toMatchObject({ name: "plasmic-overseas-app-shell", importName: "AppShell", isContext: false });
  expect(result.components[0]).not.toHaveProperty("props");
  expect((await call("getLibrary", { projectId: latest.projectId, offset: 1 })).components[0].isContext).toBe(true);
  expect((await call("getLibrary", { projectId: latest.projectId, query: "navigation" })).total).toBe(1);
  expect(studioCtx.site.projectDependencies[0]).toBe(installed);
  expect(installed.site.components[0].name).toBe("OldShell");
  expect(registry).not.toHaveBeenCalled();
  expect(bundler).not.toHaveBeenCalled();
});

it("searches real publications before installation even when catalog entries have no component index", async () => {
  const overseas = dependency("overseas", [{ name: "plasmic-overseas-app-shell", displayName: "AppShell" }]);
  const reactUi = dependency("react-ui", [{ name: "plasmic-react-ui-action-group", displayName: "ActionGroup" }]);
  const { call, api, studioCtx } = fixture([entry("overseas", "Overseas"), entry("overseas", "Other section"), entry("react-ui", "React UI")], [overseas, reactUi]);
  const result = await call("searchLibraryComponents", { query: "action group" });
  expect(result).toMatchObject({ total: 1, failures: [], components: [{ name: "plasmic-react-ui-action-group", projectId: reactUi.projectId, version: reactUi.version, libraryName: "react-ui" }] });
  expect(api.getPkgByProjectId.mock.calls.filter(([id]) => id !== studioCtx.siteInfo.id).map(([id]) => id)).toEqual([overseas.projectId, reactUi.projectId]);
  expect(studioCtx.site.projectDependencies).toHaveLength(0);
  const scoped = await call("searchLibraryComponents", { projectId: overseas.projectId, query: "AppShell" });
  expect(scoped.components[0].projectId).toBe(overseas.projectId);
});

it("reports incomplete searches explicitly, excludes hidden libraries, and paginates matching components", async () => {
  const icons = dependency("antd-icons", [{ name: "AccountBookFilled", displayName: "AccountBookFilled" }, { name: "AlertFilled", displayName: "AlertFilled" }]);
  const { call, api } = fixture([entry("antd-icons", "Icons"), entry("unavailable", "Unavailable"), entry("hidden", "Hidden", { hidden: true })], [icons]);
  const result = await call("searchLibraryComponents", { query: "filled", limit: 1 });
  expect(result).toMatchObject({ total: 2, nextOffset: 1, failures: [{ projectId: "library-unavailable", message: expect.stringContaining("no published versions") }] });
  expect(api.getPkgByProjectId).not.toHaveBeenCalledWith("library-hidden");
  expect((await call("searchLibraryComponents", { query: "filled", limit: 1, offset: result.nextOffset })).components[0].name).toBe("AlertFilled");
  await expect(call("getLibrary", { projectId: "unknown" })).rejects.toThrow("no published versions");
  await expect(call("searchLibraryComponents", { query: "" })).rejects.toThrow("invalid input");
});

it("honors the store's hidden component entries when finding a library provider", async () => {
  const old = dependency("antd6", [{ name: "plasmic-antd6-app-shell", displayName: "AppShell" }]);
  const current = dependency("overseas", [{ name: "plasmic-overseas-app-shell", displayName: "AppShell" }]);
  const { call } = fixture([
    entry("antd6", "Ant Design", { items: [{ type: "hostless-component", componentName: "plasmic-antd6-app-shell", displayName: "AppShell", hidden: true }] }),
    entry("overseas", "Overseas"),
  ], [old, current]);
  expect((await call("searchLibraryComponents", { query: "AppShell" })).components.map((component: { projectId: string }) => component.projectId)).toEqual([current.projectId]);
  expect((await call("getLibrary", { projectId: old.projectId })).total).toBe(0);
});

it("uses a discovered provider ID to install the library, then exposes its project dependency inventory", async () => {
  const icons = dependency("antd-icons", [{ name: "AccountBookFilled", displayName: "AccountBookFilled" }]);
  const { call, studioCtx } = fixture([entry("antd-icons", "Ant Design Icons")], [icons]);
  const add = vi.spyOn(studioCtx.projectDependencyManager, "addByProjectId").mockImplementation(async () => {
    runInAction(() => studioCtx.site.projectDependencies.push(icons));
    return icons;
  });
  const registry = vi.spyOn(studioCtx, "updateCcRegistry").mockResolvedValue(undefined);
  const match = (await call("searchLibraryComponents", { query: "AccountBook" })).components[0];
  expect(await call("installLibrary", { projectId: match.projectId })).toEqual({ projectId: icons.projectId, version: icons.version, installed: true });
  expect(add).toHaveBeenCalledWith(icons.projectId);
  expect(registry).toHaveBeenCalledWith(["antd-icons"]);
  expect((await call("listLibraries", { installed: true })).libraries[0].installedProjects[0].version).toBe(icons.version);
  expect((await call("read", { fromProject: icons.projectId, collection: "components" })).results[0].components[0].name).toBe("AccountBookFilled");
  expect(await call("installLibrary", { projectId: match.projectId })).toMatchObject({ installed: false });
  expect(add).toHaveBeenCalledOnce();
});

it("allows library discovery in a read-only project while rejecting installation", async () => {
  const library = dependency("react-ui", [{ name: "ActionGroup", displayName: "ActionGroup" }]);
  const { call, studioCtx } = fixture([entry("react-ui", "React UI")], [library]);
  vi.spyOn(studioCtx, "canEditProject").mockReturnValue(false);
  expect((await call("listLibraries")).total).toBe(1);
  expect((await call("getLibrary", { projectId: library.projectId })).updateAvailable).toBe(false);
  expect((await call("searchLibraryComponents", { query: "ActionGroup" })).total).toBe(1);
  await expect(call("installLibrary", { projectId: library.projectId })).rejects.toThrow("read-only");
});

it("does not report an upgrade as successful before registration readiness, and retries readiness for the installed version", async () => {
  const old = dependency("overseas", [], "1.0.0");
  const latest = dependency("overseas", []);
  const { call, studioCtx } = fixture([], [latest], [old]);
  const upgrade = vi.spyOn(studioCtx.projectDependencyManager, "upgradeProjectDeps").mockImplementation(async ([next]) => {
    runInAction(() => studioCtx.site.projectDependencies.splice(0, 1, next));
  });
  const ready = vi.spyOn(studioCtx, "ensureCodeComponentRegistrations")
    .mockRejectedValueOnce(new Error("Registration failed"))
    .mockResolvedValueOnce(undefined);
  await expect(call("upgradeLibrary", { projectId: old.projectId })).rejects.toThrow("Registration failed");
  expect(await call("upgradeLibrary", { projectId: old.projectId })).toMatchObject({ version: latest.version, upgraded: false });
  expect(upgrade).toHaveBeenCalledOnce();
  expect(ready).toHaveBeenCalledTimes(2);
});

it("installs and upgrades through the real dependency manager, reads new live contracts, and saves/reopens the component instance", async () => {
  const library = dependency("audit-icons", [{ name: "AuditIcon", displayName: "AuditIcon" }], "1.0.0");
  ensure(library.site.components[0].codeComponentMeta, "Missing published component metadata").isHostLess = true;
  library.site.components[0].params.push(mkParam({ name: "spin", paramType: "prop", type: typeFactory.bool() }));
  const catalog = [entry("audit-icons", "Audit Icons", { hasCodeArtifacts: true })];
  const previousCatalog = DEVFLAGS.hostLessComponents;
  DEVFLAGS.hostLessComponents = catalog;
  // Match studio-initializer: lazy model observation invalidates cached trees
  // through this observable during real editing sessions.
  makeGlobalObservable();
  const { studioCtx, api, call, versions } = fixture(catalog, [library]);
  const realBundles = await vi.importActual<typeof studioBundles>("@/wab/client/components/studio/studio-bundles");
  vi.spyOn(studioBundles, "getSortedHostLessPkgs").mockImplementation(realBundles.getSortedHostLessPkgs);
  vi.spyOn(scriptUtils, "scriptExec").mockImplementation((win, source) => { runInNewContext(source, { window: win }); });
  vi.stubGlobal("fetch", vi.fn(async (url: string) => ({ ok: true, text: async () => {
    if (url.endsWith("client.test.js")) {
      return "window.__CanvasPkgs = {};";
    }
    const version = new URL(url, "http://localhost").searchParams.get("version");
    const meta = { name: "AuditIcon", importPath: "@example/audit-icons", props: { spin: { type: "boolean", description: `Spin ${version}` } } };
    return `window.__PlasmicComponentRegistry.push({component:function(){return null;},meta:${JSON.stringify(meta)}});`;
  } })));
  api.getHostlessLibraryCanvas.mockImplementation(async (name, release) => (await fetch(`/api/v1/hostless-libraries/${name}/canvas?${new URLSearchParams({version:release.version,pkgId:release.pkgId})}`)).text());
  api.getAppAuthPubConfig.mockResolvedValue({ allowed: true, appName: "", authScreenProperties: null, isAuthEnabled: false });
  api.getPkgVersionMeta.mockImplementation(async (id) => ({ pkg: ensure(versions.get(id), "Missing publication metadata"), depPkgs: [] }));
  api.getPlumePkg.mockResolvedValue({ pkg: publication(dependency("plume", [])), depPkgs: [] });
  studioCtx.dbCtx().revisionNum = 0;
  let persisted = studioCtx.bundleSite().site;
  studioCtx.bundler().unbundleAndRecomputeParents(persisted, studioCtx.siteInfo.id);
  api.saveProjectRevChanges.mockImplementation(async (_id, revision) => {
    const changes: Bundle = JSON.parse(revision.data);
    const map = revision.incremental ? { ...persisted.map } : {};
    for (const [id, fields] of Object.entries(changes.map)) {
      map[id] = { ...map[id], ...fields };
    }
    for (const id of revision.toDeleteIids) { delete map[id]; }
    persisted = { ...changes, map };
    return {};
  });
  try {
    const provider = (await call("searchLibraryComponents", { query: "AuditIcon" })).components[0];
    expect(await call("installLibrary", { projectId: provider.projectId })).toMatchObject({ installed: true, version: "1.0.0" });
    expect(api.getHostlessLibraryCanvas).toHaveBeenCalled();
    const contract = () => call("read", { fromProject: library.projectId, collection: "components", view: "contract" });
    expect((await contract()).results[0].components[0].props[0].description).toBe("Spin 1.0.0");
    const page = (await call("createComponent", { name: "Icons", type: "page" })).created[0].uuid;
    await call("insertHtml", { componentUuid: page, html: `<plasmic-component data-plasmic-component="AuditIcon" data-plasmic-project="${provider.projectId}" data-plasmic-name="AccountIcon" data-props='{"spin":true}'></plasmic-component>` });
    const instance = ensure(flattenTpls(ensure(studioCtx.site.components.find((component) => component.uuid === page), "Missing page").tplTree).find(isKnownTplComponent), "Missing inserted icon");
    expect(instance.component).toBe(studioCtx.site.projectDependencies[0].site.components[0]);
    const latest = unbundleProjectDependency(new FastBundler(), publication(library), []).projectDependency;
    latest.version = "1.1.0";
    versions.set(latest.pkgId, publication(latest));
    expect((await call("getLibrary", { projectId: library.projectId })).updateAvailable).toBe(true);
    expect(await call("upgradeLibrary", { projectId: library.projectId })).toMatchObject({ upgraded: true, version: "1.1.0" });
    expect(instance.component).toBe(studioCtx.site.projectDependencies[0].site.components[0]);
    expect((await contract()).results[0].components[0].props[0].description).toBe("Spin 1.1.0");
    expect((await call("validate")).valid).toBe(true);
    const savedModel = studioCtx.bundleSite().site;
    expect(savedModel.deps).toEqual([publication(latest).id]);
    expect(await call("save")).toMatchObject({ saved: true, revision: 1 });
    expect(api.saveProjectRevChanges).toHaveBeenCalledOnce();
    const reopenedSite = unbundleSite(new FastBundler(), studioCtx.siteInfo.id, persisted, [ensure(versions.get(latest.pkgId), "Missing saved dependency")]).site;
    const reopened = fakeStudioCtx({ site: reopenedSite, devFlagOverrides: { hostLessComponents: catalog } });
    expect(reopened.studioCtx.site.projectDependencies[0].version).toBe("1.1.0");
    const readback = JSON.parse(await COPILOT_TOOLS.read.execute(reopened.studioCtx, { componentUuids: [page], view: "full" }));
    expect(readback.results[0].baseVariantTplTree).toContain('"spin":true');
    expect((await call("getLibrary", { projectId: latest.projectId })).updateAvailable).toBe(false);
  } finally {
    DEVFLAGS.hostLessComponents = previousCatalog;
    clearGlobalObservable();
    vi.unstubAllGlobals();
  }
});
