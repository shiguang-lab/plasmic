import { resolveBatchInput, type MutationReceipt, type MutationIdentity } from "@/wab/shared/copilot/mutation-receipt";
import { flushSync } from "react-dom";
import { readDepth, selectedReadFields, projectReadFields, registrationContract, withRegisteredContracts, type ModelReadOptions } from "@/wab/shared/copilot/model-read";
import {
  isCanvasElementVisible,
  revealCanvasElement,
} from "@/wab/client/components/canvas/canvas-scroll";
import { activityTargets } from "@/wab/client/copilot/activity";
import {
  browserImportCanvas,
  browserImportCanvasName,
} from "@/wab/client/copilot/browser-import-destination";
import {
  beginCanvasInspection,
  endCanvasInspection,
} from "@/wab/client/copilot/canvas-inspection";
import { readAndSanitizeSvgXmlAsImage } from "@/wab/client/dom-utils";
import { createComponent } from "@/wab/client/operations/create-component";
import { createComponentState } from "@/wab/client/operations/create-component-state";
import { createInteraction } from "@/wab/client/operations/create-interaction";
import { createStyleToken } from "@/wab/client/operations/create-style-token";
import { createVariant } from "@/wab/client/operations/create-variant";
import { createVariantGroup } from "@/wab/client/operations/create-variant-group";
import { deleteComponent } from "@/wab/client/operations/delete-component";
import { deleteComponentState } from "@/wab/client/operations/delete-component-state";
import { deleteInteraction } from "@/wab/client/operations/delete-interaction";
import { deleteStyleToken } from "@/wab/client/operations/delete-style-token";
import { deleteTpl } from "@/wab/client/operations/delete-tpl";
import { htmlToTpl } from "@/wab/client/operations/html-to-tpl";
import { insertTplAt, pasteTpls } from "@/wab/client/operations/insert-tpl";
import { renameTpl } from "@/wab/client/operations/rename-tpl";
import { setComponentInstanceProp } from "@/wab/client/operations/set-component-instance-prop";
import { setStyleTokenVariantedValue } from "@/wab/client/operations/set-style-token-varianted-value";
import { setTplStyles } from "@/wab/client/operations/set-tpl-styles";
import { updateComponentState } from "@/wab/client/operations/update-component-state";
import { updateInteraction } from "@/wab/client/operations/update-interaction";
import { selectionPath } from "@/wab/client/selection-context";
import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import {
  formatWIError,
  formatWIErrors,
  isRecoverableWIError,
  WIError,
} from "@/wab/client/web-importer/errors";
import { ensureOk } from "@/wab/commons/neverthrow-utils";
import {
  cloneArenaFrame,
  ensureActivatedScreenVariantsForFrameByWidth,
  FrameViewMode,
  getArenaFrames,
  getArenaName,
  getArenaType,
  getArenaUuidOrName,
  getFrameHeight,
  isDedicatedArena,
  mkArenaFrame,
} from "@/wab/shared/Arenas";
import { VariantOptionsType } from "@/wab/shared/TplMgr";
import { VariantTplMgr } from "@/wab/shared/VariantTplMgr";
import { getBaseVariant, isBaseVariant, isScreenVariantGroup } from "@/wab/shared/Variants";
import { usedHostLessPkgs } from "@/wab/shared/cached-selectors";
import { paramToVarName } from "@/wab/shared/codegen/util";
import { assert, asyncTimeout, ensure, withTimeout } from "@/wab/shared/common";
import { getComponentArenaBaseFrame } from "@/wab/shared/component-arenas";
import {
  GlobalVariantFrame,
  RootComponentVariantFrame,
} from "@/wab/shared/component-frame";
import {
  CopilotTool,
  defineCopilotTool as defineTool,
} from "@/wab/shared/copilot/copilot-tool-types";
import { interpolatedStringToCodeExpr } from "@/wab/shared/copilot/dynamic-value-input";
import {
  LocalEditBinding,
  localEditToolNames,
} from "@/wab/shared/copilot/local-edit";
import {
  PROTOTYPE_TOOL_META as meta,
  prototypeMutationSchema,
  type PrototypeMutation,
} from "@/wab/shared/copilot/prototype-tools";
import { mkNormalizedRep } from "@/wab/shared/copilot/utils";
import {
  ComponentType,
  allComponentVariants,
  isCodeComponent,
  isContextCodeComponent,
  isFrameComponent,
  isPageComponent,
  mkComponent,
} from "@/wab/shared/core/components";
import { codeLit } from "@/wab/shared/core/exprs";
import { getOnlyAssetRef } from "@/wab/shared/core/image-assets";
import { walkDependencyTree } from "@/wab/shared/core/project-deps";
import {
  allGlobalVariants,
  getArenaByNameOrUuidOrPath,
  getComponentArena,
  getPageArena,
} from "@/wab/shared/core/sites";
import { SlotSelection } from "@/wab/shared/core/slots";
import { isValidStyleProp } from "@/wab/shared/core/style-props";
import { unbundleProjectDependency } from "@/wab/shared/core/tagged-unbundle";
import {
  ancestorsUp,
  clone,
  flattenTpls,
  getAllEventHandlersOfAttrType,
  getAllEventHandlersOfParamType,
  isTplImage,
  isTplTextBlock,
  isTplVariantable,
  mkTplTagX,
  tplChildren,
} from "@/wab/shared/core/tpls";
import { RSH } from "@/wab/shared/RuleSetHelpers";
import { normProp } from "@/wab/shared/css";
import { ScreenSizeSpec } from "@/wab/shared/css-size";
import { parseDataUrlToSvgXml } from "@/wab/shared/data-urls";
import { Pt } from "@/wab/shared/geom";
import {
  Component,
  RawText,
  TplNode,
  isKnownEventHandler,
  isKnownRawText,
  isKnownRenderExpr,
  isKnownTplComponent,
  isKnownTplTag,
  isKnownVirtualRenderExpr,
} from "@/wab/shared/model/classes";
import { frameSizeGroups } from "@/wab/shared/responsiveness";
import { ensurePageOverviewArena } from "@/wab/shared/page-overview";
import {
  assertSiteInvariants,
  genSiteErrors,
} from "@/wab/shared/site-invariants";
import {
  buildComponentResource,
  buildElementTree,
  buildElementProperties,
  buildElementResource,
  tplToHtml,
} from "@/wab/shared/web-exporter/component-exporter";
import {
  buildProjectResource,
} from "@/wab/shared/web-exporter/project-exporter";
import {
  outputResult,
} from "@/wab/shared/web-exporter/schema";
import { ok } from "neverthrow";

const editTools = new Set<string>([
  ...prototypeMutationSchema.options.map((option) => option.shape.name.value),
  "executeBatch",
  "installLibrary",
  "upgradeLibrary",
  "importWebPage",
]);

const previewEditorViews = new WeakMap<StudioCtx, ReturnType<typeof meta.restoreEditorView.inputSchema.parse>>();

function editorView(studio: StudioCtx) {
  const vc = studio.focusedViewCtx();
  return studio.currentArena && studio.viewportCtx
    ? {
        arenaId: getArenaUuidOrName(studio.currentArena),
        arenaType: getArenaType(studio.currentArena),
        frameUuid: (vc?.arenaFrame() ?? studio.focusedFrame())?.uuid ?? null,
        scale: studio.viewportCtx.scale(),
        scroll: { x: studio.viewportCtx.scroll().x, y: studio.viewportCtx.scroll().y },
      }
    : null;
}

async function restoreEditorView(studio: StudioCtx, input: ReturnType<typeof meta.restoreEditorView.inputSchema.parse>) {
  assert(!studio.isLiveMode && !studio.isInteractiveMode, "Return to edit mode before restoring a view");
  const arena = getArenaByNameOrUuidOrPath(studio.site, input.arenaId, input.arenaType);
  assert(arena, "Saved arena no longer exists");
  const frame = input.frameUuid
    ? ensure(getArenaFrames(arena).find((candidate) => candidate.uuid === input.frameUuid), "Saved artboard no longer exists")
    : undefined;
  studio.switchToArena(arena);
  await asyncTimeout(0);
  await studio.awaitStudioReady();
  studio.restoreStudioViewportSnapshot({ focusedArenaFrame: frame, scale: input.scale,
    scroll: new Pt(input.scroll.x, input.scroll.y),
    canvasPadding: ensure(studio.viewportCtx, "Canvas viewport is not ready").canvasPadding() }, true);
  await studio.awaitStudioReady();
  await asyncTimeout(0);
  assert(studio.currentArena === arena, "Editor did not return to the saved canvas");
  assert(!input.frameUuid || editorView(studio)?.frameUuid === input.frameUuid, "Editor did not return to the saved artboard");
  return { restored: true };
}

// Keep input/output validation and serialization in the shared tool wrapper.
const defineCopilotTool: typeof defineTool = (toolMeta, execute) =>
  defineTool(toolMeta, async (studio, input, caller) => {
    if (!editTools.has(toolMeta.toolName)) {
      return execute(studio, input, caller);
    }
    const targets = activityTargets(toolMeta.toolName, input).map((target) => {
      const component =
        studio.site.components.find((c) => c.uuid === target.componentUuid) ??
        studio.site.projectDependencies
          .flatMap((dep) => dep.site.components)
          .find((c) => c.uuid === target.componentUuid);
      const tpl =
        component && target.elementUuid
          ? flattenTpls(component.tplTree).find(
              (t) => t.uuid === target.elementUuid,
            )
          : undefined;
      const elementName = tpl && "name" in tpl && tpl.name;
      return {
        ...target,
        ancestorUuids: tpl
          ? ancestorsUp(tpl, true).map((ancestor) => ancestor.uuid)
          : undefined,
        label: component
          ? `${component.name}${target.elementUuid ? ` / ${elementName || target.elementUuid}` : ""}`
          : (target.canvasName ?? "Project"),
      };
    });
    const finish = studio.copilotActivity.begin(targets, "edit", caller);
    try {
      const output = await execute(studio, input, caller);
      finish("success");
      return output;
    } catch (error) {
      finish("error");
      throw error;
    }
  });

function findCanvas(studio: StudioCtx, name: string) {
  return ensure(
    studio.site.arenas.find((arena) => arena.name === name),
    "Canvas not found",
  );
}
function emptyCanvasSpace(
  studio: StudioCtx,
  input: {
    canvasName: string;
    width: number;
    height: number;
    padding: number;
    direction: string;
    frameUuid?: string;
  },
) {
  const arena = findCanvas(studio, input.canvasName);
  const rects = arena.children.map((frame) => ({
    uuid: frame.uuid,
    x: frame.left ?? 0,
    y: frame.top ?? 0,
    width: frame.width,
    height: getFrameHeight(frame),
  }));
  const anchor = input.frameUuid
    ? ensure(
        rects.find((rect) => rect.uuid === input.frameUuid),
        "Anchor frame not found",
      )
    : rects.at(-1);
  let x = anchor?.x ?? 0,
    y = anchor?.y ?? 0;
  if (anchor) {
    if (input.direction === "right") {
      x += anchor.width + input.padding;
    } else if (input.direction === "left") {
      x -= input.width + input.padding;
    } else if (input.direction === "bottom") {
      y += anchor.height + input.padding;
    } else {
      y -= input.height + input.padding;
    }
  }
  for (let step = 0; step <= rects.length; step++) {
    const hits = rects.filter(
      (r) =>
        x < r.x + r.width + input.padding &&
        x + input.width + input.padding > r.x &&
        y < r.y + r.height + input.padding &&
        y + input.height + input.padding > r.y,
    );
    if (!hits.length) {
      return { canvasName: arena.name, x, y };
    }
    if (input.direction === "right") {
      x = Math.max(...hits.map((r) => r.x + r.width + input.padding));
    } else if (input.direction === "left") {
      x = Math.min(...hits.map((r) => r.x - input.width - input.padding));
    } else if (input.direction === "bottom") {
      y = Math.max(...hits.map((r) => r.y + r.height + input.padding));
    } else {
      y = Math.min(...hits.map((r) => r.y - input.height - input.padding));
    }
  }
  throw new Error("Cannot find an empty artboard position");
}
function vectorAsset(
  studio: StudioCtx,
  componentUuid: string,
  elementUuid: string,
) {
  const component = findComponent(studio, componentUuid);
  const tpl = findElement(component, elementUuid);
  assert(isTplImage(tpl), "Element must be an SVG-backed image/icon");
  const asset = ensure(
    getOnlyAssetRef(tpl),
    "Element does not have one SVG asset across its variants",
  );
  assert(
    asset.dataUri?.startsWith("data:image/svg+xml") ||
      (!!asset.dataUri &&
        /^https?:/.test(asset.dataUri) &&
        new URL(asset.dataUri).pathname.endsWith(".svg")),
    "Element must reference an SVG asset; raster images are not vectors",
  );
  return { component, tpl, asset };
}

async function readSvgSource(dataUri: string) {
  if (dataUri.startsWith("data:image/svg+xml")) {
    return parseDataUrlToSvgXml(dataUri);
  }
  const response = await fetch(dataUri, {
    credentials: "include",
    signal: AbortSignal.timeout(30000),
  });
  assert(response.ok, "Cannot read SVG asset source");
  assert(
    response.headers.get("content-type")?.includes("image/svg+xml"),
    "Asset response is not SVG",
  );
  const svg = await response.text();
  assert(svg.length <= 200000, "SVG source exceeds 200 kB");
  return svg;
}

function findComponent(studio: StudioCtx, uuid: string, local = false) {
  const components = local
    ? studio.site.components
    : [
        ...studio.site.components,
        ...walkDependencyTree(studio.site, "all").flatMap(
          (dep) => dep.site.components,
        ),
      ];
  const component = ensure(
    components.find((c) => c.uuid === uuid),
    `Component ${uuid} not found${local ? " in this project" : ""}`,
  );
  if (local) {
    assert(
      !isCodeComponent(component),
      "Registered code components cannot be edited; modify an instance instead.",
    );
  }
  return component;
}

function findElement(component: Component, uuid: string, studio?: StudioCtx): TplNode {
  const local = flattenTpls(component.tplTree).find((t) => t.uuid === uuid);
  if (local) {
    return local;
  }
  let hint = "";
  if (studio) {
    const owner = studio.site.components.find(
      (c) => c !== component && flattenTpls(c.tplTree).some((t) => t.uuid === uuid),
    );
    if (owner) {
      hint = `; it is defined in component "${owner.name}" (${owner.uuid}). Pass componentUuid: "${owner.uuid}".`;
    }
  }
  throw new Error(`Element ${uuid} not found in component ${component.name}${hint}`);
}

function variantManager(studio: StudioCtx, component: Component) {
  const arena = isFrameComponent(component)
    ? undefined
    : ensure(
        isPageComponent(component)
          ? getPageArena(studio.site, component)
          : getComponentArena(studio.site, component),
        "Component arena not found",
      );
  const frame = arena
    ? getComponentArenaBaseFrame(arena)
    : ensure(
        studio.site.arenas
          .flatMap((canvas) => canvas.children)
          .find((candidate) => candidate.container.component === component),
        "Free artboard not found",
      );
  return new VariantTplMgr(
    [new RootComponentVariantFrame(frame)],
    studio.site,
    studio.tplMgr(),
    new GlobalVariantFrame(studio.site, frame),
  );
}

/** All writes go through the same permission and recorder path as human edits. */
export function assertCanEditPrototype(studio: StudioCtx) {
  assert(
    studio.canEditProject() &&
      studio.editMode &&
      !studio.isLiveMode &&
      !studio.isInteractiveMode &&
      studio.isAtTip &&
      !studio.blockChanges,
    "Project is read-only, blocked, or not at its latest revision. Open an editable current revision.",
  );
  assert(
    !studio.siteInfo.isMainBranchProtected || !!studio.dbCtx().branchInfo?.id,
    "The main branch is protected. Open an editable branch.",
  );
}

async function change<T>(
  studio: StudioCtx,
  components: Component[],
  fn: () => T,
): Promise<T> {
  assertCanEditPrototype(studio);
  return ensureOk(
    await studio.changeObserved(
      () => components,
      () => {
        assertCanEditPrototype(studio);
        // Studio validates invariants after observing newly attached model nodes.
        return ok(fn());
      },
    ),
  );
}

function readNativeModel(studio: StudioCtx, component: Component, tpl: TplNode | undefined, options: ModelReadOptions) {
  const fields = selectedReadFields(options);
  const depth = readDepth(options);
  assert(!options.propNames || options.view === "properties", "propNames requires view:properties");
  let resource: Record<string, unknown>;
  if (tpl) {
    resource = {
      __type: "Element", uuid: tpl.uuid, componentUuid: component.uuid,
      ...("name" in tpl ? { name: tpl.name } : {}),
      ...(isKnownTplTag(tpl) ? { tag: tpl.tag } : {}),
      ...(isKnownTplComponent(tpl) ? { registeredComponentUuid: tpl.component.uuid } : {}),
      ...(fields.some((field) => ["children", "slots", "editable", "source"].includes(field)) ? buildElementTree(tpl, depth) : {}),
      ...(fields.some((field) => ["properties", "styles", "attributes", "text"].includes(field)) ? buildElementProperties(tpl, studio.site, options.propNames) : {}),
      ...(fields.includes("baseVariantTplTree") || fields.includes("interactions")
        ? buildElementResource(tpl, { site: studio.site, depth, includeInteractions: fields.includes("interactions") }) : {}),
    };
  } else {
    resource = ["tree", "properties"].includes(options.view) && !options.fields?.some((field) =>
      !["__type", "uuid", "name", "type", "isContext", "rootElementUuid", "baseVariantTplTree", "tree", "properties", "styles", "attributes", "text", "editable", "source"].includes(field))
      ? { __type: "Component", uuid: component.uuid, name: component.name, type: component.type,
          ...(isContextCodeComponent(component) ? { isContext: true } : {}),
          ...(fields.includes("baseVariantTplTree") ? { baseVariantTplTree: tplToHtml(component.tplTree, studio.site, depth) } : {}) }
      : { ...buildComponentResource(component, { site: studio.site, depth, omitTree: !fields.includes("baseVariantTplTree") }) };
    resource.rootElementUuid = component.tplTree.uuid;
    if (fields.includes("fromProject") && !studio.site.components.includes(component) && !resource.fromProject) {
      resource.fromProject = walkDependencyTree(studio.site, "all").find((dep) => dep.site.components.includes(component))?.projectId;
    }
    if (fields.includes("tree")) resource.tree = buildElementTree(component.tplTree, depth);
    if (fields.some((field) => ["properties", "styles", "attributes", "text"].includes(field))) Object.assign(resource, buildElementProperties(component.tplTree, studio.site, options.propNames));
    for (const field of ["states", "interactions", "dataQueries", "legacyDataQueries", "variantSettings"]) {
      if (fields.includes(field) && resource[field] === undefined) { resource[field] = []; }
    }
    const contextRegistration = isContextCodeComponent(component) && fields.some((field) => ["props", "globalActions", "description"].includes(field))
      ? studio.getContextsRegistration().find(({ meta }) => meta.name === component.name)?.meta : undefined;
    const registration = fields.includes("props") && (contextRegistration ?? studio.getCodeComponentMeta(component));
    if (registration && Array.isArray(resource.props)) { resource.props = withRegisteredContracts(resource.props, registration.props); }
    if (contextRegistration?.description) resource.description = contextRegistration.description;
    if (fields.includes("globalActions") && contextRegistration) {
      resource.globalActions = Object.entries(contextRegistration.globalActions ?? {}).map(([name, action]) => ({
        name: `${component.name}.${name}`,
        ...(action.displayName ? { displayName: action.displayName } : {}),
        ...(action.description ? { description: action.description } : {}),
        parameters: action.parameters.map(({ name, type }) => ({ name, ...registrationContract(type) })),
      }));
    }
    const actions = fields.includes("refActions") && studio.getCodeComponentMeta(component)?.refActions;
    if (actions) {
      resource.refActions = Object.entries(actions).map(([name, action]) => ({
        name, ...(action.displayName ? { displayName: action.displayName } : {}),
        args: (action.argTypes ?? []).map((arg) => ({ name: arg.name, ...(arg.displayName ? { displayName: arg.displayName } : {}) })),
      }));
    }
  }
  return projectReadFields(resource, options);
}

type MutationPlan = {
  components: Component[];
  apply: () => void;
  messages?: string[];
};

/** Collect identities, without exporting props, HTML, expressions or recursive models. */
function mutationIdentities(studio: StudioCtx, components: Component[]) {
  const identities = new Map<string, MutationIdentity & { parentUuid?: string }>();
  const add = (identity: MutationIdentity & { parentUuid?: string }) => identities.set(`${identity.kind}:${identity.uuid}`, identity);
  for (const component of components) {
    add({ kind: "Component", uuid: component.uuid, name: component.name, rootElementUuid: component.tplTree.uuid });
    for (const group of component.variantGroups) {
      add({ kind: "VariantGroup", uuid: group.uuid, name: group.param.variable.name, componentUuid: component.uuid });
    }
    for (const variant of allComponentVariants(component).filter((v) => v !== getBaseVariant(component))) {
      add({ kind: "Variant", uuid: variant.uuid, name: variant.name, componentUuid: component.uuid });
    }
    for (const state of component.states) {
      add({ kind: "State", uuid: state.param.uuid, name: state.param.variable.name, componentUuid: component.uuid });
    }
    for (const tpl of flattenTpls(component.tplTree)) {
      add({ kind: "Element", uuid: tpl.uuid, componentUuid: component.uuid, ...(tpl.parent ? { parentUuid: tpl.parent.uuid } : {}), ...("name" in tpl && tpl.name ? { name: tpl.name } : {}) });
      for (const handler of [...getAllEventHandlersOfAttrType(component, tpl), ...getAllEventHandlersOfParamType(component, tpl)]) {
        if (isKnownEventHandler(handler.expr)) {
          for (const step of handler.expr.interactions) {
            add({ kind: "Interaction", uuid: step.uuid, name: step.interactionName, componentUuid: component.uuid });
          }
        }
      }
    }
  }
  for (const token of studio.site.styleTokens) { add({ kind: "StyleToken", uuid: token.uuid, name: token.name }); }
  for (const group of studio.site.globalVariantGroups) {
    add({ kind: "GlobalVariantGroup", uuid: group.uuid, name: group.param.variable.name });
    for (const variant of group.variants) { add({ kind: "GlobalVariant", uuid: variant.uuid, name: variant.name }); }
  }
  for (const canvas of studio.site.arenas) {
    add({ kind: "Canvas", uuid: canvas.name, name: canvas.name });
    for (const frame of canvas.children) { add({ kind: "Artboard", uuid: frame.uuid, componentUuid: frame.container.component.uuid }); }
  }
  return identities;
}

async function runNativeBatch(
  studio: StudioCtx,
  operations: PrototypeMutation[],
  validate?: (operation: PrototypeMutation) => void,
) {
  assertCanEditPrototype(studio);
  await studio.ensureCodeComponentRegistrations();
  const changeCounter = studio._changeCounter;
  const assets: MutationAssets[] = [];
  const names = new Set<string>();
  for (const operation of operations) {
    if (operation.as) {
      assert(!names.has(operation.as), `Duplicate batch binding ${operation.as}`);
      names.add(operation.as);
    }
    assets.push(await prepareMutationAssets(studio, operation));
  }
  const bindings = new Map<string, MutationReceipt>();
  const receipts: MutationReceipt[] = [];
  // Existing components are observed before the recorder; newly attached ones are
  // observed through the native site/component attachment operation.
  await change(studio, [...studio.site.components], () => {
    assert(studio._changeCounter === changeCounter, "The design changed while preparing batch assets; reread before retrying");
    for (const [index, raw] of operations.entries()) {
      try {
        const operation = prototypeMutationSchema.parse({ ...raw, input: resolveBatchInput(raw.input, bindings) });
        validate?.(operation);
        const plan = planMutation(studio, operation, assets[index]);
        const existingComponents = new Set(studio.site.components);
        const before = mutationIdentities(studio, plan.components);
        plan.apply();
        const after = mutationIdentities(studio, [...new Set([...plan.components.filter((c) => studio.site.components.includes(c)), ...studio.site.components.filter((c) => !existingComponents.has(c))])]);
        const added = [...after.entries()].filter(([key]) => !before.has(key)).map(([, identity]) => identity);
        const created = added.filter((identity) => identity.kind !== "Element" || (
          !added.some((other) => other.kind === "Component" && other.uuid === identity.componentUuid) &&
          !added.some((other) => other.kind === "Element" && other.uuid === identity.parentUuid)
        )).map(({ parentUuid, ...identity }) => identity);
        const primaryKinds: Partial<Record<PrototypeMutation["name"], string>> = {
          insertHtml: "Element", copyElement: "Element", createComponent: "Component",
          createState: "State", createInteraction: "Interaction", createStyleToken: "StyleToken",
          createVariantGroup: "VariantGroup", createVariant: "Variant",
          createGlobalVariantGroup: "GlobalVariantGroup", createGlobalVariant: "GlobalVariant",
          createBreakpoint: "GlobalVariant", createCanvas: "Canvas", createArtboard: "Artboard",
        };
        const primaryKind = primaryKinds[operation.name];
        created.sort((a, b) => Number(b.kind === primaryKind) - Number(a.kind === primaryKind));
        const receipt: MutationReceipt = {
          name: operation.name, ...(operation.as ? { as: operation.as } : {}), created,
          ...("componentUuid" in operation.input && operation.input.componentUuid ? { componentUuid: operation.input.componentUuid } : {}),
          ...("elementUuid" in operation.input && operation.input.elementUuid ? { elementUuid: operation.input.elementUuid } : {}),
          ...(plan.messages?.length ? { messages: plan.messages } : {}),
        };
        receipts.push(receipt);
        if (operation.as) { bindings.set(operation.as, receipt); }
      } catch (error) {
        throw new Error(`Operation ${index} (${raw.name}): ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  });
  return receipts;
}

type MutationAssets = {
  html?: Awaited<ReturnType<typeof htmlToTpl>>;
  bindHtml?: (component: Component) => void;
  image?: Awaited<ReturnType<typeof readAndSanitizeSvgXmlAsImage>>;
};

/** Assets are prepared off-model; target resolution and all writes are synchronous. */
async function prepareMutationAssets(studio: StudioCtx, operation: PrototypeMutation): Promise<MutationAssets> {
  if (operation.name === "updateVector") {
    return { image: await readAndSanitizeSvgXmlAsImage(studio.appCtx, operation.input.svg) };
  }
  if (operation.name !== "insertHtml") {
    return {};
  }
  // A detached native frame lets a batch prepare HTML even before its owner exists.
  const owner = mkComponent({ name: "", type: ComponentType.Frame, tplTree: mkTplTagX("div") });
  const frame = mkArenaFrame({ site: studio.site, component: owner, name: "", width: 1440, height: 900 });
  const vtm = new VariantTplMgr([new RootComponentVariantFrame(frame)], studio.site, studio.tplMgr(), new GlobalVariantFrame(studio.site, frame));
  const html = await htmlToTpl(operation.input.html, { site: studio.site, vtm, appCtx: studio.appCtx, pageHrefs: true, getCodeComponentMeta: (component) => studio.getCodeComponentMeta(component) });
  return { html, bindHtml: (component) => {
    if (html.isOk()) {
      const base = getBaseVariant(owner);
      for (const tpl of html.value.tpls.flatMap(flattenTpls)) {
        for (const setting of tpl.vsettings) {
          setting.variants = setting.variants.map((variant) => variant === base ? getBaseVariant(component) : variant);
        }
      }
      frame.container.component = component;
    }
  } };
}

async function runMutation(studio: StudioCtx, operation: PrototypeMutation) {
  const receipts = await runNativeBatch(studio, [operation]);
  return ensure(receipts[0], "Missing operation receipt");
}

function planMutation(studio: StudioCtx, operation: PrototypeMutation, assets: MutationAssets): MutationPlan {
  if (operation.name === "deleteCanvas" || operation.name === "updateCanvas") {
    const arena = findCanvas(studio, operation.input.canvasName);
    return {
      components: [],
      messages:
        operation.name === "deleteCanvas"
          ? [`Canvas "${operation.input.canvasName}" deleted.`]
          : [`Canvas "${operation.input.canvasName}" renamed to "${operation.input.name}".`],
      apply: () => {
        assert(
          studio.site.arenas.includes(arena),
          "Canvas removed during batch",
        );
        if (operation.name === "deleteCanvas") {
          studio.siteOps().removeMixedArena(arena);
        } else {
          assert(
            !studio.site.arenas.some(
              (a) => a !== arena && a.name === operation.input.name,
            ),
            "Canvas name already exists",
          );
          arena.name = operation.input.name;
        }
      },

    };
  }
  if (operation.name === "updateArtboard") {
    const input = operation.input;
    const arena = findCanvas(studio, input.canvasName);
    const frame = ensure(
      arena.children.find((f) => f.uuid === input.frameUuid),
      "Artboard not found",
    );
    return {
      components: [frame.container.component],
      apply: () => {
        assert(
          studio.site.arenas.includes(arena) && arena.children.includes(frame),
          "Artboard removed during batch",
        );
        if (input.width !== undefined) frame.width = input.width;
        if (input.height !== undefined) frame.height = input.height;
        if (input.x !== undefined) frame.left = input.x;
        if (input.y !== undefined) frame.top = input.y;
        if (input.viewMode !== undefined) {
          frame.viewMode = input.viewMode as FrameViewMode;
          if (input.viewMode === "stretch") {
            const root = frame.container.component.tplTree;
            if (isTplVariantable(root)) {
              for (const vs of root.vsettings) {
                if (isBaseVariant(vs.variants)) {
                  RSH(vs.rs, root).set("width", "stretch");
                }
              }
            }
          }
        }
        ensureActivatedScreenVariantsForFrameByWidth(studio.site, frame);
      },

    };
  }
  if (operation.name === "setPageViewport") {
    const arenas = operation.input.componentUuid
      ? studio.site.pageArenas.filter(
          (arena) =>
            arena.component ===
            findComponent(
              studio,
              ensure(operation.input.componentUuid, "Page missing"),
              true,
            ),
        )
      : studio.site.pageArenas;
    assert(
      !operation.input.componentUuid || arenas.length === 1,
      "Page arena not found",
    );
    const size = ensure(
      frameSizeGroups
        .flatMap((g) => g.sizes)
        .find((s) => s.name === operation.input.preset),
      "Unknown Studio device preset",
    );
    return {
      components: arenas.map((a) => a.component),
      apply: () => {
        for (const arena of arenas) {
          for (const row of arena.matrix.rows) {
            row.cols.splice(1);
          }
          for (const row of [
            ...arena.matrix.rows,
            ...arena.customMatrix.rows,
          ]) {
            for (const { frame } of row.cols) {
              frame.width = size.width;
              frame.height = size.height;
              ensureActivatedScreenVariantsForFrameByWidth(studio.site, frame);
            }
          }
        }
        if (studio.site.arenas.some((arena) => arena.children.some((frame) => isPageComponent(frame.container.component)))) {
          ensurePageOverviewArena(studio.tplMgr());
        }
      },

    };
  }
  if (operation.name === "deleteBreakpoint") {
    const variant = ensure(
      studio.site.activeScreenVariantGroup?.variants.find(
        (v) => v.uuid === operation.input.variantUuid,
      ),
      "Active screen breakpoint not found",
    );
    return {
      components: studio.site.components.filter((c) => !isCodeComponent(c)),
      apply: () => {
        assert(
          studio.site.activeScreenVariantGroup?.variants.includes(variant),
          "Breakpoint removed during batch",
        );
        studio.tplMgr().tryRemoveVariant(variant, undefined);
      },

    };
  }
  if (operation.name === "createCanvas") {
    const input = operation.input;
    return {
      components: [],
      apply: () => {
        assert(
          !studio.site.arenas.some((arena) => arena.name === input.name),
          "Canvas name already exists",
        );
        studio.tplMgr().addArena(input.name);
      },

    };
  }
  if (operation.name === "createArtboard") {
    const input = operation.input;
    const arena = findCanvas(studio, input.canvasName);
    const component = findComponent(studio, input.componentUuid, true);
    assert(!isCodeComponent(component), "Use a local editable component/page");
    assert(
      (input.x === undefined) === (input.y === undefined),
      "Provide both x and y, or neither",
    );
    return {
      components: [component],
      apply: () => {
        assert(
          studio.site.arenas.includes(arena) &&
            studio.site.components.includes(component),
          "Canvas or component removed during batch",
        );
        const position =
          input.x === undefined
            ? emptyCanvasSpace(studio, {
                ...input,
                direction: "right",
                padding: 80,
              })
            : { x: input.x, y: ensure(input.y, "y missing") };
        const frame = studio
          .tplMgr()
          .addNewMixedArenaFrame(arena, component.name, component, {
            width: input.width,
            height: input.height,
            insertPt: new Pt(
              position.x + input.width / 2,
              position.y + input.height / 2,
            ),
          });
        frame.left = position.x;
        frame.top = position.y;
      },

    };
  }
  if (operation.name === "updateVector") {
    const input = operation.input;
    const { component, tpl, asset } = vectorAsset(
      studio,
      input.componentUuid,
      input.elementUuid,
    );
    assert(
      studio.site.imageAssets.includes(asset),
      "Cannot update an imported SVG asset",
    );
    const image = ensure(
      assets.image,
      "SVG sanitization failed",
    );
    return {
      components: studio.site.components,
      apply: () => {
        assert(
          studio.site.imageAssets.includes(asset) &&
            findElement(component, tpl.uuid) === tpl,
          "SVG asset or element was removed during batch",
        );
        studio.siteOps().updateImageAsset(asset, image);
      },

    };
  }
  if (operation.name === "createComponent") {
    const input = operation.input;
    return {
      components: [],
      apply: () => {
        assert(
          !studio.site.components.some((c) => c.name === input.name),
          `Component name "${input.name}" already exists`,
        );
        assert(
          input.type === "page" || !input.path,
          "Only pages can have a path",
        );
        assert(
          !input.path ||
            !studio.site.components.some(
              (c) => c.pageMeta?.path === input.path,
            ),
          `Page path "${input.path}" already exists`,
        );
        const created = ensureOk(
          createComponent({
            tplMgr: studio.tplMgr(),
            name: input.name,
            type:
              input.type === "page" ? ComponentType.Page : ComponentType.Plain,
            ...(input.path ? { pageMeta: { path: input.path } } : {}),
          }),
        );
        if (input.type === "page") {
          const arena = ensure(getPageArena(studio.site, created), "Page arena missing");
          const size = ensure(frameSizeGroups.flatMap((g) => g.sizes).find((s) => s.name === input.preset), "Unknown Studio device preset");
          for (const row of arena.matrix.rows) {
            row.cols.splice(1);
            for (const { frame } of row.cols) {
              frame.width = size.width;
              frame.height = size.height;
              ensureActivatedScreenVariantsForFrameByWidth(studio.site, frame);
            }
          }
          ensurePageOverviewArena(studio.tplMgr());
        }
      },

    };
  }
  if (operation.name === "createStyleToken") {
    return {
      components: [],
      apply: () => {
        ensureOk(
          createStyleToken({ tplMgr: studio.tplMgr(), ...operation.input }),
        );
      },

    };
  }
  if (
    operation.name === "updateStyleToken" ||
    operation.name === "deleteStyleToken"
  ) {
    const token = ensure(
      studio.site.styleTokens.find((t) => t.uuid === operation.input.tokenUuid),
      "Local token not found",
    );
    assert(!token.isRegistered, "Registered tokens cannot be changed");
    if (operation.name === "deleteStyleToken") {
      return {
        components: studio.site.components,
        apply: () => {
          assert(
            studio.site.styleTokens.includes(token),
            "Token was removed during batch",
          );
          deleteStyleToken({ site: studio.site, token });
        },

      };
    }
    const input = operation.input;
    assert(
      input.name !== undefined || input.value !== undefined,
      "Provide a token name or value",
    );
    const variants = (input.variantUuids ?? []).map((uuid) =>
      ensure(
        allGlobalVariants(studio.site).find((v) => v.uuid === uuid),
        `Global variant ${uuid} not found`,
      ),
    );
    return {
      components: [],
      apply: () => {
        assert(
          studio.site.styleTokens.includes(token),
          "Token was removed during batch",
        );
        if (input.name !== undefined) {
          studio.tplMgr().renameStyleToken(token, input.name);
        }
        if (input.value !== undefined) {
          if (variants.length) {
            ensureOk(
              setStyleTokenVariantedValue({
                site: studio.site,
                token,
                variants,
                value: input.value,
              }),
            );
          } else {
            assert(input.value !== null, "Base token value cannot be null");
            token.value = input.value;
          }
        }
      },

    };
  }
  if (
    operation.name === "createGlobalVariantGroup" ||
    operation.name === "createGlobalVariant" ||
    operation.name === "createBreakpoint"
  ) {

    if (operation.name === "createGlobalVariantGroup") {
      return {
        components: studio.site.components,
        apply: () => {
          studio.tplMgr().createGlobalVariantGroup(operation.input.name);
        },

      };
    }
    if (operation.name === "createGlobalVariant") {
      const input = operation.input;
      const group = ensure(
        studio.site.globalVariantGroups.find(
          (candidate) =>
            candidate.uuid === input.groupUuid &&
            !isScreenVariantGroup(candidate),
        ),
        "Local theme group not found",
      );
      return {
        components: studio.site.components,
        apply: () => {
          assert(
            studio.site.globalVariantGroups.includes(group),
            "Theme group was removed",
          );
          studio.tplMgr().createGlobalVariant(group, input.name);
        },

      };
    }
    const input = operation.input;
    assert(
      input.minWidth !== undefined || input.maxWidth !== undefined,
      "Provide minWidth or maxWidth",
    );
    assert(
      input.minWidth === undefined ||
        input.maxWidth === undefined ||
        input.minWidth <= input.maxWidth,
      "minWidth must not exceed maxWidth",
    );
    return {
      components: studio.site.components,
      apply: () => {
        studio.tplMgr().createScreenVariant({
          name: input.name,
          spec: new ScreenSizeSpec(input.minWidth, input.maxWidth),
        });
      },

    };
  }
  const component = findComponent(studio, operation.input.componentUuid, true);
  if (operation.name === "deleteComponent") {
    return {
      components: studio.site.components,
      apply: () => {
        assert(
          studio.site.components.includes(component),
          "Component removed during batch",
        );
        ensureOk(
          deleteComponent(component, studio.site, studio, studio.tplMgr()),
        );
      },

    };
  }
  const vtm = variantManager(studio, component);
  const messages: string[] = [];
  let apply: () => void;
  switch (operation.name) {
    case "insertHtml": {
      const input = operation.input;
      const collectWarnings = (errors: WIError[]) => {
        const blocking = errors.filter((error) => !isRecoverableWIError(error));
        assert(
          !blocking.length,
          formatWIErrors(blocking).join("; ") +
            (blocking.some((error) => error.code === "unknown-component")
              ? " Read the installed component names and contracts, correct the component reference, and retry this operation. No partial tree was inserted."
              : ""),
        );
        messages.push(...formatWIErrors(errors));
      };
      assert(
        input.location !== "replace" || !!input.elementUuid,
        "Replacement requires an explicit elementUuid",
      );
      const target = input.elementUuid
        ? findElement(component, input.elementUuid, studio)
        : component.tplTree;
      const parsedResult = ensure(assets.html, "HTML not prepared");
      if (parsedResult.isErr()) {
        collectWarnings(parsedResult.error.errors);
      }
      const parsed = ensureOk(parsedResult);
      collectWarnings(parsed.errors);
      apply = () => {
        assert(
          findElement(component, target.uuid) === target,
          "Target changed while HTML was being prepared",
        );
        assets.bindHtml?.(component);
        const errors = parsed.finalize({
          component,
          tplMgr: studio.tplMgr(),
          ccRegistry: studio.codeComponentsRegistry,
        });
        collectWarnings(errors);
        const result = pasteTpls(parsed.tpls, target, input.location, {
          site: studio.site,
          component,
          vtm,
          tplMgr: studio.tplMgr(),
          ccRegistry: studio.codeComponentsRegistry,
        });
        assert(
          !result.errors.length && result.pasted.length === parsed.tpls.length,
          `Insertion rejected: ${JSON.stringify(result.errors.map((e) => e.type))}`,
        );
      };
      break;
    }
    case "changeElement": {
      const input = operation.input;
      const styles = { ...input.styles };
      const cssStyle = document.createElement("div").style;
      for (const [property, value] of Object.entries(input.styles ?? {})) {
        const prop = normProp(property);
        cssStyle.setProperty(prop, "initial");
        const supported =
          value === null ||
          isValidStyleProp(prop) ||
          cssStyle.getPropertyValue(prop) === "initial";
        if (!supported) {
          delete styles[property];
          messages.push(`Ignored unsupported CSS property "${property}".`);
        }
        cssStyle.removeProperty(prop);
      }
      assert(
        input.name !== undefined ||
          input.text !== undefined ||
          input.props ||
          input.resetProps ||
          input.styles ||
          input.visibleIf !== undefined ||
          input.repeat !== undefined,
        "Provide name, text, props, resetProps, styles, visibleIf or repeat",
      );
      const tpl = findElement(component, input.elementUuid, studio);
      const variants = (input.variantUuids ?? []).map((uuid) =>
        ensure(
          [
            ...allComponentVariants(component),
            ...allGlobalVariants(studio.site, { includeDeps: "direct" }),
          ].find((v) => v.uuid === uuid),
          `Variant ${uuid} not found`,
        ),
      );
      const combo = variants.length ? variants : [getBaseVariant(component)];
      apply = () => {
        assert(
          findElement(component, tpl.uuid) === tpl,
          "Element removed during batch",
        );
        if (input.name !== undefined) {
          assert(
            isKnownTplTag(tpl) || isKnownTplComponent(tpl),
            "name requires a native element or component instance",
          );
          ensureOk(
            renameTpl(tpl, input.name, { component, tplMgr: studio.tplMgr() }),
          );
        }
        const setting = vtm.ensureVariantSetting(tpl, combo);
        if (input.text !== undefined) {
          assert(isTplTextBlock(tpl), "text requires a native text element");
          assert(
            !setting.text ||
              (isKnownRawText(setting.text) && !setting.text.markers.length),
            "Read and edit rich or bound text through its existing contract",
          );
          setting.text = new RawText({ text: input.text, markers: [] });
        }
        if (input.resetProps) {
          assert(
            isKnownTplComponent(tpl),
            "resetProps requires a component instance",
          );
          for (const name of input.resetProps) {
            assert(
              !(name in (input.props ?? {})),
              `Cannot set and reset ${name} in one call`,
            );
            const param = tpl.component.params.find(
              (p) => paramToVarName(tpl.component, p) === name,
            );
            if (!param) {
              messages.push(`Ignored reset of unknown component prop "${name}".`);
              continue;
            }
            const arg = setting.args.find((a) => a.param === param);
            assert(
              !arg ||
                !(
                  isKnownRenderExpr(arg.expr) ||
                  isKnownVirtualRenderExpr(arg.expr)
                ) ||
                arg.expr.tpl.length === 0,
              `Remove nonempty slot content before resetting ${name}`,
            );
            studio.tplMgr().delArg(tpl, setting, param.variable);
          }
        }
        if (input.visibleIf !== undefined) {
          setting.dataCond =
            input.visibleIf === null
              ? null
              : interpolatedStringToCodeExpr(input.visibleIf);
        }
        if (input.repeat !== undefined) {
          setting.dataRep =
            input.repeat === null
              ? null
              : mkNormalizedRep(
                  interpolatedStringToCodeExpr(input.repeat.collection),
                  input.repeat.itemName,
                  input.repeat.indexName,
                );
        }
        if (input.props) {
          assert(
            isKnownTplComponent(tpl),
            "props requires a component instance; use insertHtml to replace native text/markup",
          );
          const vs = vtm.ensureVariantSetting(tpl, combo);
          for (const [name, value] of Object.entries(input.props)) {
            const result = setComponentInstanceProp(tpl, name, value, {
              vs,
              tplMgr: studio.tplMgr(),
              registration: studio.getCodeComponentMeta(tpl.component)?.props[name],
            });
            if (result.isErr() && result.error.recoverable) {
              messages.push(
                `${result.error.message} The existing value or component default was kept.`,
              );
            } else {
              ensureOk(result);
            }
          }
        }
        if (input.styles) {
          messages.push(
            ...ensureOk(
              setTplStyles(tpl, styles, {
                studioCtx: studio,
                vtm,
                variantCombo: combo,
              }),
            ),
          );
        }
      };
      break;
    }
    case "deleteElement": {
      const tpl = findElement(component, operation.input.elementUuid, studio);
      messages.push(`Element "${("name" in tpl && tpl.name) || tpl.uuid}" deleted.`);
      apply = () => {
        assert(
          findElement(component, tpl.uuid) === tpl,
          "Element removed during batch",
        );
        ensureOk(deleteTpl([tpl], { component, site: studio.site, vtm }));
      };
      break;
    }
    case "copyElement":
    case "moveElement": {
      const input = operation.input;
      const source = findElement(component, input.elementUuid, studio);
      const target = findElement(component, input.targetUuid, studio);
      const copying = operation.name === "copyElement";
      if (!copying) {
        assert(source !== component.tplTree, "Cannot move root element");
        assert(
          !flattenTpls(source).includes(target),
          "Cannot move an element into itself or its descendant",
        );
      }
      apply = () => {
        assert(
          findElement(component, source.uuid) === source &&
            findElement(component, target.uuid) === target,
          "Element removed during batch",
        );
        if (copying) {
          const result = pasteTpls([clone(source)], target, input.location, {
            site: studio.site,
            component,
            vtm,
            tplMgr: studio.tplMgr(),
            ccRegistry: studio.codeComponentsRegistry,
          });
          assert(
            !result.errors.length && result.pasted.length === 1,
            `Copy rejected: ${JSON.stringify(result.errors.map((e) => e.type))}`,
          );
        } else {
          // insertTplAt append/prepend on the same parent is a no-op; use an edge sibling.
          let anchor = target;
          let location = input.location;
          if (
            source.parent === target &&
            (location === "append" || location === "prepend")
          ) {
            const siblings = tplChildren(target).filter((t) => t !== source);
            if (!siblings.length) {
              return;
            }
            anchor =
              location === "prepend"
                ? siblings[0]
                : siblings[siblings.length - 1];
            location = location === "prepend" ? "before" : "after";
          }
          const result = insertTplAt(source, anchor, location, {
            vtm,
            tplMgr: studio.tplMgr(),
          });
          assert(
            result.isOk(),
            `Move rejected: ${result.isErr() ? JSON.stringify(result.error) : ""}`,
          );
        }
      };
      break;
    }
    case "createState": {
      const input = operation.input;
      apply = () => {
        ensureOk(
          createComponentState({
            site: studio.site,
            component,
            tplMgr: studio.tplMgr(),
            name: input.name,
            variableType: input.variableType,
            ...(input.initialValue !== undefined
              ? { initialValue: codeLit(input.initialValue) }
              : {}),
          }),
        );
      };
      break;
    }
    case "updateState":
    case "deleteState": {
      const state = ensure(
        component.states.find(
          (s) => s.param.uuid === operation.input.stateUuid,
        ),
        "State not found",
      );
      apply = () => {
        assert(component.states.includes(state), "State removed during batch");
        if (operation.name === "deleteState") {
          ensureOk(
            deleteComponentState(state, { site: studio.site, component }),
          );
        } else {
          const changes = operation.input;
          ensureOk(
            updateComponentState(
              state,
              {
                name: changes.name,
                variableType: changes.variableType,
                ...(changes.initialValue !== undefined
                  ? { initialValue: codeLit(changes.initialValue) }
                  : {}),
              },
              { site: studio.site, component, tplMgr: studio.tplMgr() },
            ),
          );
        }
      };
      break;
    }
    case "createInteraction": {
      const input = operation.input;
      const tpl = findElement(component, input.elementUuid, studio);
      apply = () => {
        assert(
          findElement(component, tpl.uuid) === tpl,
          "Element removed during batch",
        );
        ensureOk(
          createInteraction({
            component,
            tpl,
            eventName: input.eventName,
            action: input.action,
            name: input.name,
          }),
        );
      };
      break;
    }
    case "updateInteraction":
    case "deleteInteraction": {
      const input = operation.input;
      const tpl = findElement(component, input.elementUuid, studio);
      const handler = ensure(
        [
          ...getAllEventHandlersOfAttrType(component, tpl),
          ...getAllEventHandlersOfParamType(component, tpl),
        ].find(
          (entry) =>
            isKnownEventHandler(entry.expr) &&
            entry.expr.interactions.some(
              (step) => step.uuid === input.interactionUuid,
            ),
        ),
        "Interaction not found on the target element",
      );
      assert(isKnownEventHandler(handler.expr), "Expected an event handler");
      const eventHandler = handler.expr;
      const interaction = ensure(
        eventHandler.interactions.find(
          (step) => step.uuid === input.interactionUuid,
        ),
        "Interaction not found",
      );
      apply = () => {
        assert(
          findElement(component, tpl.uuid) === tpl &&
            eventHandler.interactions.includes(interaction),
          "Element or interaction removed during batch",
        );
        if (operation.name === "updateInteraction") {
          ensureOk(updateInteraction(component, interaction, operation.input));
        } else {
          ensureOk(
            deleteInteraction({
              tpl,
              eventHandlerKey: handler.eventHandlerKey,
              interaction,
            }),
          );
        }
      };
      break;
    }
    case "createVariantGroup": {
      const input = operation.input;
      apply = () => {
        ensureOk(
          createVariantGroup({
            component,
            tplMgr: studio.tplMgr(),
            name: input.name,
            optionsType:
              input.optionsType === "singleChoice"
                ? VariantOptionsType.singleChoice
                : input.optionsType === "multiChoice"
                  ? VariantOptionsType.multiChoice
                  : VariantOptionsType.standalone,
          }),
        );
      };
      break;
    }
    case "createVariant": {
      const input = operation.input;
      const group = ensure(
        component.variantGroups.find((g) => g.uuid === input.groupUuid),
        "Component variant group not found",
      );
      apply = () => {
        ensureOk(
          createVariant({
            component,
            tplMgr: studio.tplMgr(),
            variantGroup: group,
            name: input.name,
          }),
        );
      };
      break;
    }
  }
  return {
    components: [component],
    messages,
    apply: () => {
      assert(
        studio.site.components.includes(component),
        "Component removed during batch",
      );
      apply();
    },

  };
}

function assertLocalBinding(studio: StudioCtx, binding: LocalEditBinding) {
  assertCanEditPrototype(studio);
  assert(
    studio.siteInfo.id === binding.projectId &&
      (studio.dbCtx().branchInfo?.id ?? null) === binding.branchId &&
      studio.aiSessionId === binding.sessionId,
    "The project, branch or editor session changed. Start a new AI request.",
  );
  assert(
    studio._changeCounter === binding.changeCounter,
    "The design changed while AI was working. Review the changes and start a new request.",
  );
}

function localSnapshot(studio: StudioCtx, components: Component[]) {
  return JSON.stringify(
    outputResult(
      components.map((component) =>
        buildComponentResource(component, { site: studio.site }),
      ),
    ),
  );
}

export const COPILOT_TOOLS: Record<string, CopilotTool<any>> = {
  executeLocalEdit: defineCopilotTool(
    meta.executeLocalEdit,
    async (studio, input) => {
      const binding = input.binding;
      assertLocalBinding(studio, binding);
      if (binding.mode === "page") {
        assert(
          studio.appCtx.appConfig.enableLocalAiPageGeneration,
          "AI page generation is disabled.",
        );
        assert(
          !binding.elementUuids.length,
          "Page generation requires a whole page scope.",
        );
      }
      const persistentMutation =
        input.execution &&
        ![
          "read",
          "queryElements",
          "getEditorContext",
          "selectElement",
          "scrollElementIntoView",
          "navigate",
          "validate",
          "save",
        ].includes(input.name);
      if (persistentMutation) {
        await studio.save();
        assert(
          !studio.hasUnsavedChanges(),
          "Save existing changes before AI editing.",
        );
        assertLocalBinding(studio, binding);
        studio.aiSaveReceipt = {
          operationId: ensure(input.execution, "Execution identity is required")
            .operationId,
          fence: ensure(input.execution, "Execution identity is required")
            .fence,
          sessionId: binding.sessionId,
        };
      }
      try {
        const finish = async (
          result: string,
          before?: string,
          after?: string,
          nextBinding = binding,
        ) => {
          const output = {
            result,
            before,
            after,
            changed: studio._changeCounter !== binding.changeCounter,
            binding: { ...nextBinding, changeCounter: studio._changeCounter },
          };
          if (persistentMutation && output.changed) {
            ensure(
              studio.aiSaveReceipt,
              "Execution receipt is missing",
            ).result = output;
            await studio.save();
            assert(
              !studio.hasUnsavedChanges(),
              "AI changes could not be saved. Verify the design before retrying.",
            );
          }
          return output;
        };
        if (input.name === "undo") {
          const result = await COPILOT_TOOLS.undo.execute(
            studio,
            {},
            { outputFormat: "json" },
          );
          assert(
            JSON.parse(result).undone &&
              studio._changeCounter !== binding.changeCounter,
            "No design transaction was undone.",
          );
          const removed =
            binding.mode === "page" &&
            !studio.site.components.some(
              (c) => c.uuid === binding.componentUuid,
            );
          return await finish(
            result,
            undefined,
            undefined,
            removed
              ? { ...binding, componentUuid: null, frameUuid: null }
              : binding,
          );
        }
        if (input.name === "createComponent") {
          assert(
            binding.mode === "page" && binding.componentUuid === null,
            "Create exactly one new page before generation.",
          );
          const parsed = meta.createComponent.inputSchema.parse(input.input);
          assert(
            parsed.type === "page" && parsed.path,
            "Page generation requires a routed page.",
          );
          const before = JSON.stringify(
            buildProjectResource(studio.site, undefined, {
              projectId: studio.siteInfo.id,
              components: true,
            }),
          );
          const [result] = await runNativeBatch(studio, [{ name: "createComponent", input: parsed }], () => assertLocalBinding(studio, binding));
          const created = ensure(result.created.find((identity) => identity.kind === "Component"), "Created page resource is missing");
          return await finish(JSON.stringify(result), before,
            localSnapshot(studio, [findComponent(studio, created.uuid)]),
            { ...binding, componentUuid: created.uuid });
        }
        if (
          input.name === "save" &&
          binding.mode === "page" &&
          binding.componentUuid === null
        ) {
          return await finish(
            await COPILOT_TOOLS.save.execute(
              studio,
              {},
              { outputFormat: "json" },
            ),
          );
        }
        const canvas =
          binding.canvasName !== undefined
            ? findCanvas(studio, binding.canvasName)
            : undefined;
        const componentsInScope = canvas
          ? [
              ...new Set(
                canvas.children.map((frame) => frame.container.component),
              ),
            ]
          : [
              findComponent(
                studio,
                ensure(
                  binding.componentUuid,
                  "Open a page or canvas before using AI.",
                ),
                true,
              ),
            ];
        const inScope = (componentUuid: string, elementUuid?: string) => {
          const component = findComponent(studio, componentUuid, true);
          assert(
            componentsInScope.includes(component),
            "AI operation is outside the bound page or canvas.",
          );
          if (elementUuid) {
            findElement(component, elementUuid);
          }
          return component;
        };
        if (input.name === "read") {
          const parsed = meta.read.inputSchema.parse(input.input);
          for (const uuid of parsed.componentUuids ?? []) {
            const candidate = findComponent(studio, uuid);
            assert(
              isCodeComponent(candidate) ||
                !studio.site.components.includes(candidate) ||
                componentsInScope.includes(candidate),
              "Read the bound page/canvas or an installed component contract.",
            );
          }
          for (const target of parsed.elements ?? []) {
            inScope(target.componentUuid, target.elementUuid);
          }
        } else if (input.name === "queryElements") {
          const parsed = meta.queryElements.inputSchema.parse(input.input);
          inScope(parsed.componentUuid, parsed.elementUuid);
        } else if (
          input.name === "selectElement" ||
          input.name === "scrollElementIntoView"
        ) {
          const parsed = meta[input.name].inputSchema.parse(input.input);
          inScope(parsed.componentUuid, parsed.elementUuid);
          const frames = canvas?.children.filter(
            (frame) => frame.container.component.uuid === parsed.componentUuid,
          );
          const frame =
            frames &&
            ensure(
              parsed.frameUuid
                ? frames.find(
                    (candidate) => candidate.uuid === parsed.frameUuid,
                  )
                : (frames.find(
                    (candidate) => candidate.uuid === binding.frameUuid,
                  ) ?? frames[0]),
              "AI navigation is outside the bound canvas.",
            );
          input.input = {
            ...parsed,
            ...(frame ? { frameUuid: frame.uuid } : {}),
          };
        } else if (input.name === "navigate") {
          const target = inScope(
            meta.navigate.inputSchema.parse(input.input).componentUuid,
          );
          if (canvas) {
            const frame = ensure(
              canvas.children.find(
                (candidate) => candidate.container.component === target,
              ),
              "Artboard not found",
            );
            const result = await COPILOT_TOOLS.navigateCanvas.execute(
              studio,
              { canvasName: canvas.name, frameUuid: frame.uuid },
              { outputFormat: "json" },
            );
            assertLocalBinding(studio, binding);
            return await finish(result);
          }
        } else if (input.name === "validate") {
          input.input = {
            componentUuids: componentsInScope.map(
              (component) => component.uuid,
            ),
          };
        }
        if (
          [
            "read",
            "queryElements",
            "getEditorContext",
            "selectElement",
            "scrollElementIntoView",
            "navigate",
            "validate",
            "save",
          ].includes(input.name)
        ) {
          const result = await ensure(
            COPILOT_TOOLS[input.name],
            "Unknown local tool",
          ).execute(studio, input.input, { outputFormat: "json" });
          assertLocalBinding(studio, binding);
          return await finish(result);
        }
        const rawOperations =
          input.name === "executeBatch"
            ? meta.executeBatch.inputSchema.parse(input.input).operations
            : [{ name: input.name, input: input.input }];
        const validateOperation = (op: PrototypeMutation) => {
          assertLocalBinding(studio, binding);
          assert(
            localEditToolNames.some((name) => name === op.name),
            "Tool is not allowed for canvas AI editing.",
          );
          assert("componentUuid" in op.input, "Target component is required");
          const elementUuid =
            "elementUuid" in op.input ? op.input.elementUuid : undefined;
          const component = inScope(
            ensure(op.input.componentUuid, "Target component is required"),
            elementUuid,
          );
          if (
            [
              "createState",
              "updateState",
              "deleteState",
              "setPageViewport",
            ].includes(op.name)
          ) {
            return op;
          }
          assert(
            elementUuid || op.name === "insertHtml",
            "Target element is required",
          );
          if (op.name === "copyElement" || op.name === "moveElement") {
            inScope(op.input.componentUuid, op.input.targetUuid);
          }
          const isRoot =
            component.tplTree.uuid === (elementUuid ?? component.tplTree.uuid);
          assert(
            !(
              isRoot &&
              (op.name === "deleteElement" ||
                op.name === "moveElement" ||
                (op.name === "insertHtml" &&
                  ["replace", "before", "after"].includes(op.input.location)))
            ),
            "Keep the component root identity; use changeElement.text for plain text.",
          );
          return op;
        };
        const operations = rawOperations.map((raw) => {
          const op = prototypeMutationSchema.parse(raw);
          assert(localEditToolNames.some((name) => name === op.name), "Tool is not allowed for canvas AI editing.");
          return op;
        });
        const finishActivity = studio.copilotActivity.begin(
          operations.map((op) => {
            assert("componentUuid" in op.input, "Target component is required");
            const component = inScope(
              ensure(op.input.componentUuid, "Target component is required"),
            );
            const tpl =
              "elementUuid" in op.input && op.input.elementUuid && !op.input.elementUuid.startsWith("$")
                ? findElement(component, op.input.elementUuid)
                : component.tplTree;
            return {
              componentUuid: component.uuid,
              elementUuid: tpl.uuid,
              ancestorUuids: ancestorsUp(tpl, true).map(
                (ancestor) => ancestor.uuid,
              ),
              label: `${component.name} / ${("name" in tpl && tpl.name) || tpl.uuid}`,
            };
          }),
        );
        try {
          const components = [
            ...new Set(
              operations.map((op) => {
                assert(
                  "componentUuid" in op.input,
                  "Target component is required",
                );
                return inScope(
                  ensure(
                    op.input.componentUuid,
                    "Target component is required",
                  ),
                );
              }),
            ),
          ];
          const before = localSnapshot(studio, components);
          const receipts = await runNativeBatch(studio, operations, validateOperation);
          const result = finish(JSON.stringify({ operations: receipts }), before, localSnapshot(studio, components));
          finishActivity("success");
          return result;
        } catch (error) {
          finishActivity("error");
          throw error;
        }
      } finally {
        if (persistentMutation && !studio.hasUnsavedChanges()) {
          studio.aiSaveReceipt = undefined;
        }
      }
    },
  ),
  identify: defineCopilotTool(meta.identify, async (studio, input) => {
    studio.setPreferredAiOutputFormat(input.outputFormat);
    return {
      projectId: studio.siteInfo.id,
      projectName: studio.siteInfo.name,
      canEdit:
        studio.canEditProject() &&
        studio.editMode &&
        !studio.isLiveMode &&
        !studio.isInteractiveMode &&
        studio.isAtTip &&
        !studio.blockChanges &&
        (!studio.siteInfo.isMainBranchProtected ||
          !!studio.dbCtx().branchInfo?.id),
    };
  }),
  read: defineCopilotTool(meta.read, async (studio, input) => {
    const fields = selectedReadFields(input);
    if (fields.includes("props") || fields.includes("refActions") || fields.includes("globalActions")) {
      await studio.ensureCodeComponentRegistrations();
    }
    const depth = readDepth(input);
    const read = { fields, depth: Number.isFinite(depth) ? depth : "all" as const,
      ...(input.propNames ? { propNames: input.propNames } : {}) };
    assert(!input.propNames || (input.view === "properties" && !!(input.componentUuids?.length || input.elements?.length || input.collection === "components")), "propNames requires targeted view:properties");
    const dependency = input.fromProject && input.fromProject !== studio.siteInfo.id
      ? ensure(walkDependencyTree(studio.site, "all").find((dep) => dep.projectId === input.fromProject),
        `Imported project not found: ${input.fromProject}. fromProject selects an already imported dependency; it does not open or install a project. Read collection:importedProjects in the current project, discover installLibrary through get_app_state, then explicitly install the published library before rereading its contract. To inspect its source without installing, explicitly open_design with that source projectId and later return to the consuming project.`) : undefined;
    const site = dependency?.site ?? studio.site;
    const projectId = dependency?.projectId ?? studio.siteInfo.id;
    const findReadComponent = (uuid: string) => {
      const component = findComponent(studio, uuid);
      assert(!input.fromProject || site.components.includes(component), "Component is outside the requested project scope");
      return component;
    };
    assert(!input.nameContains || input.collection, "nameContains requires collection");
    if (!input.componentUuids?.length && !input.elements?.length) {
      if (!input.collection && !input.fields && input.view !== "full") {
        return { __type: "OutputResult" as const, results: [{
          __type: "Project", id: projectId,
          counts: { components: site.components.length, canvases: site.arenas.length,
            globalContexts: site.globalContexts.length,
            pageFrames: site.pageArenas.reduce((total, arena) => total + [...arena.matrix.rows, ...arena.customMatrix.rows].reduce((count, row) => count + row.cols.length, 0), 0),
            devicePresets: frameSizeGroups.reduce((total, group) => total + group.sizes.length, 0),
            tokens: site.styleTokens.length, dataTokens: site.dataTokens.length,
            globalVariantGroups: site.globalVariantGroups.filter((group) => !isScreenVariantGroup(group) || group === site.activeScreenVariantGroup).length,
            screenBreakpoints: site.activeScreenVariantGroup?.variants.length ?? 0,
            importedProjects: site.projectDependencies.length },
        }], read: { fields: ["id", "counts"], depth: 0 } };
      }
      const requested: readonly string[] | undefined = input.collection ? [input.collection] : input.fields;
      const includes = (field: string) => !requested || requested.includes(field);
      const project = buildProjectResource(site, undefined, {
        projectId,
        components: includes("components"), tokens: includes("tokens"),
        globalContexts: includes("globalContexts"),
        dataTokens: includes("dataTokens"), screenBreakpoints: includes("screenBreakpoints"),
        globalVariants: includes("globalVariantGroups"),
        imports: false,
      });
      if (includes("importedProjects")) {
        project.importedProjects = site.projectDependencies.map((dep) => ({
          __type: "ImportedProject" as const, id: dep.projectId, name: dep.name,
          version: dep.version,
        }));
      }
      if (input.collection) {
        const values = project[input.collection] ?? [];
        const items = input.nameContains ? values.filter((item) => "name" in item && String(item.name).toLowerCase().includes(ensure(input.nameContains, "Filter missing").toLowerCase())) : values;
        const selected = items.slice(input.offset, input.offset + input.limit);
        const expand = input.collection === "components" && (input.view !== "tree" || !!input.fields);
        const page = expand
          ? selected.map((item) => readNativeModel(studio, findReadComponent(ensure("uuid" in item && typeof item.uuid === "string" ? item.uuid : undefined, "Component UUID missing")), undefined, input))
          : input.fields ? selected.map((item) => projectReadFields(item, input)) : selected;
        return { __type: "OutputResult" as const,
          results: [{ __type: "Project", id: project.id, [input.collection]: page }],
          read: { fields: [input.collection], depth: 0,
            ...(expand || input.fields ? { itemFields: fields, itemDepth: expand ? read.depth : 0 } : {}),
            ...(input.propNames ? { propNames: input.propNames } : {}) }, total: items.length,
          ...(input.offset + page.length < items.length ? { nextOffset: input.offset + page.length } : {}),
        };
      }
      return { __type: "OutputResult" as const,
        results: [input.fields ? projectReadFields(project, input) : project],
        read: { fields: input.fields ?? Object.keys(project), depth: 0 },
      };
    }
    assert(!input.collection, "collection requires a project read without component or element targets");
    return {
      __type: "OutputResult" as const, read,
      results: [
        ...(input.componentUuids ?? []).map((uuid) => readNativeModel(studio, findReadComponent(uuid), undefined, input)),
        ...(input.elements ?? []).map(({ componentUuid, elementUuid }) => {
          const component = findReadComponent(componentUuid);
          return readNativeModel(studio, component, findElement(component, elementUuid), input);
        }),
      ],
    };
  }),
  deleteCanvas: defineCopilotTool(meta.deleteCanvas, (studio, input) =>
    runMutation(studio, { name: "deleteCanvas", input }),
  ),
  updateCanvas: defineCopilotTool(meta.updateCanvas, (studio, input) =>
    runMutation(studio, { name: "updateCanvas", input }),
  ),
  updateArtboard: defineCopilotTool(meta.updateArtboard, (studio, input) =>
    runMutation(studio, { name: "updateArtboard", input }),
  ),
  setPageViewport: defineCopilotTool(meta.setPageViewport, (studio, input) =>
    runMutation(studio, { name: "setPageViewport", input }),
  ),
  deleteBreakpoint: defineCopilotTool(meta.deleteBreakpoint, (studio, input) =>
    runMutation(studio, { name: "deleteBreakpoint", input }),
  ),
  createCanvas: defineCopilotTool(meta.createCanvas, (studio, input) =>
    runMutation(studio, { name: "createCanvas", input }),
  ),
  createArtboard: defineCopilotTool(meta.createArtboard, (studio, input) =>
    runMutation(studio, { name: "createArtboard", input }),
  ),
  findEmptySpace: defineCopilotTool(
    meta.findEmptySpace,
    async (studio, input) => emptyCanvasSpace(studio, input),
  ),
  navigateCanvas: defineCopilotTool(
    meta.navigateCanvas,
    async (studio, input) => {
      const arena = findCanvas(studio, input.canvasName);
      const frame = input.frameUuid
        ? ensure(
            arena.children.find((f) => f.uuid === input.frameUuid),
            "Artboard not found",
          )
        : arena.children[0];
      assert(
        !studio.contentEditorMode,
        "Canvas navigation requires full editor permission",
      );
      studio.switchToArena(arena);
      if (frame) {
        studio.setStudioFocusOnFrame({ frame, autoZoom: true });
      }
      return { canvasName: arena.name, frameUuid: frame?.uuid, componentUuid: frame?.container.component.uuid };
    },
  ),
  readVector: defineCopilotTool(meta.readVector, async (studio, input) => {
    const { tpl, asset } = vectorAsset(
      studio,
      input.componentUuid,
      input.elementUuid,
    );
    return {
      elementUuid: tpl.uuid,
      assetUuid: asset.uuid,
      svg: await readSvgSource(ensure(asset.dataUri, "SVG source missing")),
      width: asset.width ?? null,
      height: asset.height ?? null,
    };
  }),
  updateVector: defineCopilotTool(meta.updateVector, (studio, input) =>
    runMutation(studio, { name: "updateVector", input }),
  ),
  installLibrary: defineCopilotTool(
    meta.installLibrary,
    async (studio, input) => {
      assertCanEditPrototype(studio);
      assert(
        !studio.contentEditorMode,
        "Library installation requires full editor permission",
      );
      const existing = studio.site.projectDependencies.find(
        (dep) => dep.projectId === input.projectId,
      );
      const dependency =
        existing ??
        (await studio.projectDependencyManager.addByProjectId(input.projectId));
      await studio.updateCcRegistry(usedHostLessPkgs(studio.site));
      return {
        projectId: dependency.projectId,
        version: dependency.version,
        installed: !existing,
      };
    },
  ),
  upgradeLibrary: defineCopilotTool(
    meta.upgradeLibrary,
    async (studio, input) => {
      assertCanEditPrototype(studio);
      assert(
        !studio.contentEditorMode,
        "Library upgrades require full editor permission",
      );
      const dependency = ensure(
        studio.site.projectDependencies.find(
          (dep) => dep.projectId === input.projectId,
        ),
        "Library is not installed in this project",
      );
      const previousVersion = dependency.version;
      const { pkg, depPkgs } = await studio.appCtx.api.getPkgVersion(
        dependency.pkgId,
      );
      const { projectDependency } = unbundleProjectDependency(
        studio.bundler(),
        pkg,
        depPkgs,
      );
      assert(
        projectDependency.projectId === input.projectId &&
          projectDependency.pkgId === dependency.pkgId,
        "Published package does not match installed library",
      );
      const upgraded = projectDependency.version !== previousVersion;
      if (upgraded) {
        // Align already installed dependencies with the selected publication in
        // one transaction, so intermediate versions cannot conflict.
        const requiredInstalledDeps = walkDependencyTree(
          projectDependency.site,
          "all",
        ).filter((required) =>
          studio.site.projectDependencies.some(
            (installed) =>
              installed.pkgId === required.pkgId &&
              installed.version !== required.version,
          ),
        );
        await studio.projectDependencyManager.upgradeProjectDeps([
          projectDependency,
          ...requiredInstalledDeps,
        ]);
      }
      return {
        projectId: input.projectId,
        previousVersion,
        version: projectDependency.version,
        upgraded,
      };
    },
  ),
  queryElements: defineCopilotTool(
    meta.queryElements,
    async (studio, input) => {
      const component = findComponent(studio, input.componentUuid);
      const root = input.elementUuid
        ? findElement(component, input.elementUuid)
        : component.tplTree;
      const matches = flattenTpls(root)
        .filter(
          (tpl) =>
            (!input.nameContains ||
              ("name" in tpl &&
                (tpl.name || "")
                  .toLowerCase()
                  .includes(input.nameContains.toLowerCase()))) &&
            (!input.tag || (isKnownTplTag(tpl) && tpl.tag === input.tag)) &&
            (!input.registeredComponentUuid ||
              (isKnownTplComponent(tpl) &&
                tpl.component.uuid === input.registeredComponentUuid)),
        );
      const depth = readDepth(input);
      const end = input.offset + input.limit;
      return {
        __type: "OutputResult" as const,
        read: { fields: selectedReadFields(input), depth: Number.isFinite(depth) ? depth : "all" as const,
          ...(input.propNames ? { propNames: input.propNames } : {}) },
        total: matches.length,
        ...(end < matches.length ? { nextOffset: end } : {}),
        results: matches.slice(input.offset, end).map((tpl) => readNativeModel(studio, component, tpl, input)),
      };
    },
  ),
  importWebPage: defineCopilotTool(
    meta.importWebPage,
    async (studio, input) => {
      assertCanEditPrototype(studio);
      assert(
        studio.siteInfo.id === input.projectId,
        "The import project is no longer open",
      );
      const source = input.sourceArena
        ? ensure(
            getArenaByNameOrUuidOrPath(
              studio.site,
              input.sourceArena.id,
              input.sourceArena.type,
            ),
            "Import source arena no longer exists",
          )
        : studio.currentArena;
      const destination = browserImportCanvas(studio, source);
      const sourceFrame = isDedicatedArena(source)
        ? getArenaFrames(source)[0]
        : undefined;
      const component = mkComponent({
        name: "",
        type: ComponentType.Frame,
        tplTree: (baseVariant) =>
          mkTplTagX("div", {
            name: "ArtboardRoot",
            baseVariant,
            styles: {
              display: "flex",
              "flex-direction": "column",
              width: "stretch",
              height: "stretch",
            },
          }),
      });
      const frame = mkArenaFrame({
        site: studio.site,
        component,
        name: input.name,
        width: input.width,
        height: input.height ?? 900,
      });
      const vtm = new VariantTplMgr(
        [
          new RootComponentVariantFrame(
            ensure(frame, "Import frame is missing"),
          ),
        ],
        studio.site,
        studio.tplMgr(),
        new GlobalVariantFrame(
          studio.site,
          ensure(frame, "Import frame is missing"),
        ),
      );
      // Remote DOM is static content, never an editor program or registration.
      const doc = new DOMParser().parseFromString(input.html, "text/html");
      doc
        .querySelectorAll("script,iframe,object,embed,link,style,meta,base")
        .forEach((node) => node.remove());
      for (const original of Array.from(doc.body.querySelectorAll("*"))) {
        let node = original;
        if (
          node.tagName.includes("-") ||
          ["SLOT", "TEMPLATE"].includes(node.tagName)
        ) {
          const replacement = doc.createElement("div");
          for (const attr of Array.from(node.attributes)) {
            replacement.setAttribute(attr.name, attr.value);
          }
          replacement.append(...Array.from(node.childNodes));
          node.replaceWith(replacement);
          node = replacement;
        }
        for (const attr of Array.from(node.attributes)) {
          if (
            attr.name.startsWith("data-") ||
            /^on/i.test(attr.name) ||
            attr.name === "srcdoc" ||
            /^(javascript|vbscript):/i.test(attr.value.trim())
          ) {
            node.removeAttribute(attr.name);
          }
        }
      }
      const parsed = ensureOk(
        await htmlToTpl(doc.body.innerHTML, {
          site: studio.site,
          vtm,
          appCtx: studio.appCtx,
          pageHrefs: false,
          staticContent: true,
        }),
      );
      const target = component.tplTree;
      let inserted: TplNode[] = [];
      let canvasName = "";
      const warnings = parsed.errors.map(formatWIError);
      await change(studio, [], () => {
        assert(
          studio.siteInfo.id === input.projectId,
          "The import project is no longer open",
        );
        assert(
          !destination || studio.site.arenas.includes(destination),
          "Import destination changed; retry",
        );
        const arena =
          destination ?? studio.tplMgr().addArena(browserImportCanvasName());
        canvasName = arena.name;
        if (
          sourceFrame &&
          !arena.children.some(
            (candidate) =>
              candidate.container.component === sourceFrame.container.component,
          )
        ) {
          const reference = cloneArenaFrame(sourceFrame);
          reference.name = sourceFrame.container.component.name;
          studio.tplMgr().addExistingArenaFrame(arena, reference, new Pt(0, 0));
        }
        studio.tplMgr().attachComponent(component);
        const insertPt = arena.children.length
          ? new Pt(
              Math.max(
                ...arena.children.map(
                  (candidate) => (candidate.left ?? 0) + candidate.width,
                ),
              ) + 80,
              arena.children[0].top ?? 0,
            )
          : new Pt(0, 0);
        studio.tplMgr().addExistingArenaFrame(arena, frame, insertPt);
        ensureActivatedScreenVariantsForFrameByWidth(studio.site, frame);
        warnings.push(
          ...parsed
            .finalize({
              component,
              tplMgr: studio.tplMgr(),
              ccRegistry: studio.codeComponentsRegistry,
            })
            .map(formatWIError),
        );
        const result = pasteTpls(parsed.tpls, target, "append", {
          site: studio.site,
          component,
          vtm,
          tplMgr: studio.tplMgr(),
          ccRegistry: studio.codeComponentsRegistry,
        });
        assert(
          !result.errors.length && result.pasted.length === parsed.tpls.length,
          "The import target cannot contain these elements",
        );
        inserted = result.pasted;
      });
      return {
        canvasName,
        frameUuid: frame.uuid,
        componentUuid: component.uuid,
        elementUuids: inserted.map((tpl) => tpl.uuid),
        warnings,
      };
    },
  ),
  createComponent: defineCopilotTool(meta.createComponent, (studio, input) =>
    runMutation(studio, { name: "createComponent", input }),
  ),
  insertHtml: defineCopilotTool(meta.insertHtml, (studio, input) =>
    runMutation(studio, { name: "insertHtml", input }),
  ),
  changeElement: defineCopilotTool(meta.changeElement, (studio, input) =>
    runMutation(studio, { name: "changeElement", input }),
  ),
  deleteElement: defineCopilotTool(meta.deleteElement, (studio, input) =>
    runMutation(studio, { name: "deleteElement", input }),
  ),
  createState: defineCopilotTool(meta.createState, (studio, input) =>
    runMutation(studio, { name: "createState", input }),
  ),
  createInteraction: defineCopilotTool(
    meta.createInteraction,
    (studio, input) =>
      runMutation(studio, { name: "createInteraction", input }),
  ),
  updateInteraction: defineCopilotTool(
    meta.updateInteraction,
    (studio, input) =>
      runMutation(studio, { name: "updateInteraction", input }),
  ),
  deleteInteraction: defineCopilotTool(
    meta.deleteInteraction,
    (studio, input) =>
      runMutation(studio, { name: "deleteInteraction", input }),
  ),
  createStyleToken: defineCopilotTool(meta.createStyleToken, (studio, input) =>
    runMutation(studio, { name: "createStyleToken", input }),
  ),
  copyElement: defineCopilotTool(meta.copyElement, (studio, input) =>
    runMutation(studio, { name: "copyElement", input }),
  ),
  moveElement: defineCopilotTool(meta.moveElement, (studio, input) =>
    runMutation(studio, { name: "moveElement", input }),
  ),
  updateState: defineCopilotTool(meta.updateState, (studio, input) =>
    runMutation(studio, { name: "updateState", input }),
  ),
  deleteState: defineCopilotTool(meta.deleteState, (studio, input) =>
    runMutation(studio, { name: "deleteState", input }),
  ),
  updateStyleToken: defineCopilotTool(meta.updateStyleToken, (studio, input) =>
    runMutation(studio, { name: "updateStyleToken", input }),
  ),
  deleteStyleToken: defineCopilotTool(meta.deleteStyleToken, (studio, input) =>
    runMutation(studio, { name: "deleteStyleToken", input }),
  ),
  createVariantGroup: defineCopilotTool(
    meta.createVariantGroup,
    (studio, input) =>
      runMutation(studio, { name: "createVariantGroup", input }),
  ),
  createVariant: defineCopilotTool(meta.createVariant, (studio, input) =>
    runMutation(studio, { name: "createVariant", input }),
  ),
  createGlobalVariantGroup: defineCopilotTool(
    meta.createGlobalVariantGroup,
    (studio, input) =>
      runMutation(studio, { name: "createGlobalVariantGroup", input }),
  ),
  createGlobalVariant: defineCopilotTool(
    meta.createGlobalVariant,
    (studio, input) =>
      runMutation(studio, { name: "createGlobalVariant", input }),
  ),
  createBreakpoint: defineCopilotTool(meta.createBreakpoint, (studio, input) =>
    runMutation(studio, { name: "createBreakpoint", input }),
  ),
  deleteComponent: defineCopilotTool(meta.deleteComponent, (studio, input) =>
    runMutation(studio, { name: "deleteComponent", input }),
  ),
  executeBatch: defineCopilotTool(meta.executeBatch, async (studio, input) => ({
    operations: await runNativeBatch(studio, input.operations),
  })),
  getEditorContext: defineCopilotTool(meta.getEditorContext, async (studio) => {
    const vc = studio.focusedViewCtx();
    const previewFrame = studio.isLiveMode
      ? document.querySelector<HTMLIFrameElement>('[data-test-id="live-frame"]')
      : null;
    const val = vc?.focusedSelectable();
    const tpl =
      vc?.focusedTpl(false) ??
      (val instanceof SlotSelection ? val.getTpl() : undefined);
    const instanceIndex =
      tpl && val && !(val instanceof SlotSelection)
        ? vc?.renderState.tpl2fullKeys(tpl).indexOf(val.fullKey)
        : undefined;
    return {
      selectedSlot:
        val instanceof SlotSelection
          ? {
              elementUuid: val.getTpl().uuid,
              slotName: val.slotParam.variable.name,
            }
          : null,
      projectName: studio.siteInfo.name,
      projectSummary: {
        artboards: studio.currentArena ? getArenaFrames(studio.currentArena).length : 0,
        canvases: studio.site.arenas.length,
        images: studio.site.imageAssets.filter((asset) => asset.type === "picture").length,
        libraries: studio.site.projectDependencies.length,
        pages: studio.site.components.filter(isPageComponent).length,
        components: studio.site.components.filter((component) => !isPageComponent(component) && !isCodeComponent(component) && !isFrameComponent(component)).length,
      },
      saveStatus: studio.saveStatus,
      canvasName: studio.currentArena ? getArenaName(studio.currentArena) : null,
      projectId: studio.siteInfo.id,
      branchId: studio.dbCtx().branchInfo?.id ?? null,
      sessionId: studio.aiSessionId,
      revision: studio.dbCtx().revisionNum,
      componentName:
        vc?.currentComponent()?.name ??
        (isDedicatedArena(studio.currentArena)
          ? studio.currentArena.component.name
          : null),
      changeCounter: studio._changeCounter,
      browserImportCanvasName:
        browserImportCanvas(studio)?.name ?? browserImportCanvasName(),
      editorView: editorView(studio),
      previewKind: studio.previewCtx?.popup ? "external" as const
        : studio.isInteractiveMode ? "interactive" as const
        : studio.isLiveMode ? "in-app" as const : null,
      previewContext:
        studio.isLiveMode && studio.previewCtx
          ? {
              componentUuid: studio.previewCtx.component?.uuid ?? null,
              componentName: studio.previewCtx.component?.name ?? null,
              path: `/${studio.previewCtx.previewPath.replace(/^\/+/, "")}`,
              width: previewFrame?.clientWidth || studio.previewCtx.width,
              height: previewFrame?.clientHeight || studio.previewCtx.height,
              canGoBack: studio.previewCtx.canGoBack ?? false,
              canGoForward: studio.previewCtx.canGoForward ?? false,
            }
          : studio.isInteractiveMode && vc
            ? {
                componentUuid: vc.currentComponent().uuid,
                componentName: vc.currentComponent().name,
                path: vc.currentComponent().pageMeta?.path ?? null,
                width: vc.arenaFrame().width,
                height: getFrameHeight(vc.arenaFrame()),
              }
            : null,
      componentUuid:
        vc?.currentComponent()?.uuid ??
        (isDedicatedArena(studio.currentArena)
          ? studio.currentArena.component.uuid
          : null),
      frameUuid: (vc?.arenaFrame() ?? studio.focusedFrame())?.uuid ?? null,
      selectedElementUuids:
        vc?.focusedTpls().flatMap((node) => (node ? [node.uuid] : [])) ?? [],
      instanceIndex:
        instanceIndex !== undefined && instanceIndex >= 0
          ? instanceIndex
          : null,
      mode:
        studio.isLiveMode || studio.isInteractiveMode
          ? ("preview" as const)
          : ("edit" as const),
      canEdit:
        studio.canEditProject() &&
        studio.editMode &&
        !studio.isLiveMode &&
        !studio.isInteractiveMode &&
        studio.isAtTip &&
        !studio.blockChanges &&
        (!studio.siteInfo.isMainBranchProtected ||
          !!studio.dbCtx().branchInfo?.id),
      path:
        vc && tpl
          ? selectionPath(vc, val instanceof SlotSelection ? val : tpl).map(
              ({ node: _node, ...part }) => part,
            )
          : [],
    };
  }),
  preview: defineCopilotTool(meta.preview, async (studio, input) => {
    assert(input.action === "close" || !studio.isInteractiveMode, "Exit interactive canvas mode before opening Preview");
    assert((input.width === undefined) === (input.height === undefined), "Preview width and height must be supplied together");
    assert(input.action === "open" || (input.componentUuid === undefined && input.width === undefined && input.height === undefined), `${input.action} accepts no Page or viewport overrides`);
    const component = input.componentUuid ? findComponent(studio, input.componentUuid) : undefined;
    if (component && !isPageComponent(component)) {
      throw new Error(`Preview target must be a local Page; "${component.name}" is a component. To inspect component rendering, navigate to its canvas artboard and use get_screenshot.`);
    }
    assert(!component || (studio.site.components.includes(component) && isPageComponent(component)), "Preview target must be a local Page");
    const preview = ensure(studio.previewCtx, "Native Preview is unavailable");
    assert(!preview.popup, "Close the external Preview window before using in-app Preview");
    if (input.action === "close") {
      const wasPreview = preview.isLive || studio.isInteractiveMode;
      await preview.stopLiveMode();
      studio.isInteractiveMode = false;
      await asyncTimeout(0);
      await preview.parseRoute();
      const saved = previewEditorViews.get(studio);
      if (wasPreview && saved) {
        await restoreEditorView(studio, saved);
      } else if (wasPreview && studio.currentArena) {
        await studio.awaitStudioReady();
      }
      previewEditorViews.delete(studio);
    } else if (input.action !== "open") {
      assert(preview.isLive, "Open native Preview before navigating or refreshing");
      if (input.action === "back") {
        await preview.goBack();
      } else if (input.action === "forward") {
        await preview.goForward();
      } else {
        flushSync(() => preview.refresh());
      }
    } else {
      if (!preview.isLive) {
        const view = editorView(studio);
        if (view) {
          previewEditorViews.set(studio, meta.restoreEditorView.inputSchema.parse(view));
        }
        try {
          await preview.toggleLiveMode();
        } catch (error) {
          if (!preview.isLive) {
            previewEditorViews.delete(studio);
          }
          throw error;
        }
        await asyncTimeout(0);
        await preview.parseRoute();
      }
      assert(preview.isLive, "Native Preview did not open");
      if (component) {
        await preview.pushComponent(component);
        await preview.parseRoute();
      }
      if (input.width !== undefined && input.height !== undefined) {
        await preview.pushViewport({ viewport: "custom", width: input.width, height: input.height });
      }
    }
    await asyncTimeout(0);
    await preview.parseRoute();
    const active = preview.isLive;
    assert(active === (input.action !== "close"), "Native Preview route change did not complete");
    assert(!active || !component || preview.component === component, "Native Preview opened a different Page");
    assert(!active || input.width === undefined || (preview.width === input.width && preview.height === input.height), "Native Preview viewport change did not complete");
    return { mode: active ? "preview" as const : "edit" as const,
      componentUuid: active ? preview.component?.uuid ?? null : null,
      path: active ? `/${preview.previewPath.replace(/^\/+/, "")}` : null,
      width: active ? preview.width : null, height: active ? preview.height : null,
      canGoBack: active && (preview.canGoBack ?? false),
      canGoForward: active && (preview.canGoForward ?? false) };
  }),
  restoreEditorView: defineCopilotTool(
    meta.restoreEditorView,
    restoreEditorView,
  ),
  selectElement: defineCopilotTool(
    meta.selectElement,
    async (studio, input) => {
      assert(
        !studio.isLiveMode && !studio.isInteractiveMode,
        "Return to edit mode before selecting an element",
      );
      let component = findComponent(studio, input.componentUuid);
      let tpl = flattenTpls(component.tplTree).find((t) => t.uuid === input.elementUuid);
      if (!tpl) {
        const owner = studio.site.components.find((c) =>
          c !== component && flattenTpls(c.tplTree).some((t) => t.uuid === input.elementUuid),
        );
        if (owner) {
          component = owner;
          tpl = flattenTpls(owner.tplTree).find((t) => t.uuid === input.elementUuid);
        }
      }
      assert(
        tpl,
        `Element ${input.elementUuid} not found in component ${component.name}`,
      );
      const frames = getArenaFrames(studio.currentArena);
      const focusedFrame = input.frameUuid
        ? frames.find((frame) => frame.uuid === input.frameUuid)
        : (studio.focusedViewCtx()?.arenaFrame() ?? studio.focusedFrame());
      if (
        focusedFrame &&
        frames.includes(focusedFrame) &&
        focusedFrame.container.component === component
      ) {
        const focusedView =
          studio.tryGetViewCtxForFrame(focusedFrame) ??
          (await withTimeout(
            studio.awaitViewCtxForFrame(focusedFrame),
            "Timed out waiting for the selected canvas",
            30000,
          ));
        await focusedView.awaitSync();
      }
      const candidates = studio.viewCtxs.filter(
        (vc) =>
          frames.includes(vc.arenaFrame()) &&
          (!input.frameUuid || vc.arenaFrame().uuid === input.frameUuid) &&
          vc.renderState.tpl2fullKeys(tpl).length > 0,
      );
      const vc =
        candidates.find(
          (candidate) =>
            candidate === studio.focusedViewCtx() ||
            candidate.arenaFrame() === focusedFrame,
        ) ?? (candidates.length === 1 ? candidates[0] : undefined);
      assert(
        vc,
        candidates.length > 1
          ? "Multiple artboards render this element; specify frameUuid"
          : "Element is not rendered in the current canvas",
      );
      const key = vc.renderState.tpl2fullKeys(tpl)[input.instanceIndex];
      const val = key ? vc.renderState.fullKey2val(key) : undefined;
      assert(val, "Rendered instance not found; check instanceIndex");
      await vc.change(() => vc.setStudioFocusBySelectable(val));
      return {
        componentUuid: component.uuid,
        elementUuid: tpl.uuid,
        frameUuid: vc.arenaFrame().uuid,
        instanceIndex: input.instanceIndex,
      };
    },
  ),
  navigate: defineCopilotTool(meta.navigate, async (studio, input) => {
    const component = findComponent(studio, input.componentUuid, true);
    studio.switchToComponentArena(component);
    return { componentUuid: component.uuid, rootElementUuid: component.tplTree.uuid };
  }),
  beginCanvasInspection: defineCopilotTool(
    meta.beginCanvasInspection,
    (studio, input) =>
      beginCanvasInspection(
        studio,
        input.componentUuid
          ? findComponent(studio, input.componentUuid, true)
          : undefined,
        input,
      ),
  ),
  endCanvasInspection: defineCopilotTool(
    meta.endCanvasInspection,
    (studio, input) => endCanvasInspection(studio, input.inspectionId),
  ),
  scrollElementIntoView: defineCopilotTool(
    meta.scrollElementIntoView,
    async (studio, input) => {
      let component = findComponent(studio, input.componentUuid);
      let tpl = flattenTpls(component.tplTree).find((t) => t.uuid === input.elementUuid);
      if (!tpl) {
        const owner = studio.site.components.find((c) =>
          c !== component && flattenTpls(c.tplTree).some((t) => t.uuid === input.elementUuid),
        );
        if (owner) {
          component = owner;
          tpl = flattenTpls(owner.tplTree).find((t) => t.uuid === input.elementUuid);
        }
      }
      assert(
        tpl,
        `Element ${input.elementUuid} not found in component ${component.name}`,
      );
      const frames = getArenaFrames(studio.currentArena);
      const candidates = studio.viewCtxs.filter(
        (vc) =>
          frames.includes(vc.arenaFrame()) &&
          (!input.frameUuid || vc.arenaFrame().uuid === input.frameUuid) &&
          vc.renderState.tpl2fullKeys(tpl).length > 0,
      );
      const focused = studio.focusedViewCtx();
      const vc =
        candidates.find((candidate) => candidate === focused) ??
        (candidates.length === 1 ? candidates[0] : undefined);
      assert(
        vc,
        candidates.length > 1
          ? "Multiple artboards render this element; specify frameUuid"
          : "Element is not rendered in the current canvas; navigate to its page and wait for rendering",
      );
      const key = vc.renderState.tpl2fullKeys(tpl)[input.instanceIndex];
      const val = key ? vc.renderState.fullKey2val(key) : undefined;
      assert(val, "Rendered instance not found; check instanceIndex");
      const node = vc.renderState
        .val2dom(val, vc.canvasCtx)
        ?.find((dom) => dom.isConnected && dom.getClientRects().length > 0);
      assert(node, "Element is hidden or has no rendered layout box");
      revealCanvasElement(node);
      const rect = node.getBoundingClientRect();
      return {
        componentUuid: component.uuid,
        elementUuid: tpl.uuid,
        frameUuid: vc.arenaFrame().uuid,
        instanceIndex: input.instanceIndex,
        visible: isCanvasElementVisible(node),
        bounds: {
          x: rect.x,
          y: rect.y,
          width: rect.width,
          height: rect.height,
        },
      };
    },
  ),
  validate: defineCopilotTool(meta.validate, async (studio, input) => {
    const components = input.componentUuids
      ? input.componentUuids.map((uuid) => findComponent(studio, uuid, true))
      : studio.site.components.filter((c) => !isCodeComponent(c));
    const errors = [...genSiteErrors(studio.site)].map((e) => e.message);
    const warnings: string[] = [];
    for (const component of components) {
      if (flattenTpls(component.tplTree).length === 1) {
        warnings.push(`Component "${component.name}" has no child elements.`);
      }
    }
    return {
      check: "model" as const,
      notChecked: ["visual-layout", "interactions", "responsive-breakpoints"],
      valid: !errors.length,
      errors,
      warnings,
      pages: components.filter(isPageComponent).length,
      components: components.length,
    };
  }),
  save: defineCopilotTool(meta.save, async (studio) => {
    assertCanEditPrototype(studio);
    assertSiteInvariants(studio.site);
    const result = await studio.save();
    assert(
      !studio.hasUnsavedChanges(),
      `Save did not persist all changes (${String(result)}); retry or resolve the editor's save error`,
    );
    return {
      projectId: studio.siteInfo.id,
      revision: studio.dbCtx().revisionNum,
      saved: true as const,
    };
  }),
  undo: defineCopilotTool(meta.undo, async (studio) => {
    assertCanEditPrototype(studio);
    const undone = studio.canUndo();
    if (undone) {
      await studio.undo();
    }
    return { undone };
  }),
};
