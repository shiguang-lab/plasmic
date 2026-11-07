import {
  PreviewCodegenContext,
  buildDocsPreviewModules,
  buildPreviewModules,
  buildPreviewUpdate,
  subscribePreviewCodegen,
} from "@/wab/client/components/live/preview-codegen";
import { syncPreview } from "@/wab/client/components/live/preview-sync";
import type {
  PreviewUpdate,
  SourceModule,
} from "@/wab/client/components/live/preview-types";
import { ProjectId } from "@/wab/shared/ApiSchema";
import { generateSiteFromBundle } from "@/wab/shared/__testonly__/site-tests-utils";
import { Bundle, Bundler } from "@/wab/shared/bundler";
import { ensure, jsonClone } from "@/wab/shared/common";
import { isCodeComponent, mkComponent, ComponentType } from "@/wab/shared/core/components";
import type { ModelCommit, StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import type { ChangeSummary } from "@/wab/shared/model/model-change-util";
import type { Component, ObjInst } from "@/wab/shared/model/classes";
import { componentToDeepReferenced } from "@/wab/shared/cached-selectors";
import { walkDependencyTree } from "@/wab/shared/core/project-deps";
import { asSvgDataUrl } from "@/wab/shared/data-urls";
import { mkCodeComponent } from "@/wab/shared/code-components/code-components";
import { mkTplTagX } from "@/wab/shared/core/tpls";
import { mkImageAsset } from "@/wab/shared/core/image-assets";
import { ImageAssetType } from "@/wab/shared/core/image-asset-type";
import { initBuiltinActions } from "@/wab/shared/core/states";
import { deepTrackComponents } from "@/wab/shared/core/tpls";
import { DEVFLAGS } from "@/wab/shared/devflags";
import fs from "fs";
import path from "path";
import { createStore } from "zustand/vanilla";

const fixtureDir = path.resolve(
  __dirname,
  "../../../shared/codegen/__testonly__/bundles",
);
function loadFixture(name: string): PreviewCodegenContext {
  const site = generateSiteFromBundle(
    JSON.parse(
      fs.readFileSync(path.join(fixtureDir, `${name}.json`), "utf8"),
    ) as [string, Bundle][],
  );
  deepTrackComponents(site);
  const siteInfo = {
    id: "preview-test" as ProjectId,
    name: "Preview test",
    appAuthProvider: undefined,
  };
  initBuiltinActions({
    projectId: siteInfo.id,
    platform: "react",
    projectFlags: jsonClone(DEVFLAGS),
    inStudio: true,
  });
  return { site, siteInfo };
}

function transpileAll(modules: SourceModule[]) {
  const frame = { update: async () => {}, showError: async () => {} };
  return new Promise<unknown>((resolve) => {
    const dispose = syncPreview(
      { __plasmicLive: frame } as unknown as Window,
      () => ({ modules }),
      (error) => {
        dispose();
        resolve(error);
      },
    );
  });
}

it.each([
  "counters-test",
  "global-variant-test",
  "custom-functions-test",
  "style-token-overrides",
  "imported-project-default-theme-styles",
  "data-tokens",
])(
  "snapshots live and docs modules from %s without mutating the model",
  async (name) => {
    const ctx = loadFixture(name);
    const bundler = new Bundler();
    const before = bundler.bundle(ctx.site, "preview-test", "test");
    const snapshots: {
      component: string;
      render: PreviewUpdate["render"];
      propsModule?: SourceModule;
      liveModules: string[];
      docsModules: string[];
    }[] = [];
    const fixtureModules = new Map<string, SourceModule>();
    for (const component of ctx.site.components.filter(
      (c) => !isCodeComponent(c),
    )) {
      const route = {
        component,
        previewPath: "/preview",
        variants: {},
        globals: {},
        pageQuery: {},
        appUser: {},
      };
      const live = buildPreviewUpdate(ctx, route);
      const docs = buildDocsPreviewModules(ctx, component, false);
      expect(buildPreviewUpdate(ctx, route)).toEqual(live);
      // Both consumers must receive the same component implementations and JSX pragma.
      const docsByName = new Map(docs.modules.map((mod) => [mod.name, mod]));
      for (const mod of live.modules.filter((m) =>
        m.name.includes("render__"),
      )) {
        expect(docsByName.get(mod.name)).toEqual(mod);
        expect(mod.jsxPragma).toBe("createPlasmicElementProxy");
      }
      const modules = [
        ...new Map(
          [...live.modules, ...docs.modules].map((mod) => [mod.name, mod]),
        ).values(),
      ];
      expect(new Set(live.modules.map((mod) => mod.name)).size).toBe(
        live.modules.length,
      );
      // Exercise the actual transpiler over every emitted module.
      expect(await transpileAll(modules)).toBeUndefined();
      modules
        .filter((mod) => mod.name !== "./preview-props.tsx")
        .forEach((mod) => fixtureModules.set(mod.name, mod));
      snapshots.push({
        component: component.name,
        render: live.render,
        propsModule: live.modules.find(
          (mod) => mod.name === "./preview-props.tsx",
        ),
        liveModules: live.modules.map((mod) => mod.name),
        docsModules: docs.modules.map((mod) => mod.name),
      });
    }
    expect(snapshots.length).toBeGreaterThan(0);
    expect({
      previews: snapshots,
      modules: [...fixtureModules.values()].sort((a, b) =>
        a.name.localeCompare(b.name),
      ),
    }).toMatchSnapshot();
    expect(bundler.bundle(ctx.site, "preview-test", "test")).toEqual(before);
  },
);

it("keeps memoized component outputs when unrelated route values change", () => {
  const ctx = loadFixture("counters-test");
  const component = ensure(
    ctx.site.components.find((c) => !isCodeComponent(c)),
    "fixture component",
  );
  const first = buildPreviewUpdate(ctx, { component, previewPath: "/one", variants: {}, globals: {}, pageQuery: {}, appUser: {} });
  const firstOutput = buildPreviewModules(ctx, component).rootOutput;
  const second = buildPreviewUpdate(ctx, { component, previewPath: "/two", variants: {}, globals: {}, pageQuery: {}, appUser: {} });
  expect(first.modules).not.toBe(second.modules);
  expect(buildPreviewModules(ctx, component).rootOutput).toBe(firstOutput);

});

it("builds a 404 without generating a component entry", () => {
  const ctx = loadFixture("counters-test");
  const result = buildPreviewUpdate(ctx, {
    previewPath: "/missing",
    variants: {},
    globals: {},
    pageQuery: {},
    appUser: {},
  });
  expect(result.render).toEqual({ notFound: "/missing" });
  expect(result.modules.some((mod) => mod.name === "./preview-props.tsx")).toBe(
    false,
  );
});

it("uses the dependency project CSS for an imported artboard root in Dashboard", () => {
  const ctx = loadFixture("imported-project-default-theme-styles");
  const dependency = ensure(ctx.site.projectDependencies[0], "fixture dependency");
  const component = ensure(dependency.site.components.find((c) => !isCodeComponent(c)), "imported root");
  const result = buildPreviewModules(ctx, component);
  const root = ensure(result.rootOutput, "root output");
  const emitted = ensure(result.modules.find((m) => m.name === `./${root.renderModuleFileName}`), "emitted root");
  expect(emitted.source).toBe(root.renderModule);
  const css = ensure(result.depsProjectConfigs.find((c) => c.projectId === dependency.projectId), "dependency config").cssFileName;
  expect(root.renderModule).toContain(css);
  expect(root.renderModule).not.toContain(result.projectConfig.cssFileName);
});

it("builds a 404 for a root deleted while it is previewed", () => {
  const ctx = loadFixture("counters-test");
  const page = ensure(
    ctx.site.components.find((c) => c.pageMeta),
    "fixture has a page",
  );
  ctx.site.components.splice(ctx.site.components.indexOf(page), 1);
  const result = buildPreviewUpdate(ctx, {
    component: page,
    previewPath: "/deleted",
    variants: {},
    globals: {},
    pageQuery: {},
    appUser: {},
  });
  expect(result.render).toEqual({ notFound: "/deleted" });
});

function nativeFixture(name: string) {
  const listeners = new Set<(event: ModelCommit) => void>();
  const fixture = loadFixture(name);
  const ctx = Object.assign(fixture, {
    projectMetadataStore: createStore<ReturnType<StudioCtx["projectMetadataStore"]["getState"]>>(() => ({ ...fixture.siteInfo, projectApiToken: "test-token", isMainBranchProtected: false, mentionUsers: Object.freeze([]) })),
    subscribeModelChanges: (listener: (event: ModelCommit) => void) => {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
  });
  const commit = (inst: ObjInst, field: string, components: Component[] = []) => {
    const changeNode = { inst, field };
    const summary = {
      changes: [{ type: "update", changeNode, path: [changeNode] }],
      updatedComponents: new Set(components),
      deepUpdatedComponents: new Set<Component>(),
    } as ChangeSummary;
    listeners.forEach((listener) => listener({ type: "commit", summary }));
  };
  return { ctx, commit, listeners };
}

it("invalidates a rendered dependency without rebuilding unrelated roots and releases preview subscribers", () => {
  const { ctx, commit } = nativeFixture("counters-test");
  const root = ensure(ctx.site.components.find((component) => !isCodeComponent(component) && componentToDeepReferenced(component).size > 1), "fixture root references another component");
  const dependency = ensure([...componentToDeepReferenced(root)].find((component) => component !== root && !isCodeComponent(component)), "fixture dependency");
  const unrelated = mkComponent({ name: "Unrelated", type: ComponentType.Plain, tplTree: (baseVariant) => mkTplTagX("div", { baseVariant, styles: {} }) });
  ctx.site.components.push(unrelated);
  deepTrackComponents(ctx.site);
  const before = buildPreviewModules(ctx, root);
  const unchanged = buildPreviewModules(ctx, unrelated);
  const changed = vi.fn();
  const stop = subscribePreviewCodegen(ctx, () => root, changed);
  dependency.name += "Changed";
  commit(dependency, "name", [dependency]);
  expect(changed).toHaveBeenCalledOnce();
  const after = buildPreviewModules(ctx, root);
  expect(after.modules).not.toEqual(before.modules);
  expect(buildPreviewModules(ctx, unrelated).rootOutput).toBe(unchanged.rootOutput);
  stop();
  commit(dependency, "name", [dependency]);
  expect(changed).toHaveBeenCalledOnce();
});

it("refreshes project tokens, global variant modules, icons and registered metadata from native commits", () => {
  const { ctx, commit } = nativeFixture("global-variant-test");
  const root = ensure(ctx.site.components.find((component) => !isCodeComponent(component)), "fixture root");
  const before = buildPreviewModules(ctx, root);
  const group = ensure(ctx.site.globalVariantGroups.find((candidate) => candidate.variants.length), "fixture global group");
  group.variants[0].name += "Changed";
  commit(group, "variants");
  expect(buildPreviewModules(ctx, root).modules).not.toEqual(before.modules);

  const icon = mkImageAsset({ name: "NativeIcon", type: ImageAssetType.Icon, dataUri: asSvgDataUrl('<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0h1v1z"/></svg>') });
  ctx.site.imageAssets.push(icon);
  commit(ctx.site, "imageAssets");
  const docsBefore = buildDocsPreviewModules(ctx, root, false);
  icon.dataUri = asSvgDataUrl('<svg xmlns="http://www.w3.org/2000/svg"><circle r="2"/></svg>');
  commit(icon, "dataUri");
  expect(buildDocsPreviewModules(ctx, root, false).modules).not.toEqual(docsBefore.modules);

  const tokenOwner = nativeFixture("style-token-overrides");
  const tokenRoot = ensure(tokenOwner.ctx.site.components.find((component) => !isCodeComponent(component)), "token fixture root");
  const token = ensure([tokenOwner.ctx.site, ...walkDependencyTree(tokenOwner.ctx.site, "all").map((dep) => dep.site)].flatMap((site) => site.styleTokens)[0], "fixture token");
  const tokenBefore = buildPreviewModules(tokenOwner.ctx, tokenRoot);
  token.value = "#123456";
  tokenOwner.commit(token, "value");
  expect(buildPreviewModules(tokenOwner.ctx, tokenRoot).modules).not.toEqual(tokenBefore.modules);

  const codeComponent = mkCodeComponent("NativeWidget", { name: "NativeWidget", importPath: "./native-widget", props: {} }, {});
  ctx.site.components.push(codeComponent);
  deepTrackComponents(ctx.site);
  commit(ctx.site, "components");
  const registrationBefore = buildDocsPreviewModules(ctx, codeComponent, false);
  codeComponent.codeComponentMeta.defaultExport = !codeComponent.codeComponentMeta.defaultExport;
  commit(codeComponent, "codeComponentMeta", [codeComponent]);
  expect(buildDocsPreviewModules(ctx, codeComponent, false).modules).not.toEqual(registrationBefore.modules);

});

it("drops cached model ownership when a Studio site is replaced", () => {
  const { ctx, listeners } = nativeFixture("counters-test");
  const before = buildPreviewModules(ctx);
  const changed = vi.fn();
  const stop = subscribePreviewCodegen(ctx, () => undefined, changed);
  ctx.site = loadFixture("global-variant-test").site;
  listeners.forEach((listener) => listener({ type: "site-replaced", site: ctx.site }));
  expect(changed).toHaveBeenCalledOnce();
  expect(buildPreviewModules(ctx).modules).not.toEqual(before.modules);
  stop();
});


it("regenerates from native project name and authentication settings without a model edit", () => {
  const { ctx } = nativeFixture("counters-test");
  const root = ensure(ctx.site.components.find((component) => !isCodeComponent(component)), "fixture root");
  const before = buildPreviewModules(ctx, root);
  const changed = vi.fn();
  const stop = subscribePreviewCodegen(ctx, () => root, changed);
  ctx.siteInfo = { ...ctx.siteInfo, name: "Renamed project", appAuthProvider: "plasmic-auth" };
  ctx.projectMetadataStore.setState({ ...ctx.projectMetadataStore.getState(), ...ctx.siteInfo }, true);
  expect(changed).toHaveBeenCalledOnce();
  const after = buildPreviewModules(ctx, root);
  expect(after.projectConfig.projectName).toBe("Renamed project");
  expect(after.rootOutput).not.toBe(before.rootOutput);
  ctx.projectMetadataStore.setState({ projectApiToken: "updated-token" });
  expect(changed).toHaveBeenCalledOnce();
  expect(buildPreviewModules(ctx, root).rootOutput).toBe(after.rootOutput);
  stop();
  ctx.projectMetadataStore.setState({ ...ctx.projectMetadataStore.getState(), ...ctx.siteInfo, name: "Another project" }, true);
  expect(changed).toHaveBeenCalledOnce();
});
