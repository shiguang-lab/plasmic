import {
  rasterize,
  snapshot,
} from "@/wab/client/components/dashboard/preview/snapshot";
import {
  createCodeComponentHelperModule,
  createCodeComponentModule,
  createComponentModules,
  createComponentOutput,
  createCustomFunctionsModule,
  createDepsProjectMods,
  createDepsProjectOutput,
  createGlobalVariantGroupModule,
  createIconAssetModule,
  createProjectMods,
  createProjectOutput,
  updateModules,
  type CodeModule,
} from "@/wab/client/components/live/live-syncer";
import type { GetProjectResponse } from "@/wab/shared/ApiSchema";
import { getArenaFrames, getFrameHeight } from "@/wab/shared/Arenas";
import { FastBundler } from "@/wab/shared/bundler";
import { componentToDeepReferenced } from "@/wab/shared/cached-selectors";
import { getBuiltinComponentRegistrations } from "@/wab/shared/code-components/builtin-code-components";
import { isCodeComponentWithHelpers } from "@/wab/shared/code-components/code-components";
import { extractUsedIconAssetsForComponents } from "@/wab/shared/codegen/image-assets";
import { exportStyleConfig } from "@/wab/shared/codegen/react-p";
import { ensure } from "@/wab/shared/common";
import { isCodeComponent } from "@/wab/shared/core/components";
import { walkDependencyTree } from "@/wab/shared/core/project-deps";
import { allGlobalVariantGroups } from "@/wab/shared/core/sites";
import { initBuiltinActions } from "@/wab/shared/core/states";
import { unbundleSite } from "@/wab/shared/core/tagged-unbundle";
import { deepTrackComponents, getOwnerSite } from "@/wab/shared/core/tpls";
import { DEVFLAGS, applyDevFlagOverrides } from "@/wab/shared/devflags";

const libraryNames = ["antd6", "overseas", "react-ui"];
const timings: Record<string, unknown>[] = [];
async function source(url: string) {
  const r = await fetch(url);
  if (!r.ok) {
    throw new Error(`${url}: ${r.status}`);
  }
  return r.text();
}
function inject(doc: Document, text: string) {
  const script = doc.createElement("script");
  script.textContent = text;
  doc.body.append(script);
}
async function prepare(id: string) {
  const start = performance.now();
  const data: GetProjectResponse = await fetch(`/fixture/${id}.json`).then(
    (r) => r.json(),
  );
  const downloaded = performance.now();
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
  const unbundled = performance.now();
  const arena = site.arenas.find((a) => a.children.length > 0);
  // A saved free canvas is the scope. Page arenas are only a fallback for projects without one.
  const artboards = arena
    ? arena.children
    : site.pageArenas.map((pageArena) =>
        ensure(
          getArenaFrames(pageArena, true).sort((a, b) => b.width - a.width)[0],
          "No artboard",
        ),
      );
  const pages = artboards.map((f, index) => ({
    uuid: f.uuid,
    componentId: f.container.component.uuid,
    name: f.name || f.container.component.name,
    width: f.width,
    height: getFrameHeight(f),
    left: f.left ?? (index % 2) * (f.width + 80),
    top: f.top ?? Math.floor(index / 2) * (getFrameHeight(f) + 80),
  }));
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
  modules.push({
    name: "./cover-root.tsx",
    lang: "tsx",
    run: true,
    source: `
 import React from 'react';
 ${[...new Set(components)].map((c, i) => `import Page${i} from './${ensure(outputs.get(c.uuid), "Root module").skeletonModuleFileName}';`).join("\n")}
 const pages = {${[...new Set(components)].map((c, i) => `${JSON.stringify(c.uuid)}:Page${i}`).join(",")}};
 ${deps.map((d) => `import './${d.cssFileName}';`).join("\n")}
 ${styleProvider ? `import {StyleTokensProvider} from './${styleProvider.fileName}';` : ""}
 export function __run(){window.__renderCover=(id)=>{const Component=pages[id];window.__Sub.hostUtils.setPlasmicRootNode(${styleProvider ? "<StyleTokensProvider><Component key={id} /></StyleTokensProvider>" : "<Component key={id} />"});};window.postMessage({source:'cover-probe',type:'rendered'},'*');}
 `,
  });
  const result = {
    id,
    name: data.project.name,
    revision: data.rev.revision,
    arena: arena?.name ?? "Pages",
    pages,
    moduleCount: modules.length,
    componentCount: referenced.length,

    modules,
    modelMs: downloaded - start,
    unbundleMs: unbundled - downloaded,
    codegenMs: performance.now() - unbundled,
  };
  timings.push({ ...result, modules: undefined });
  return result;
}
async function load(id: string) {
  const config = await fetch("/fixture/config.json").then((r) => r.json());
  applyDevFlagOverrides(config.config);
  const payload = await prepare(id);
  const doc = document;
  const win = window as Window & Record<string, any>;
  // The existing host loads getlibs asynchronously; wait for its ready resolver.
  if (!win.System?.refreshXModules) {
    await new Promise<void>((resolve) => {
      win.__GetlibsReadyResolver = resolve;
    });
  }
  inject(doc, await source("/static/react-web-bundle/build/client.527c56.js"));
  inject(doc, await source("/static/canvas-packages/build/client.527c56.js"));
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
  inject(doc, await source("/static/live-frame/build/client.527c56.js"));
  for (const name of libraryNames) {
    inject(doc, await source(`/fixture/${name}.js`));
  }
  inject(
    doc,
    await source("/static/canvas-packages/build/antd-icons-v2.527c56.js"),
  );
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
        event.data?.source === "cover-probe" &&
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
  return { ...payload, modules: undefined };
}

async function ready() {
  await new Promise<void>((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
  );
  await document.fonts.ready;
  await Promise.all(
    [...document.images].map((i) => i.decode().catch(() => {})),
  );
  await new Promise<void>((resolve) => setTimeout(resolve, 150));
}
(window as any).coverEngine = {
  load,
  async render(id: string) {
    (window as any).__renderCover(id);
    await ready();
  },
  async capture(width: number, height: number) {
    const shot = await snapshot(document, width, height);
    return {
      blob: await rasterize(shot.svg, width, height),
      stats: shot.stats,
    };
  },
  ready,
  clear() {
    (window as any).__Sub.hostUtils.setPlasmicRootNode(null);
  },
};
