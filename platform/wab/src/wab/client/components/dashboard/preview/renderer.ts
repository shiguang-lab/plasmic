import { overviewLayout } from "@/wab/client/components/dashboard/preview/layout";
import {
  previewChannel,
  type PreviewRequest,
} from "@/wab/client/components/dashboard/preview/types";
import { mkVariantsRecord } from "@/wab/client/components/live/PreviewCtx";
import { buildPreviewModules } from "@/wab/client/components/live/preview-codegen";
import { syncPreview } from "@/wab/client/components/live/preview-sync";
import {
  initPreviewInteractionGlobals,
  waitForLiveHost,
} from "@/wab/client/components/live/live-syncer";
import type { SourceModule } from "@/wab/client/components/live/preview-types";
import {
  getCanvasPkgs,
  getLiveFrameClientJs,
  getReactWebBundle,
  getSortedHostLessPkgs,
  getVersionForCanvasPackages,
} from "@/wab/client/components/studio/studio-bundles";
import { deserializeApiError } from "@/wab/shared/ApiErrors/errors";
import type { GetProjectResponse } from "@/wab/shared/ApiSchema";
import {
  getActivatedVariantsForFrame,
  getArenaFrames,
  getFrameHeight,
} from "@/wab/shared/Arenas";
import { isGlobalVariant } from "@/wab/shared/Variants";
import { FastBundler } from "@/wab/shared/bundler";
import { usedHostLessPkgs } from "@/wab/shared/cached-selectors";
import { getBuiltinComponentRegistrations } from "@/wab/shared/code-components/builtin-code-components";
import {
  makeGlobalGroupImports,
  makePlasmicIsPreviewRootComponent,
  wrapGlobalProviderWithCustomValue,
} from "@/wab/shared/codegen/react-p/serialize-utils";
import { toVarName } from "@/wab/shared/codegen/util";
import { ensure, withTimeout } from "@/wab/shared/common";
import { getRawCode } from "@/wab/shared/core/exprs";
import { allGlobalVariantGroups } from "@/wab/shared/core/sites";
import { initBuiltinActions } from "@/wab/shared/core/states";
import { unbundleSite } from "@/wab/shared/core/tagged-unbundle";
import { deepTrackComponents } from "@/wab/shared/core/tpls";
import { DEVFLAGS, applyDevFlagOverrides } from "@/wab/shared/devflags";

function inject(doc: Document, text: string) {
  const script = doc.createElement("script");
  script.textContent = text;
  doc.body.append(script);
}
export async function prepare(request: PreviewRequest) {
  const id = request.projectId;
  const response = await fetch(
    `/api/v1/projects/${encodeURIComponent(id)}?revisionNum=${request.revision}`,
  );
  if (!response.ok) {
    throw deserializeApiError(
      await response
        .json()
        .then((body) => body.error)
        .catch(() => undefined),
      response.status,
    );
  }
  const data: GetProjectResponse = await response.json();
  if (data.rev.revision !== request.revision) {
    throw new Error("Preview revision changed");
  }
  const { site } = unbundleSite(
    new FastBundler(),
    id,
    JSON.parse(data.rev.data),
    data.depPkgs,
  );
  deepTrackComponents(site);
  initBuiltinActions({
    projectId: id,
    platform: "react",
    projectFlags: DEVFLAGS,
    inStudio: false,
  });
  const arena = site.arenas.find((a) => a.children.length > 0);
  // A saved free canvas is the scope. Page arenas are only a fallback for projects without one.
  const artboards = arena
    ? arena.children
    : site.pageArenas
        .filter((a) => getArenaFrames(a, true).length)
        .map((pageArena) =>
          ensure(
            getArenaFrames(pageArena, true).sort(
              (a, b) => b.width - a.width,
            )[0],
            "No artboard",
          ),
        );
  if (!artboards.length) {
    throw new Error("No preview artboards");
  }
  const fallbackWidth = Math.max(...artboards.map((f) => f.width));
  const fallbackHeight = Math.max(...artboards.map((f) => getFrameHeight(f)));
  const pages = artboards.map((f, index) => ({
    uuid: f.uuid,
    componentId: f.container.component.uuid,
    page: f.container.component.pageMeta
      ? {
          route: f.container.component.pageMeta.path,
          params: f.container.component.pageMeta.params,
          query: f.container.component.pageMeta.query,
        }
      : undefined,
    variants: mkVariantsRecord(
      [...getActivatedVariantsForFrame(site, f)].filter(
        (v) => !isGlobalVariant(v),
      ),
    ),
    global: mkVariantsRecord(
      [...getActivatedVariantsForFrame(site, f)].filter(isGlobalVariant),
    ),
    name: f.name || f.container.component.name,
    width: f.width,
    height: getFrameHeight(f),
    left: arena ? (f.left ?? 0) : (index % 2) * (fallbackWidth + 80),
    top: arena ? (f.top ?? 0) : Math.floor(index / 2) * (fallbackHeight + 80),
  }));
  overviewLayout(pages);
  const components = artboards.map((f) => f.container.component);
  // Code generation memoizes component output per context object. One context
  // lets components shared by several artboards be generated only once.
  const codegenCtx = {
    site,
    siteInfo: { id: data.project.id, name: data.project.name, appAuthProvider: data.appAuthProvider },
  };
  const generated = [...new Set(components)].map((component) => ({
    component,
    output: buildPreviewModules(codegenCtx, component),
  }));
  const first = ensure(generated[0], "No preview components").output;
  const project = first.projectConfig;
  const deps = first.depsProjectConfigs;
  const modules: SourceModule[] = [...new Map(generated.flatMap(({ output }) =>
    output.modules.map((module) => [module.name, module] as const),
  )).values()];
  const outputs = new Map(generated.map(({ component, output }) =>
    [component.uuid, ensure(output.rootOutput, "No preview root output")] as const,
  ));
  const styleProvider =
    site.styleTokenOverrides.length > 0
      ? project.styleTokensProviderBundle
      : undefined;
  const groups = allGlobalVariantGroups(site, {
    includeDeps: "all",
    excludeEmpty: true,
    excludeMediaQuery: true,
  });
  let root = `<Component key={board.uuid} {...board.props} {...board.variants} ${makePlasmicIsPreviewRootComponent()}={true} />`;
  if (styleProvider) {
    root = `<StyleTokensProvider>${root}</StyleTokensProvider>`;
  }
  if (project.globalContextBundle) {
    root = `<GlobalProviders>${root}</GlobalProviders>`;
  }
  for (const group of groups) {
    root = wrapGlobalProviderWithCustomValue(
      group,
      root,
      false,
      `board.global.${toVarName(group.param.variable.name)}`,
    );
  }
  const boardSources = artboards.map((frame, i) => {
    const props =
      frame.container.vsettings[0]?.args
        .map(
          (arg) =>
            `${JSON.stringify(toVarName(arg.param.variable.name))}:(${getRawCode(arg.expr, { component: frame.container.component, inStudio: false, projectFlags: DEVFLAGS })})`,
        )
        .join(",") ?? "";
    return `${JSON.stringify(frame.uuid)}:{...${JSON.stringify(pages[i])},props:{${props}}}`;
  });
  modules.push({
    name: "./cover-root.tsx",
    lang: "tsx",
    source: `
 import React from 'react';
 const PageParamsProvider = window.__Sub.PageParamsProvider;
 ${[...new Set(components)].map((c, i) => `import Page${i} from './${ensure(outputs.get(c.uuid), "Root module").skeletonModuleFileName}';`).join("\n")}
 ${project.globalContextBundle ? "import GlobalProviders from './PlasmicGlobalProviders';" : ""}
 const components = {${[...new Set(components)].map((c, i) => `${JSON.stringify(c.uuid)}:Page${i}`).join(",")}};
 const boards = {${boardSources.join(",")}};
 ${makeGlobalGroupImports(groups, { idFileNames: true })}
 ${deps.map((d) => `import './${d.cssFileName}';`).join("\n")}
 ${styleProvider ? `import {StyleTokensProvider} from './${styleProvider.fileName}';` : ""}
 export function __run(){window.__renderCover=async(id)=>{
   const board=boards[id];
   const Component=components[board.componentId];
   let content=${root};
   if(board.page){content=<PageParamsProvider {...board.page}>{content}</PageParamsProvider>;}
   let failure;
   const dispose=window.__Sub.hostUtils.registerRenderErrorListener(error=>{failure=error;});
   try{await window.__plasmicLive.renderRoot(content);if(failure)throw failure;}finally{dispose();}
 };}
 `,
  });
  return { pages, modules, site };
}
export async function load(request: PreviewRequest) {
  applyDevFlagOverrides(request.flags);
  const payload = await prepare(request);
  const doc = document;
  stylesheetTracker(doc); // Observe imports before runtime scripts or generated CSS insert them.
  const win = window as Window & Record<string, any>;
  await waitForLiveHost(win);
  inject(doc, await getReactWebBundle());
  inject(doc, await getCanvasPkgs());
  const builtinRuntime = {
    ...win.__Sub,
    reactWeb: win.__PlasmicReactWebBundle,
    dataSources: win.__PlasmicDataSourcesBundle,
    dataSourcesContext: win.__PlasmicDataSourcesContextBundle,
  };
  win.__PlasmicBuiltinRegistry = Object.values(
    getBuiltinComponentRegistrations(builtinRuntime),
  );
  initPreviewInteractionGlobals(win);
  inject(doc, await getLiveFrameClientJs());
  win.__Sub.hostUtils.registerRenderErrorListener((error: Error) => {
    window.parent.postMessage(
      { channel: previewChannel, type: "error", message: String(error) },
      location.origin,
    );
  });
  for (const [, module] of await getSortedHostLessPkgs(
    usedHostLessPkgs(payload.site),
    getVersionForCanvasPackages(win),
    payload.site,
    // Injected above, so the guarded copy for library modules would never run.
    { canvasRuntimeLoaded: true },
  )) {
    inject(doc, module);
  }
  const styleNode = doc.createElement("style");
  styleNode.textContent =
    "*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}html,body{margin:0;overflow:hidden!important}";
  doc.head.append(styleNode);
  let dispose = () => {};
  const rendered = new Promise<void>((resolve, reject) => {
    dispose = syncPreview(win, () => ({ modules: payload.modules, render: { run: "./cover-root.tsx" } }),
      (error) => error ? reject(error) : resolve());
  });
  try {
    await withTimeout(rendered, "Preview timed out", 30000);
  } finally {
    dispose();
  }
  await new Promise<void>((resolve) =>
    win.requestAnimationFrame(() => win.requestAnimationFrame(() => resolve())),
  );
  return payload;
}

const stylesheetTrackers = new WeakMap<Document, ReturnType<typeof observeStylesheets>>();
function stylesheetTracker(doc: Document) {
  let tracker = stylesheetTrackers.get(doc);
  if (!tracker) { tracker = observeStylesheets(doc); stylesheetTrackers.set(doc, tracker); }
  return tracker;
}
export function observeStylesheets(doc: Document) {
  const pending = new Set<Promise<void>>();
  const cleanups = new Set<() => void>();
  const versions = new WeakMap<Element, string>();
  let failure: unknown;
  const watch = (element: Element) => {
    if (!element.matches('style,link[rel~="stylesheet"]')) return;
    const style = element as HTMLStyleElement | HTMLLinkElement;
    if (style.disabled || (style.media && !matchMedia(style.media).matches)) return;
    if (element.tagName === "STYLE" && style.sheet && ![...(style.sheet.cssRules)].some((rule) => rule.type === CSSRule.IMPORT_RULE && (!(rule as CSSImportRule).media.mediaText || matchMedia((rule as CSSImportRule).media.mediaText).matches))) return;
    const version = element.textContent + element.getAttribute("href");
    if (versions.get(element) === version) return;
    versions.set(element, version);
    const task = new Promise<void>((resolve, reject) => {
      const cleanup = () => { element.removeEventListener("load", loaded); element.removeEventListener("error", failed); cleanups.delete(cleanup); };
      const loaded = () => { cleanup(); resolve(); };
      const failed = () => { cleanup(); reject(new Error("Preview stylesheet failed to load")); };
      element.addEventListener("load", loaded); element.addEventListener("error", failed); cleanups.add(cleanup);
    });
    pending.add(task);
    // Keep errors observable by wait() even if the event precedes capture readiness.
    void task.then(() => pending.delete(task), (error) => { failure = error; pending.delete(task); });
  };
  const observer = new MutationObserver((records) => {
    for (const record of records) {
      const parent = record.target.nodeType === Node.ELEMENT_NODE ? record.target as Element : record.target.parentElement;
      if (parent?.matches("style")) watch(parent);
      for (const node of record.addedNodes) if (node.nodeType === Node.ELEMENT_NODE) {
        const element = node as Element; watch(element);
        element.querySelectorAll('style,link[rel~="stylesheet"]').forEach(watch);
      }
    }
  });
  observer.observe(doc.documentElement, { childList: true, subtree: true, characterData: true });
  const dispose = () => { observer.disconnect(); cleanups.forEach((cleanup) => cleanup()); cleanups.clear(); };
  return {
    dispose,
    async wait() {
      try {
        await withTimeout((async () => {
          // Mutation callbacks run before this continuation, including cached CSS loads.
          await Promise.resolve();
          while (pending.size) await Promise.all([...pending]);
          if (failure) throw failure;
        })(), "Preview stylesheet timed out", 30000);
      } catch (error) { failure = error; dispose(); throw error; }
    },
  };
}
export async function ready() {
  const styles = stylesheetTracker(document);
  await new Promise<void>((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
  );
  await styles.wait();
  // Imported CSS can discover fonts only after it has loaded and layout has run.
  await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
  await document.fonts.ready;
  await Promise.all([...document.images].map((i) => i.decode()));
  await new Promise<void>((resolve) => setTimeout(resolve, 150));
}
