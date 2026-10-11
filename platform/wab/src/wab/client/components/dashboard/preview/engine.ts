import { overviewLayout } from "@/wab/client/components/dashboard/preview/layout";
import {
  rasterize,
  snapshot,
} from "@/wab/client/components/dashboard/preview/snapshot";
import {
  previewCanvasBackground,
  previewChannel,
  type PreviewRequest,
} from "@/wab/client/components/dashboard/preview/types";
import { mkVariantsRecord } from "@/wab/client/components/live/PreviewCtx";
import {
  createCodeComponentHelperModule,
  createCodeComponentModule,
  createComponentModules,
  createComponentOutput,
  createCustomFunctionsModule,
  createDepsProjectMods,
  createDepsProjectOutput,
  createGlobalContextsModules,
  createGlobalVariantGroupModule,
  createIconAssetModule,
  createProjectMods,
  createProjectOutput,
  updateModules,
  type CodeModule,
} from "@/wab/client/components/live/live-syncer";
import {
  getCanvasPkgs,
  getLiveFrameClientJs,
  getReactWebBundle,
  getSortedHostLessPkgs,
  getVersionForCanvasPackages,
} from "@/wab/client/components/studio/studio-bundles";
import type { GetProjectResponse } from "@/wab/shared/ApiSchema";
import {
  getActivatedVariantsForFrame,
  getArenaFrames,
  getFrameHeight,
} from "@/wab/shared/Arenas";
import { isGlobalVariant } from "@/wab/shared/Variants";
import { FastBundler } from "@/wab/shared/bundler";
import {
  componentToDeepReferenced,
  usedHostLessPkgs,
} from "@/wab/shared/cached-selectors";
import { getBuiltinComponentRegistrations } from "@/wab/shared/code-components/builtin-code-components";
import { isCodeComponentWithHelpers } from "@/wab/shared/code-components/code-components";
import { extractUsedIconAssetsForComponents } from "@/wab/shared/codegen/image-assets";
import { exportStyleConfig } from "@/wab/shared/codegen/react-p";
import {
  makeGlobalGroupImports,
  makePlasmicIsPreviewRootComponent,
  wrapGlobalProviderWithCustomValue,
} from "@/wab/shared/codegen/react-p/serialize-utils";
import { toVarName } from "@/wab/shared/codegen/util";
import { ensure } from "@/wab/shared/common";
import { isCodeComponent } from "@/wab/shared/core/components";
import { getRawCode } from "@/wab/shared/core/exprs";
import { walkDependencyTree } from "@/wab/shared/core/project-deps";
import { allGlobalVariantGroups } from "@/wab/shared/core/sites";
import { initBuiltinActions } from "@/wab/shared/core/states";
import { unbundleSite } from "@/wab/shared/core/tagged-unbundle";
import { deepTrackComponents, getOwnerSite } from "@/wab/shared/core/tpls";
import { DEVFLAGS, applyDevFlagOverrides } from "@/wab/shared/devflags";

function inject(doc: Document, text: string) {
  const script = doc.createElement("script");
  script.textContent = text;
  doc.body.append(script);
}
async function prepare(request: PreviewRequest) {
  const id = request.projectId;
  const response = await fetch(
    `/api/v1/projects/${encodeURIComponent(id)}?revisionNum=${request.revision}`,
  );
  if (!response.ok) {
    throw new Error(`Preview project: ${response.status}`);
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
  const project = createProjectOutput(site, data.project.id, data.project.name);
  const deps = createDepsProjectOutput(site);
  const style = exportStyleConfig({ targetEnv: "preview" });
  const modules: CodeModule[] = [
    {
      name: `./${style.defaultStyleCssFileName}`,
      lang: "css",
      source: style.defaultStyleCssRules,
    },
    ...createProjectMods(project),
    ...createDepsProjectMods(deps),
    createCustomFunctionsModule(site),
  ];
  if (project.globalContextBundle) {
    modules.push(
      ...createGlobalContextsModules(
        site.globalContexts.map(
          (tpl) =>
            tpl.component as import("@/wab/shared/core/components").CodeComponent,
        ),
        project.globalContextBundle,
      ),
    );
  }
  const outputs = new Map<string, ReturnType<typeof createComponentOutput>>();
  const referenced = [
    ...new Set(
      components.flatMap((c) => [...componentToDeepReferenced(c, true)]),
    ),
  ];
  const dependencies = walkDependencyTree(site, "all");
  for (const comp of referenced) {
    if (isCodeComponent(comp)) {
      modules.push(createCodeComponentModule(comp, { idFileNames: true }));
      if (isCodeComponentWithHelpers(comp)) {
        modules.push(
          createCodeComponentHelperModule(comp, { idFileNames: true }),
        );
      }
    } else {
      const output = createComponentOutput(
        { site, siteInfo: { appAuthProvider: data.appAuthProvider } },
        comp,
        getOwnerSite(comp) === site
          ? project
          : ensure(
              deps.find(
                (d) =>
                  d.projectId ===
                  dependencies.find((dep) => dep.site === getOwnerSite(comp))
                    ?.projectId,
              ),
              "Dependency config",
            ),
        false,
      );
      outputs.set(comp.uuid, output);
      modules.push(...createComponentModules(output));
    }
  }
  modules.push(
    ...[...extractUsedIconAssetsForComponents(site, referenced)]
      .filter((a) => a.dataUri)
      .map((a) => createIconAssetModule(a)),
  );
  const styleProvider =
    site.styleTokenOverrides.length > 0
      ? project.styleTokensProviderBundle
      : undefined;
  const groups = allGlobalVariantGroups(site, {
    includeDeps: "all",
    excludeEmpty: true,
    excludeMediaQuery: true,
  });
  modules.push(...groups.map((group) => createGlobalVariantGroupModule(group)));
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
    run: true,
    source: `
 import React from 'react';
 ${[...new Set(components)].map((c, i) => `import Page${i} from './${ensure(outputs.get(c.uuid), "Root module").skeletonModuleFileName}';`).join("\n")}
 ${project.globalContextBundle ? "import GlobalProviders from './PlasmicGlobalProviders';" : ""}
 const components = {${[...new Set(components)].map((c, i) => `${JSON.stringify(c.uuid)}:Page${i}`).join(",")}};
 const boards = {${boardSources.join(",")}};
 ${makeGlobalGroupImports(groups, { idFileNames: true })}
 ${deps.map((d) => `import './${d.cssFileName}';`).join("\n")}
 ${styleProvider ? `import {StyleTokensProvider} from './${styleProvider.fileName}';` : ""}
 export function __run(){window.__renderCover=(id)=>{const board=boards[id];const Component=components[board.componentId];window.__Sub.hostUtils.setPlasmicRootNode(${root});};window.postMessage({source:'canvas-preview-root',type:'rendered'},'*');}
 `,
  });
  return { pages, modules, site };
}
async function load(request: PreviewRequest) {
  applyDevFlagOverrides(request.flags);
  const payload = await prepare(request);
  const doc = document;
  const win = window as Window & Record<string, any>;
  // The existing host loads getlibs asynchronously; wait for its ready resolver.
  if (!win.System?.refreshXModules) {
    await new Promise<void>((resolve) => {
      win.__GetlibsReadyResolver = resolve;
    });
  }
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
  // Lodash memoize otherwise keeps the iframe's runtime alive in the parent window.
  getBuiltinComponentRegistrations.cache.delete(builtinRuntime);
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
  )) {
    inject(doc, module);
  }
  const styleNode = doc.createElement("style");
  styleNode.textContent =
    "*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}html,body{margin:0;overflow:hidden!important}";
  doc.head.append(styleNode);
  const rendered = new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      win.removeEventListener("message", listener);
      reject(new Error("Preview timed out"));
    }, 30000);
    function listener(event: MessageEvent) {
      if (
        event.source === win &&
        event.data?.source === "canvas-preview-root" &&
        event.data.type === "rendered"
      ) {
        clearTimeout(timer);
        win.removeEventListener("message", listener);
        resolve();
      } else if (
        event.data?.source === "plasmic-live" &&
        event.data.type === "error"
      ) {
        clearTimeout(timer);
        win.removeEventListener("message", listener);
        reject(new Error(event.data.error?.message ?? "Preview module error"));
      }
    }
    win.addEventListener("message", listener);
  });
  updateModules(doc, payload.modules);
  await rendered;
  await new Promise<void>((resolve) =>
    win.requestAnimationFrame(() => win.requestAnimationFrame(() => resolve())),
  );
  return payload.pages;
}

async function ready() {
  await new Promise<void>((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
  );
  await document.fonts.ready;
  await Promise.all([...document.images].map((i) => i.decode()));
  await new Promise<void>((resolve) => setTimeout(resolve, 150));
}
async function generate(request: PreviewRequest) {
  const pages = await load(request);
  const positions = overviewLayout(pages);
  const canvas = document.createElement("canvas");
  canvas.width = 640;
  canvas.height = 360;
  const ctx = ensure(canvas.getContext("2d"), "Overview context");
  ctx.fillStyle = previewCanvasBackground;
  ctx.fillRect(0, 0, 640, 360);
  try {
    for (let i = 0; i < pages.length; i++) {
      const board = pages[i],
        rect = positions[i];
      const frame = ensure(
        window.frameElement,
        "Preview iframe",
      ) as HTMLElement;
      frame.style.width = `${board.width}px`;
      frame.style.height = `${board.height}px`;
      (window as any).__renderCover(board.uuid);
      await ready();
      const shot = await snapshot(document, board.width, board.height);
      if (shot.stats.assetErrors.length) {
        throw new Error(shot.stats.assetErrors.join("\n"));
      }
      // Decode one source SVG at a time, then draw directly into a thumbnail-sized canvas.
      // Keeping the SVG viewport intact preserves foreignObject CSS in WebKit.
      const image = await rasterize(
        shot.svg,
        Math.max(1, Math.ceil(rect.width)),
        Math.max(1, Math.ceil(rect.height)),
      );
      const bitmap = await createImageBitmap(image);
      try {
        ctx.drawImage(bitmap, rect.left, rect.top, rect.width, rect.height);
      } finally {
        bitmap.close();
      }
      (window as any).__Sub.hostUtils.setPlasmicRootNode(null);
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => resolve()),
      );
    }
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("Preview encoding failed"))),
        "image/png",
      ),
    );
    return await blob.arrayBuffer();
  } finally {
    (window as any).__Sub?.hostUtils.setPlasmicRootNode(null);
    document.querySelectorAll("canvas").forEach((c) => {
      c.width = c.height = 0;
    });
    canvas.width = canvas.height = 0;
  }
}

async function start(event: MessageEvent) {
  if (
    event.source !== window.parent ||
    event.origin !== location.origin ||
    event.data?.channel !== previewChannel ||
    event.data.type !== "start"
  ) {
    return;
  }
  window.removeEventListener("message", start);
  try {
    const bytes = await generate(event.data.request);
    window.parent.postMessage(
      { channel: previewChannel, type: "result", bytes },
      location.origin,
      [bytes],
    );
  } catch (error) {
    window.parent.postMessage(
      { channel: previewChannel, type: "error", message: String(error) },
      location.origin,
    );
  }
}
window.addEventListener("message", start);
window.parent.postMessage(
  { channel: previewChannel, type: "ready" },
  location.origin,
);
