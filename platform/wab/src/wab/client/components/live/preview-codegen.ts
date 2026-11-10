import type {
  PreviewRender,
  PreviewUpdate,
  SourceModule,
} from "@/wab/client/components/live/preview-types";
import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { ProjectId } from "@/wab/shared/ApiSchema";
import { getSlotParams } from "@/wab/shared/SlotUtils";
import {
  VariantGroupType,
  getReferencedVariantGroups,
} from "@/wab/shared/Variants";
import {
  allCodeLibraries,
  allCustomFunctions,
  componentToDeepReferenced,
} from "@/wab/shared/cached-selectors";
import {
  CodeComponentWithHelpers,
  isCodeComponentWithHelpers,
} from "@/wab/shared/code-components/code-components";
import {
  ComponentGenHelper,
  SiteGenHelper,
} from "@/wab/shared/codegen/codegen-helpers";
import {
  exportIconAsset,
  extractUsedIconAssetsForComponents,
} from "@/wab/shared/codegen/image-assets";
import {
  computeSerializerSiteContext,
  exportProjectConfig,
  exportReactPresentational,
  exportStyleConfig,
} from "@/wab/shared/codegen/react-p";
import {
  codeLibraryImportAlias,
  customFunctionImportAlias,
} from "@/wab/shared/codegen/react-p/custom-functions";
import {
  makeCodeComponentHelperSkeletonIdFileName,
  makeComponentSkeletonIdFileName,
  makeGlobalVariantIdFileName,
} from "@/wab/shared/codegen/react-p/serialize-utils";
import {
  ComponentExportOutput,
  ExportOpts,
  GlobalContextBundle,
  ProjectConfig,
  StyleTokensProviderBundle,
} from "@/wab/shared/codegen/types";
import { jsLiteral, toVarName } from "@/wab/shared/codegen/util";
import {
  exportGlobalVariantGroup,
  extractUsedGlobalVariantsForComponents,
  makeGlobalVariantGroupContextProviderName,
} from "@/wab/shared/codegen/variants";
import { ensure } from "@/wab/shared/common";
import {
  CodeComponent,
  getCodeComponentHelperImportName,
  getCodeComponentImportName,
  isCodeComponent,
  isPageComponent,
} from "@/wab/shared/core/components";
import { ExprCtx, getRawCode } from "@/wab/shared/core/exprs";
import { ImageAssetType } from "@/wab/shared/core/image-asset-type";
import {
  getDependenciesWithReferencedCss,
  walkDependencyTree,
} from "@/wab/shared/core/project-deps";
import {
  allGlobalVariantGroups,
  allImageAssets,
} from "@/wab/shared/core/sites";
import { CssVarResolver } from "@/wab/shared/core/styles";
import { getOwnerSite } from "@/wab/shared/core/tpls";
import { DEVFLAGS } from "@/wab/shared/devflags";
import { LocalizationConfig } from "@/wab/shared/localization";
import {
  Component,
  ImageAsset,
  Site,
  VariantGroup,
  isKnownPropParam,
} from "@/wab/shared/model/classes";
import { getPlumeEditorPlugin } from "@/wab/shared/plume/plume-registry";
import type { ModelCommit } from "@/wab/client/studio-ctx/StudioCtx";
import { isKnownArena, isKnownArenaFrame, isKnownComponent } from "@/wab/shared/model/classes";

export interface PreviewCodegenContext {
  site: Site;
  siteInfo: Pick<StudioCtx["siteInfo"], "id" | "name" | "appAuthProvider">;
  subscribeModelChanges?: StudioCtx["subscribeModelChanges"];
  projectMetadataStore?: StudioCtx["projectMetadataStore"];
}

export interface PreviewRoute {
  component?: Component;
  previewPath: string;
  variants: Record<string, unknown>;
  globals: Record<string, unknown>;
  pageParams?: Record<string, string | string[]>;
  pageQuery: Record<string, string | string[]>;
  appUser: Extract<PreviewRender, { root: string }>["appUser"];
}

/** Modules for the root, every component it renders, and their projects. */
function buildComponentModules(
  studioCtx: PreviewCodegenContext,
  rootComponent: Component | undefined,
  exportNamedNodeComponents: boolean,
) {
  const site = studioCtx.site;
  const styleOutput = exportStyleConfig({ targetEnv: "preview" });
  const cache = getCodegenCache(studioCtx);
  const { projectConfig, depsProjectConfigs } = cache.projects ??= {
    projectConfig: createProjectOutput(site, studioCtx.siteInfo.id, studioCtx.siteInfo.name),
    depsProjectConfigs: createDepsProjectOutput(site),
  };
  const components = new Set<Component>(
    rootComponent
      ? [rootComponent, ...extractDependentComponents(rootComponent)]
      : [],
  );
  const componentOutputs = new Map<Component, ComponentExportOutput>();
  const modules: SourceModule[] = [
    {
      name: `./${styleOutput.defaultStyleCssFileName}`,
      lang: "css",
      source: styleOutput.defaultStyleCssRules,
    },
    ...createProjectMods(projectConfig),
    ...createDepsProjectMods(depsProjectConfigs),
    ...createReferencedComponentModules(
      studioCtx,
      components,
      projectConfig,
      depsProjectConfigs,
      componentOutputs,
      exportNamedNodeComponents,
    ),
    createCustomFunctionsModule(site),
  ];
  return { modules, projectConfig, depsProjectConfigs, components, componentOutputs };
}

function createReferencedComponentModules(
  studioCtx: PreviewCodegenContext,
  components: Iterable<Component>,
  projectConfig: ProjectConfig,
  depsProjectConfigs: ProjectConfig[],
  componentOutputs: Map<Component, ComponentExportOutput>,
  exportNamedNodeComponents: boolean,
) {
  const modules: SourceModule[] = [];
  for (const component of components) {
    if (isCodeComponent(component)) {
      modules.push(createCodeComponentModule(component, { idFileNames: true }));
      if (isCodeComponentWithHelpers(component)) {
        modules.push(
          createCodeComponentHelperModule(component, { idFileNames: true }),
        );
      }
    } else {
      // Components from imported projects must use their own project's config, not the current project's.
      // This ensures each component imports its own project CSS (project_{projectId}.css) which contains
      // the correct theme default styles (root_reset, default tag styles, etc.) for that project.
      // Without this, imported components would incorrectly reference the current project's theme,
      // causing wrong colors, fonts, and other default styles to be applied.
      const componentProjectConfig =
        getOwnerSite(component) === studioCtx.site
          ? projectConfig
          : getComponentProjectConfig(studioCtx, component, depsProjectConfigs);
      const cache = getCodegenCache(studioCtx);
      let entries = cache.componentOutputs.get(component);
      if (!entries) { entries = new Map(); cache.componentOutputs.set(component, entries); }
      let entry = entries.get(exportNamedNodeComponents);
      if (!entry) {
        const output = createComponentOutput(studioCtx, component, componentProjectConfig, false, exportNamedNodeComponents);
        entry = { output, modules: createComponentModules(output), dependencies: extractDependentComponents(component) };
        entries.set(exportNamedNodeComponents, entry);
      }
      componentOutputs.set(component, entry.output);
      modules.push(...entry.modules);
    }
  }
  return modules;
}

function generatePreviewModules(
  studioCtx: PreviewCodegenContext,
  rootComponent?: Component,
) {
  const site = studioCtx.site;
  const { componentOutputs, ...result } = buildComponentModules(studioCtx, rootComponent, false);
  const { modules, projectConfig, components } = result;
  const rootOutput = rootComponent ? componentOutputs.get(rootComponent) : undefined;
  modules.push(
    ...[...extractUsedIconAssetsForComponents(site, [...components])]
      .filter((asset) => asset.dataUri)
      .map((asset) => createIconAssetModule(asset)),
    ...processGlobalContexts(studioCtx, projectConfig),
    ...allGlobalVariantGroups(site, {
      includeDeps: "all",
      excludeEmpty: true,
      excludeInactiveScreenVariants: true,
      includeActiveScreenVariantsFromDeps: true,
    }).map((group) => createGlobalVariantGroupModule(group)),
  );
  return { ...result, rootOutput };
}

function generateDocsPreviewModules(
  studioCtx: PreviewCodegenContext,
  component: Component | undefined,
  usePlasmicImg: boolean,
) {
  const site = studioCtx.site;
  const { componentOutputs: _componentOutputs, ...result } = buildComponentModules(studioCtx, component, true);
  const globalGroups = [
    ...getReferencedVariantGroups(
      extractUsedGlobalVariantsForComponents(
        site,
        [...result.components],
        usePlasmicImg,
      ),
    ),
  ];
  result.modules.push(
    // Custom code in the docs editor can use any icon.
    ...allImageAssets(site, { includeDeps: "direct" })
      .filter((asset) => asset.type === ImageAssetType.Icon && asset.dataUri)
      .map((asset) => createIconAssetModule(asset)),
    ...globalGroups.map((group) => createGlobalVariantGroupModule(group)),
  );
  return { ...result, globalGroups };
}

type PreviewModules = ReturnType<typeof generatePreviewModules>;
type DocsModules = ReturnType<typeof generateDocsPreviewModules>;

/** Codegen entries belong to a Studio and a root; completed model changes
 * invalidate the affected roots before any preview subscriber runs. */
class PreviewCodegenCache {
  readonly live = new Map<Component | undefined, PreviewModules>();
  readonly docs = new Map<Component | undefined, Map<boolean, DocsModules>>();
  readonly componentOutputs = new Map<Component, Map<boolean, { output: ComponentExportOutput; modules: SourceModule[]; dependencies: Set<Component> }>>();
  projects: { projectConfig: ProjectConfig; depsProjectConfigs: ProjectConfig[] } | undefined;
  private readonly listeners = new Set<{ root: () => Component | undefined; listener: () => void }>();
  private readonly dirtyRoots = new Set<Component>();
  constructor(private readonly ctx: PreviewCodegenContext) {}

  reset() {
    this.live.clear();
    this.docs.clear();
    this.componentOutputs.clear();
    this.projects = undefined;
    for (const { listener } of this.listeners) { listener(); }
  }

  sync(event: ModelCommit) {
    if (event.type === "site-replaced") {
      this.reset();
      return;
    }
    const { summary } = event;
    if (!summary.changes.length) { return; }
    // Arena viewport/selection/presentation metadata does not participate in codegen.
    // Every other project resource is emitted by project CSS, global providers,
    // custom functions, or can affect serializers for the rendered component tree.
    const projectChanged = this.ctx.site.globalContexts.some((tpl) => summary.updatedComponents.has(tpl.component)) || summary.changes.some((change) => {
      const path = change.path ?? [change.changeNode];
      return !path.some(({ inst }) => isKnownComponent(inst) || isKnownArena(inst) || isKnownArenaFrame(inst));
    });
    this.dirtyRoots.clear();
    for (const root of summary.deepUpdatedComponents) { this.dirtyRoots.add(root); }
    for (const root of summary.updatedComponents) { this.dirtyRoots.add(root); }
    const affected = (root: Component | undefined) => {
      if (projectChanged || (!!root && this.dirtyRoots.has(root))) { return true; }
      const entry = this.live.get(root) ?? this.docs.get(root)?.values().next().value;
      return !!entry && [...entry.components].some((component) => this.dirtyRoots.has(component));
    };
    const pendingListeners = [...this.listeners].filter(({ root }) => affected(root()));
    for (const root of this.live.keys()) { if (affected(root)) { this.live.delete(root); } }
    for (const root of this.docs.keys()) { if (affected(root)) { this.docs.delete(root); } }
    if (projectChanged) { this.componentOutputs.clear(); }
    else {
      for (const [component, entries] of this.componentOutputs) {
        if (this.dirtyRoots.has(component) || [...entries.values()].some((entry) => [...entry.dependencies].some((dependency) => this.dirtyRoots.has(dependency)))) {
          this.componentOutputs.delete(component);
        }
      }
    }
    // Project CSS includes fonts used throughout the site, including components
    // outside the rendered root. A component edit must refresh that projection.
    if (projectChanged || this.dirtyRoots.size) { this.projects = undefined; }
    for (const { listener } of pendingListeners) { listener(); }
  }

  subscribe(root: () => Component | undefined, listener: () => void) {
    const entry = { root, listener };
    this.listeners.add(entry);
    return () => { this.listeners.delete(entry); };
  }
}

const codegenCaches = new WeakMap<PreviewCodegenContext, PreviewCodegenCache>();
function getCodegenCache(ctx: PreviewCodegenContext) {
  let cache = codegenCaches.get(ctx);
  if (!cache) {
    cache = new PreviewCodegenCache(ctx);
    codegenCaches.set(ctx, cache);
    ctx.subscribeModelChanges?.((event) => cache?.sync(event));
    ctx.projectMetadataStore?.subscribe((next, previous) => {
      if (next.id !== previous.id || next.name !== previous.name || next.appAuthProvider !== previous.appAuthProvider) { cache?.reset(); }
    });
  }
  return cache;
}

export function subscribePreviewCodegen(
  ctx: PreviewCodegenContext,
  root: () => Component | undefined,
  listener: () => void,
) {
  return getCodegenCache(ctx).subscribe(root, listener);
}

export function buildPreviewModules(ctx: PreviewCodegenContext, root?: Component): PreviewModules {
  const cache = getCodegenCache(ctx);
  let result = cache.live.get(root);
  if (!result) {
    result = generatePreviewModules(ctx, root);
    cache.live.set(root, result);
  }
  return { ...result, modules: result.modules.slice() };
}

export function buildDocsPreviewModules(ctx: PreviewCodegenContext, root: Component | undefined, usePlasmicImg: boolean): DocsModules {
  const cache = getCodegenCache(ctx);
  let entries = cache.docs.get(root);
  if (!entries) { entries = new Map(); cache.docs.set(root, entries); }
  let result = entries.get(usePlasmicImg);
  if (!result) {
    result = generateDocsPreviewModules(ctx, root, usePlasmicImg);
    entries.set(usePlasmicImg, result);
  }
  return { ...result, modules: result.modules.slice() };
}

export function buildPreviewUpdate(
  studioCtx: PreviewCodegenContext,
  route: PreviewRoute,
): PreviewUpdate {
  const { modules, projectConfig, depsProjectConfigs, rootOutput, components } =
    buildPreviewModules(
      studioCtx,
      // The previewed component can be deleted while it is open
      route.component && studioCtx.site.components.includes(route.component)
        ? route.component
        : undefined,
    );
  if (!rootOutput) {
    return { modules, render: { notFound: route.previewPath } };
  }
  const referencedDepIds = new Set(
    getDependenciesWithReferencedCss(studioCtx.site, [...components]).map(
      (dep) => dep.projectId,
    ),
  );
  const { propsModule, render } = createPreviewRender(
    rootOutput,
    studioCtx,
    route,
    depsProjectConfigs.filter((cfg) => referencedDepIds.has(cfg.projectId)),
    projectConfig.globalContextBundle,
    projectConfig.hasStyleTokenOverrides
      ? projectConfig.styleTokensProviderBundle
      : undefined,
  );
  modules.push(propsModule);
  return { modules, render };
}

function processGlobalContexts(
  studioCtx: PreviewCodegenContext,
  projectConfig: ProjectConfig,
) {
  if (projectConfig.globalContextBundle) {
    const contexts = studioCtx.site.globalContexts.map(
      (tpl) => tpl.component as CodeComponent,
    );
    return createGlobalContextsModules(
      contexts,
      projectConfig.globalContextBundle,
    );
  } else {
    return [];
  }
}

function extractDependentComponents(component: Component) {
  const referencedComps = new Set<Component>();
  const seen = new Set<Component>();

  /**
   * Add all components that this comp references (but not itself) to comps
   */
  const check = (comp: Component) => {
    if (seen.has(comp)) {
      return;
    }

    seen.add(comp);

    // First check for components that are deeply  used by this comp
    for (const dep of componentToDeepReferenced(comp)) {
      check(dep);
      referencedComps.add(dep);
    }

    // Next, generated code for this component will also need to reference
    // its super component (to read from its context).  So also add reference
    // to its super component, and _its_ deep dependencies
    if (comp.superComp) {
      referencedComps.add(comp.superComp);
      check(comp.superComp);
    }

    for (const subComp of comp.subComps) {
      referencedComps.add(subComp);
      check(subComp);
    }
  };

  check(component);
  return referencedComps;
}

function createComponentModules(output: ComponentExportOutput) {
  return [
    {
      name: `./${output.renderModuleFileName}`,
      lang: "tsx",
      source: output.renderModule,
      jsxPragma: "createPlasmicElementProxy",
    },
    {
      name: `./${output.skeletonModuleFileName}`,
      lang: "tsx",
      source: output.skeletonModule,
    },
    {
      name: `./${output.cssFileName}`,
      lang: "css",
      source: output.cssRules,
    },
  ];
}

function createCodeComponentHelperModule(
  component: CodeComponentWithHelpers,
  opts?: { idFileNames?: boolean },
) {
  const importName = getCodeComponentHelperImportName(component);
  const mkImpl = (): string => {
    return `([...(window as any).__PlasmicComponentRegistry, ...((window as any).__PlasmicBuiltinRegistry ?? [])]).find(
      ({meta}) => meta.name === ${jsLiteral(component.name)}
    ).meta.componentHelpers?.helpers`;
  };
  const source = `
  ${DEVFLAGS.ccStubs ? `import React from "react";` : ""}
  ${
    component.codeComponentMeta.helpers?.defaultExport ? "" : "export "
  }const ${importName} = ${mkImpl()};
  ${
    component.codeComponentMeta.helpers?.defaultExport
      ? `export default ${importName}`
      : ""
  }
  `;
  const fileName = opts?.idFileNames
    ? makeCodeComponentHelperSkeletonIdFileName(component)
    : importName;
  return {
    name: `./${fileName}.tsx`,
    lang: "tsx",
    source,
  };
}

function codeComponentNotFoundMessage(name: string) {
  return `[host-app-error] Code component '${name}' was not found in the current host app.`;
}

function createCodeComponentModule(
  component: CodeComponent,
  opts?: { idFileNames?: boolean },
) {
  const importName = getCodeComponentImportName(component);
  const mkImpl = (): string => {
    if (DEVFLAGS.ccStubs) {
      const slotNames = getSlotParams(component).map(
        (param) => param.variable.name,
      );
      return `(props: {}) => {
        const slotNames = ${JSON.stringify(slotNames)}
        const filteredProps = Object.fromEntries(Object.entries(props).filter(([key]) => !slotNames.includes(key)));
        return (<div {...filteredProps}>{slotNames.map((name) => props[name]).filter((v) => v != null)}</div>);
      }`;
    } else {
      return `ensure(
        ([
          ...(window as any).__PlasmicComponentRegistry,
          ...((window as any).__PlasmicContextRegistry ?? []),
          ...((window as any).__PlasmicBuiltinRegistry ?? [])
        ]).find(
          ({meta}) => meta.name === ${jsLiteral(component.name)}
        )
      , "${codeComponentNotFoundMessage(component.name)}").component`;
    }
  };
  const source = `
  ${DEVFLAGS.ccStubs ? `import React from "react";` : ""}
  const ensure = (x: any, msg: string) => {
    if (x === undefined || x === null) {
      throw new Error(msg);
    }
    return x;
  };
  ${
    component.codeComponentMeta.defaultExport ? "" : "export "
  }const ${importName} = ${mkImpl()};
  ${
    component.codeComponentMeta.defaultExport
      ? `export default ${importName}`
      : ""
  }
  `;
  const fileName = opts?.idFileNames
    ? makeComponentSkeletonIdFileName(component)
    : importName;
  return {
    name: `./${fileName}.tsx`,
    lang: "tsx",
    source,
  };
}

function createGlobalContextsModules(
  contexts: CodeComponent[],
  globalContextsBundle: GlobalContextBundle,
) {
  return [
    ...contexts.map((c) => createCodeComponentModule(c, { idFileNames: true })),
    {
      name: `./PlasmicGlobalProviders.tsx`,
      lang: "tsx",
      source: globalContextsBundle.contextModule,
    },
  ];
}

function createPreviewRender(
  rootOutput: ComponentExportOutput,
  studioCtx: PreviewCodegenContext,
  route: PreviewRoute,
  depProjectConfigs: ProjectConfig[],
  globalContextsBundle?: GlobalContextBundle,
  styleTokensProviderBundle?: StyleTokensProviderBundle,
): { propsModule: SourceModule; render: PreviewRender } {
  const component = ensure(
    studioCtx.site.components.find((c) => c.uuid === rootOutput.id),
    `Component being preview is expected to be in site, but there is no component with UUID ${rootOutput.id}`,
  );
  const globalGroups = allGlobalVariantGroups(studioCtx.site, {
    includeDeps: "all",
    excludeEmpty: true,
    excludeMediaQuery: true,
  }).filter((vg) => vg.type !== VariantGroupType.GlobalScreen);

  const serializedInitialProps: Record<string, string> = Object.fromEntries(
    Object.entries(route.variants).map(([key, val]) => [
      toVarName(key),
      JSON.stringify(val),
    ]),
  );

  // Use prop preview values in live preview.
  const exprCtx: ExprCtx = {
    component: null,
    projectFlags: DEVFLAGS,
    inStudio: false,
  };
  for (const param of component.params) {
    if (!isKnownPropParam(param) || !param.previewExpr) {
      continue;
    }
    serializedInitialProps[toVarName(param.variable.name)] = getRawCode(
      param.previewExpr,
      exprCtx,
    );
  }

  const plugin = getPlumeEditorPlugin(component);
  if (plugin?.getArtboardRootDefaultProps) {
    const defaults = plugin.getArtboardRootDefaultProps(component);
    if (defaults) {
      for (const [key, val] of Object.entries(defaults)) {
        serializedInitialProps[key] = JSON.stringify(val);
      }
    }
  }

  return {
    propsModule: {
      name: "./preview-props.tsx",
      lang: "tsx",
      source: `export default {
        ${Object.entries(serializedInitialProps)
          .map(([key, val]) => `${key}: ${val}`)
          .join(",\n")}
      };`,
    },
    render: {
      root: `./${rootOutput.skeletonModuleFileName}`,
      componentUuid: component.uuid,
      isPage: rootOutput.isPage,
      // The referenced dependencies' project CSS, including ones with no
      // rendered component (e.g. one contributing just a token or animation).
      depCss: depProjectConfigs.map((dep) => `./${dep.cssFileName}`),
      propsModule: "./preview-props.tsx",
      globalContexts: globalContextsBundle && "./PlasmicGlobalProviders",
      styleTokensProvider:
        styleTokensProviderBundle && `./${styleTokensProviderBundle.fileName}`,
      globalVariants: globalGroups.map((vg) => ({
        module: `./${makeGlobalVariantIdFileName(vg)}`,
        provider: makeGlobalVariantGroupContextProviderName(vg),
        prop: toVarName(vg.param.variable.name),
      })),
      page: isPageComponent(component)
        ? {
            route: component.pageMeta.path,
            params: route.pageParams,
            query: route.pageQuery,
          }
        : undefined,
      globals: route.globals,
      appUser: route.appUser,
    },
  };
}

function getComponentProjectConfig(
  studioCtx: PreviewCodegenContext,
  component: Component,
  depProjectConfigs: ProjectConfig[],
): ProjectConfig {
  const dep = walkDependencyTree(studioCtx.site, "all").find(
    (candidate) => candidate.site === getOwnerSite(component),
  );
  if (!dep) {
    throw new Error(
      `Could not find project dependency for component ${component.name}`,
    );
  }

  return ensure(
    depProjectConfigs.find(
      (projectConfig) => projectConfig.projectId === dep.projectId,
    ),
    `Dependency project config must exists for component ${component.uuid}`,
  );
}

function createProjectOutput(
    site: Site,
    projectId: ProjectId,
    projectName: string,
  ) {
    const exportOpts: ExportOpts = {
      lang: "ts",
      platform: "react",
      forceAllProps: true,
      uncontrolledProps: true,
      shouldTransformWritableStates: true,
      forceRootDisabled: false,
      imageOpts: {
        scheme: "cdn",
      },
      localization:
        site.flags.usePlasmicTranslation && site.flags.keyScheme
          ? ({
              keyScheme: site.flags.keyScheme,
              tagPrefix: site.flags.tagPrefix,
            } as LocalizationConfig)
          : undefined,
      stylesOpts: { scheme: "css" },
      codeOpts: { reactRuntime: "classic" },
      fontOpts: { scheme: "import" },
      codeComponentStubs: false,
      skinnyReactWeb: false,
      skinny: false,
      importHostFromReactWeb: false,
      idFileNames: true,
      hostLessComponentsConfig: "stub",

      relPathFromManagedToImplDir: ".",
      useComponentSubstitutionApi: false,
      useGlobalVariantsSubstitutionApi: false,
      useCodeComponentHelpersRegistry: false,
      useCustomFunctionsStub: true,
      isLivePreview: true,
      targetEnv: "preview",
    };
    return exportProjectConfig(
      site,
      projectName,
      projectId,
      0,
      "fakeProjectRevId",
      "latest",
      exportOpts,
    );
}

function createComponentOutput(
    studioCtx: PreviewCodegenContext,
    component: Component,
    projectConfig: ProjectConfig,
    forceRootDisabled: boolean,
    exportNamedNodeComponents: boolean,
  ) {
    const exportOpts: ExportOpts = {
      lang: "ts",
      platform: "react",
      forceAllProps: true,
      uncontrolledProps: true,
      shouldTransformWritableStates: true,
      forceRootDisabled: forceRootDisabled,
      exportNamedNodeComponents,
      imageOpts: {
        scheme: "cdn",
      },
      localization:
        studioCtx.site.flags.usePlasmicTranslation &&
        studioCtx.site.flags.keyScheme
          ? ({
              keyScheme: studioCtx.site.flags.keyScheme,
              tagPrefix: studioCtx.site.flags.tagPrefix,
            } as LocalizationConfig)
          : undefined,
      stylesOpts: { scheme: "css" },
      codeOpts: { reactRuntime: "classic" },
      fontOpts: { scheme: "import" },
      codeComponentStubs: false,
      skinnyReactWeb: false,
      skinny: false,
      importHostFromReactWeb: false,
      idFileNames: true,
      hostLessComponentsConfig: "stub",

      useComponentSubstitutionApi: false,
      useGlobalVariantsSubstitutionApi: false,
      useCodeComponentHelpersRegistry: false,
      useCustomFunctionsStub: true,
      isLivePreview: true,
      targetEnv: "preview",
    };
    const siteGenHelper = new SiteGenHelper(studioCtx.site, false);
    const cssVarResolver = new CssVarResolver(
      siteGenHelper.allStyleTokensAndOverrides(),
      siteGenHelper.allMixins(),
      siteGenHelper.allImageAssets(),
      studioCtx.site.activeTheme,
      {
        keepAssetRefs: false,
        useCssVariables: true,
      },
    );
    const compGenHelper = new ComponentGenHelper(siteGenHelper, cssVarResolver);
    return exportReactPresentational(
      compGenHelper,
      component,
      studioCtx.site,
      projectConfig,
      Object.fromEntries(
        studioCtx.site.imageAssets
          .filter((asset) => asset.dataUri && asset.dataUri.startsWith("http"))
          .map((asset) => [asset.uuid, asset.dataUri as string]),
      ),
      false,
      false,
      studioCtx.siteInfo.appAuthProvider,
      exportOpts,
      computeSerializerSiteContext(studioCtx.site),
    );
}

function createIconAssetModule(asset: ImageAsset) {
    const bundle = exportIconAsset(asset, { idFileNames: true });
    return {
      name: `./${bundle.fileName}`,
      lang: "tsx",
      source: bundle.module,
    };
}

function createGlobalVariantGroupModule(group: VariantGroup) {
    const bundle = exportGlobalVariantGroup(group, { idFileNames: true });
    return {
      name: `./${bundle.contextFileName}`,
      lang: "tsx",
      source: bundle.contextModule,
    };
}

function createCustomFunctionsModule(site: Site) {
    const source = `${allCustomFunctions(site)
      .map(
        ({ customFunction: fn }) =>
          `export const ${customFunctionImportAlias(
            fn,
          )} = ((window as any).__PlasmicFunctionsRegistry ?? []).find((r) => r.meta.name === "${
            fn.importName
          }" && r.meta.namespace == ${
            fn.namespace ? `"${fn.namespace}"` : "null"
          })?.function;`,
      )
      .join("\n")}
      ${allCodeLibraries(site)
        .map(
          ({ codeLibrary }) =>
            `export const ${codeLibraryImportAlias(
              codeLibrary,
            )} = ((window as any).__PlasmicLibraryRegistry ?? []).find((l) => l.meta.name === "${
              codeLibrary.name
            }")?.lib;`,
        )
        .join("\n")}`.trim();
    return {
      name: "./custom-functions.tsx",
      lang: "tsx",
      source,
    };
}

function createDepsProjectOutput(site: Site): ProjectConfig[] {
  return walkDependencyTree(site, "all").map((dep) => {
    return createProjectOutput(dep.site, dep.projectId as ProjectId, dep.name);
  });
}

/**
 * Creates project-level modules for all dependencies of the given project.
 */
function createDepsProjectMods(
  depProjectConfigs: ProjectConfig[],
): SourceModule[] {
  return depProjectConfigs.flatMap((depProjectConfig) =>
    createProjectMods(depProjectConfig),
  );
}

/**
 * Creates project-level modules for the given project.
 */
function createProjectMods(projectOutput: ProjectConfig): SourceModule[] {
    const mods: SourceModule[] = [
      {
        name: `./${projectOutput.cssFileName}`,
        lang: "css",
        source: projectOutput.cssRules,
      },
    ];
    if (projectOutput.projectModuleBundle) {
      mods.push({
        name: `./${projectOutput.projectModuleBundle.fileName}`,
        lang: "tsx",
        source: projectOutput.projectModuleBundle.module,
      });
    }
    if (projectOutput.styleTokensProviderBundle) {
      mods.push({
        name: `./${projectOutput.styleTokensProviderBundle.fileName}`,
        lang: "tsx",
        source: projectOutput.styleTokensProviderBundle.module,
      });
    }
    if (projectOutput.dataTokensBundle) {
      mods.push({
        name: `./${projectOutput.dataTokensBundle.fileName}`,
        lang: "tsx",
        source: projectOutput.dataTokensBundle.module,
      });
    }
    return mods;
}
