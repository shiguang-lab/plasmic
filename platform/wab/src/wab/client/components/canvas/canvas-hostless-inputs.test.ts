import { CanvasHostlessInputs } from "@/wab/client/components/canvas/canvas-hostless-inputs";
import type { HostLessPackageRequest } from "@/wab/client/components/studio/studio-bundles";
import { ModelSnapshots } from "@/wab/client/studio-ctx/model-snapshots";
import type { ModelCommit, StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { ensure } from "@/wab/shared/common";
import { mkArenaFrame } from "@/wab/shared/Arenas";
import { mkVariantSetting } from "@/wab/shared/Variants";
import { ComponentType, mkComponent } from "@/wab/shared/core/components";
import { mkParam } from "@/wab/shared/core/lang";
import { mkTplComponent, mkTplTagX } from "@/wab/shared/core/tpls";
import { mkCodeComponent } from "@/wab/shared/code-components/code-components";
import type { ModelChange } from "@/wab/shared/core/observable-model";
import { createSite } from "@/wab/shared/core/sites";
import { DEVFLAGS } from "@/wab/shared/devflags";
import { HostLessPackageInfo, ObjInst, ProjectDependency, CustomCode, ObjectPath, RenderExpr, VirtualRenderExpr, TplRef, RawText, NodeMarker, CustomFunction, CodeLibrary } from "@/wab/shared/model/classes";
import { typeFactory } from "@/wab/shared/model/model-util";
import type { ChangeSummary } from "@/wab/shared/model/model-change-util";

const originalPackages = DEVFLAGS.hostLessComponents;
beforeEach(() => {
  const base = ensure(originalPackages?.[0], "Test requires a hostless package declaration");
  DEVFLAGS.hostLessComponents = [{ ...base, codeName: "managed", hasCodeArtifacts: true }];
});
afterEach(() => { DEVFLAGS.hostLessComponents = originalPackages; });

function fixture(authoring = false, scoped = false) {
  const info = new HostLessPackageInfo({ name: "managed", npmPkg: [], cssImport: [], deps: [], registerCalls: [], minimumReactVersion: null });
  const site = createSite({ hostLessPackageInfo: authoring ? info : null });
  const library = createSite({ hostLessPackageInfo: info });
  const dep = new ProjectDependency({ uuid: "dependency", projectId: "project", pkgId: "package", version: "1", name: "Library", site: library });
  site.projectDependencies.push(dep);
  const root = mkTplTagX("div");
  root.vsettings.push(mkVariantSetting({ variants: [] }));
  const component = mkComponent({ name: "Page", type: ComponentType.Plain, tplTree: root });
  const libraryComponent = mkCodeComponent("LibraryButton", { name: "LibraryButton", importPath: "test", props: {} }, {});
  ensure(libraryComponent.codeComponentMeta, "Library component has code metadata").isHostLess = true;
  site.components.push(component); library.components.push(libraryComponent);
  const frame = mkArenaFrame({ site, component, name: "Page", width: 800, height: 600 });
  const models = new ModelSnapshots(), listeners = new Set<(event: ModelCommit) => void>();
  const studio = ({ site, modelSnapshots: models, subscribeModelChanges: (listener: (event: ModelCommit) => void) => {
    listeners.add(listener); return () => { listeners.delete(listener); };
  } } as unknown as StudioCtx);
  const changed = vi.fn<(requests: readonly HostLessPackageRequest[]) => void>();
  const owner = new CanvasHostlessInputs(studio, changed, scoped ? frame : undefined);
  const commit = (inst: ObjInst, field: string) => {
    const changes: ModelChange[] = [{ type: "update", oldValue: undefined, newValue: Reflect.get(inst, field), changeNode: { inst, field } }];
    models.sync(changes); listeners.forEach((listener) => listener({ type: "commit", summary: { changes } as ChangeSummary }));
  };
  return { site, library, dep, root, component, libraryComponent, frame, models, listeners, owner, changed, commit,
    requests: () => changed.mock.lastCall?.[0] ?? [],
    instance: () => mkTplComponent(libraryComponent, component.variants[0]),
    dispose: () => { owner.dispose(); models.dispose(); } };
}

it("captures exact committed releases and preserves earlier requests through upgrades and undo", () => {
  const f = fixture();
  const initial = f.changed.mock.calls[0][0];
  expect(initial).toEqual([{ name: "managed", identity: "managed@package:1", release: { pkgId: "package", version: "1" } }]);
  f.dep.version = "2";
  expect(initial[0].release?.version).toBe("1");
  f.commit(f.dep, "version");
  expect(f.changed.mock.lastCall?.[0][0].identity).toBe("managed@package:2");
  f.commit(f.dep, "name"); f.commit(f.dep, "version");
  expect(f.changed).toHaveBeenCalledTimes(2);
  f.dep.version = "1"; f.commit(f.dep, "version");
  expect(f.changed.mock.lastCall?.[0]).toEqual(initial);
  f.dispose();
});

it("loads a newly inserted library at commit, including undo, redo and exact version replacement", () => {
  const f = fixture(false, true);
  expect(f.requests()).toEqual([]);
  expect(f.models.resolve(f.models.field(f.library, "components").getState()[0])).toBe(f.libraryComponent);
  const node = f.instance();
  expect(node.component).toBe(f.libraryComponent);
  f.root.children.push(node); f.commit(f.root, "children");
  expect(f.requests().map((request) => request.identity)).toEqual(["managed@package:1"]);
  f.root.children = []; f.commit(f.root, "children"); expect(f.requests()).toEqual([]);
  f.root.children = [node]; f.commit(f.root, "children");
  f.dep.version = "2"; f.commit(f.dep, "version");
  expect(f.requests()[0].identity).toBe("managed@package:2");
  f.dep.version = "1"; f.commit(f.dep, "version");
  expect(f.requests()[0].identity).toBe("managed@package:1");
  f.dispose();
});

it.each([RenderExpr, VirtualRenderExpr])("follows dynamic slot contents and fallback expressions (%s)", (Render) => {
  const f = fixture(false, true);
  const param = mkParam({ name: "content", type: typeFactory.any(), paramType: "prop" });
  f.component.params.push(param);
  param.defaultExpr = new ObjectPath({ path: ["$props", "dynamic"], fallback: new Render({ tpl: [f.instance()] }) });
  f.commit(f.component, "params");
  expect(f.requests().map((request) => request.name)).toEqual(["managed"]);
  param.defaultExpr = null; f.commit(param, "defaultExpr"); expect(f.requests()).toEqual([]);
  param.previewExpr = new Render({ tpl: [f.instance()] }); f.commit(param, "previewExpr");
  expect(f.requests().map((request) => request.name)).toEqual(["managed"]);
  f.dispose();
});

it("includes inactive conditional variants and explicit dynamic node references", () => {
  const f = fixture(false, true);
  f.root.vsettings.push(mkVariantSetting({ variants: [], dataCond: new CustomCode({ code: "false", fallback: null }), attrs: { target: new TplRef({ tpl: f.instance() }) } }));
  f.commit(f.root, "vsettings");
  expect(f.requests().map((request) => request.name)).toEqual(["managed"]);
  f.root.vsettings = []; f.commit(f.root, "vsettings"); expect(f.requests()).toEqual([]);
  f.dispose();
});

it("follows rich-text embedded components and global providers", () => {
  const f = fixture(false, true);
  f.root.vsettings[0].text = new RawText({ text: "x", markers: [new NodeMarker({ position: 0, length: 1, tpl: f.instance() })] });
  f.commit(f.root.vsettings[0], "text");
  expect(f.requests().map((request) => request.name)).toEqual(["managed"]);
  f.root.vsettings[0].text = null; f.commit(f.root.vsettings[0], "text"); expect(f.requests()).toEqual([]);
  f.site.globalContexts.push(f.instance()); f.commit(f.site, "globalContexts");
  expect(f.requests().map((request) => request.name)).toEqual(["managed"]);
  f.dispose();
});

it("preserves transitive declared package dependencies even without a template reference", () => {
  const f = fixture(false, true);
  const extra = createSite({ hostLessPackageInfo: new HostLessPackageInfo({ ...ensure(f.library.hostLessPackageInfo, "Library has package metadata"), name: "extra", deps: ["third"] }) });
  const third = createSite({ hostLessPackageInfo: new HostLessPackageInfo({ ...ensure(f.library.hostLessPackageInfo, "Library has package metadata"), name: "third", deps: ["managed"] }) });
  f.library.projectDependencies.push(new ProjectDependency({ ...f.dep, projectId: "extra", site: extra }), new ProjectDependency({ ...f.dep, projectId: "third", site: third }));
  const info = ensure(f.library.hostLessPackageInfo, "Library has package metadata"); info.deps = ["extra"];
  f.commit(f.library, "projectDependencies"); f.commit(info, "deps");
  f.root.children.push(f.instance()); f.commit(f.root, "children");
  expect(f.requests().map((request) => request.name)).toEqual(["managed", "extra", "third"]);
  f.dispose();
});

it("keeps the complete registry for a custom Host and library authoring", () => {
  for (const authoring of [false, true]) {
    const f = fixture(authoring);
    expect(f.root.children).toEqual([]);
    expect(f.requests().map((request) => request.name)).toEqual(["managed"]);
    f.dispose();
  }
});

it.each(["window.__PlasmicComponentRegistry", "globalThis['__PlasmicComponentRegistry']"])('keeps opaque dynamic global references (%s)', (code) => {
  const f = fixture(false, true);
  const expr = new CustomCode({ code: "123", fallback: null });
  f.root.vsettings[0].attrs.dynamic = expr; f.commit(f.root.vsettings[0], "attrs"); expect(f.requests()).toEqual([]);
  expr.code = code; f.commit(expr, "code");
  expect(f.requests().map((request) => request.name)).toEqual(["managed"]);
  expr.code = "123"; f.commit(expr, "code"); expect(f.requests()).toEqual([]);
  f.dispose();
});

it("keeps libraries reachable only through opaque host components or registered functions", () => {
  const f = fixture(false, true);
  const opaque = mkCodeComponent("HostWidget", { name: "HostWidget", importPath: "test", props: {} }, {});
  f.root.children = [mkTplComponent(opaque, f.component.variants[0])]; f.commit(f.root, "children");
  expect(f.requests().map((request) => request.name)).toEqual(["managed"]);
  f.root.children = []; f.commit(f.root, "children"); expect(f.requests()).toEqual([]);
  f.site.customFunctions.push(new CustomFunction({ namespace: null, importName: "dynamic", importPath: "test", defaultExport: false, params: [], isQuery: false, isMutation: false, displayName: null }));
  f.commit(f.site, "customFunctions");
  expect(f.requests().map((request) => request.name)).toEqual(["managed"]);
  f.dispose();
});

it("includes allowed render-prop components and cyclic subcomponent contracts", () => {
  const f = fixture(false, true);
  const param = mkParam({ name: "render", paramType: "slot", type: typeFactory.renderFunc({ params: [], allowed: [typeFactory.instance(f.libraryComponent)], allowRootWrapper: false }) });
  f.component.params.push(param); f.commit(f.component, "params");
  expect(f.requests().map((request) => request.name)).toEqual(["managed"]);
  f.component.params = []; f.commit(f.component, "params"); expect(f.requests()).toEqual([]);
  const child = mkComponent({ name: "Subcomponent", type: ComponentType.Plain, tplTree: f.instance(), superComp: f.component });
  f.commit(f.component, "subComps");
  expect(child.superComp).toBe(f.component);
  expect(f.requests().map((request) => request.name)).toEqual(["managed"]);
  f.dispose();
});

it("keeps the complete registry for code libraries in transitive dependencies", () => {
  const f = fixture(false, true);
  f.library.codeLibraries.push(new CodeLibrary({ name: "dynamic", importPath: "test", jsIdentifier: "dynamic", importType: "namespace", namedImport: null, isSyntheticDefaultImport: false }));
  f.commit(f.library, "codeLibraries");
  expect(f.requests().map((request) => request.name)).toEqual(["managed"]);
  f.library.codeLibraries = []; f.commit(f.library, "codeLibraries");
  expect(f.requests()).toEqual([]);
  f.dispose();
});

it("requests newly referenced libraries before deferred UI publication", () => {
  const f = fixture(false, true);
  const children = f.models.field(f.root, "children"), published = vi.fn();
  const stop = children.subscribe(published);
  try {
    f.models.deferPublication(() => {
      f.root.children.push(f.instance()); f.commit(f.root, "children");
      expect(published).not.toHaveBeenCalled();
      expect(f.requests().map((request) => request.name)).toEqual(["managed"]);
    });
    expect(published).toHaveBeenCalledOnce();
  } finally { stop(); f.dispose(); }
});

it("removes old dependency subscriptions and disposes", () => {
  const f = fixture();
  f.site.projectDependencies = []; f.commit(f.site, "projectDependencies");
  expect(f.changed.mock.lastCall?.[0]).toEqual([]);
  f.dep.version = "2"; f.commit(f.dep, "version");
  expect(f.changed).toHaveBeenCalledTimes(2);
  f.owner.dispose(); f.owner.dispose();
  expect(f.listeners.size).toBe(0);
  f.site.projectDependencies = [f.dep]; f.commit(f.site, "projectDependencies");
  expect(f.changed).toHaveBeenCalledTimes(2);
  f.dispose();
});

it("captures the constructor's authoring contract and stops on site replacement", () => {
  const f = fixture(true);
  expect(f.changed.mock.lastCall?.[0]).toEqual([{ name: "managed", identity: "managed", authoring: true }]);
  f.listeners.forEach((listener) => listener({ type: "site-replaced", site: createSite() }));
  expect(f.listeners.size).toBe(0);
  const info = ensure(f.library.hostLessPackageInfo, "The library must have package metadata");
  info.name = "renamed"; f.commit(info, "name");
  expect(f.changed).toHaveBeenCalledTimes(1);
  f.dispose();
});


it("accepts exact releases before deferred field UI publication", () => {
  const f = fixture();
  const version = f.models.field(f.dep, "version");
  const fieldPublished = vi.fn();
  const stop = version.subscribe(fieldPublished);
  try {
    f.changed.mockClear();
    f.models.deferPublication(() => {
      f.dep.version = "2";
      f.commit(f.dep, "version");
      expect(version.getState()).toBe("2");
      expect(fieldPublished).not.toHaveBeenCalled();
      expect(f.changed).toHaveBeenCalledExactlyOnceWith([
        { name: "managed", identity: "managed@package:2", release: { pkgId: "package", version: "2" } },
      ]);
      f.commit(f.dep, "version");
      expect(f.changed).toHaveBeenCalledOnce();
    });
    expect(fieldPublished).toHaveBeenCalledOnce();
    expect(f.changed).toHaveBeenCalledOnce();
  } finally { stop(); f.dispose(); }
});
