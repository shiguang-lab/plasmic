import { unbundleProjectDependency } from "@/wab/shared/core/tagged-unbundle";
import { usedHostLessPkgs } from "@/wab/shared/cached-selectors";
import { getFrameHeight, normalizeMixedArenaFrames } from "@/wab/shared/Arenas";
import { Pt } from "@/wab/shared/geom";
import { readAndSanitizeSvgXmlAsImage } from "@/wab/client/dom-utils";
import { getOnlyAssetRef } from "@/wab/shared/core/image-assets";
import { parseDataUrlToSvgXml } from "@/wab/shared/data-urls";
import { deleteComponent } from "@/wab/client/operations/delete-component";
import { ScreenSizeSpec } from "@/wab/shared/css-size";
import { isScreenVariantGroup } from "@/wab/shared/Variants";
import { interpolatedStringToCodeExpr } from "@/wab/shared/copilot/dynamic-value-input";
import { mkNormalizedRep } from "@/wab/shared/copilot/utils";
import { createVariantGroup } from "@/wab/client/operations/create-variant-group";
import { createVariant } from "@/wab/client/operations/create-variant";
import { updateComponentState } from "@/wab/client/operations/update-component-state";
import { deleteComponentState } from "@/wab/client/operations/delete-component-state";
import { deleteStyleToken } from "@/wab/client/operations/delete-style-token";
import { setStyleTokenVariantedValue } from "@/wab/client/operations/set-style-token-varianted-value";
import { VariantOptionsType } from "@/wab/shared/TplMgr";
import { createComponent } from "@/wab/client/operations/create-component";
import { createComponentState } from "@/wab/client/operations/create-component-state";
import { createInteraction } from "@/wab/client/operations/create-interaction";
import { createStyleToken } from "@/wab/client/operations/create-style-token";
import { deleteTpl } from "@/wab/client/operations/delete-tpl";
import { htmlToTpl } from "@/wab/client/operations/html-to-tpl";
import { insertTplAt, pasteTpls } from "@/wab/client/operations/insert-tpl";
import { setComponentInstanceProp } from "@/wab/client/operations/set-component-instance-prop";
import { setTplStyles } from "@/wab/client/operations/set-tpl-styles";
import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { formatWIError } from "@/wab/client/web-importer/errors";
import { getComponentArenaBaseFrame } from "@/wab/shared/component-arenas";
import {
  GlobalVariantFrame,
  RootComponentVariantFrame,
} from "@/wab/shared/component-frame";
import { assert, ensure } from "@/wab/shared/common";
import {
  CopilotTool,
  defineCopilotTool,
} from "@/wab/shared/copilot/copilot-tool-types";
import {
  PROTOTYPE_TOOL_META as meta,
  type PrototypeMutation,
} from "@/wab/shared/copilot/prototype-tools";
import {
  allComponentVariants,
  ComponentType,
  isCodeComponent,
  isPageComponent,
} from "@/wab/shared/core/components";
import { codeLit } from "@/wab/shared/core/exprs";
import {
  allGlobalVariants,
  getComponentArena,
  getPageArena,
} from "@/wab/shared/core/sites";
import {
  clone,
  flattenTpls,
  tplChildren,
  isTplImage,
} from "@/wab/shared/core/tpls";
import {
  Component,
  isKnownTplComponent,
  isKnownTplTag,
  TplNode,
} from "@/wab/shared/model/classes";
import {
  assertSiteInvariants,
  genSiteErrors,
} from "@/wab/shared/site-invariants";
import { VariantTplMgr } from "@/wab/shared/VariantTplMgr";
import { getBaseVariant } from "@/wab/shared/Variants";
import {
  buildComponentResource,
  buildElementResource,
} from "@/wab/shared/web-exporter/component-exporter";
import {
  buildProjectResource,
  buildTokenResource,
} from "@/wab/shared/web-exporter/project-exporter";
import {
  outputResult,
  type ReadResultJson,
} from "@/wab/shared/web-exporter/schema";
import { ok } from "neverthrow";
import { ensureOk } from "@/wab/commons/neverthrow-utils";

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
    if (input.direction === "right") x += anchor.width + input.padding;
    else if (input.direction === "left") x -= input.width + input.padding;
    else if (input.direction === "bottom") y += anchor.height + input.padding;
    else y -= input.height + input.padding;
  }
  for (let step = 0; step <= rects.length; step++) {
    const hits = rects.filter(
      (r) =>
        x < r.x + r.width + input.padding &&
        x + input.width + input.padding > r.x &&
        y < r.y + r.height + input.padding &&
        y + input.height + input.padding > r.y,
    );
    if (!hits.length) return { canvasName: arena.name, x, y };
    if (input.direction === "right")
      x = Math.max(...hits.map((r) => r.x + r.width + input.padding));
    else if (input.direction === "left")
      x = Math.min(...hits.map((r) => r.x - input.width - input.padding));
    else if (input.direction === "bottom")
      y = Math.max(...hits.map((r) => r.y + r.height + input.padding));
    else y = Math.min(...hits.map((r) => r.y - input.height - input.padding));
  }
  throw new Error("Cannot find an empty artboard position");
}
function canvasResult(studio: StudioCtx) {
  return outputResult([
    buildProjectResource(studio.site, undefined, {
      projectId: studio.siteInfo.id,
    }),
  ]);
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
  if (dataUri.startsWith("data:image/svg+xml"))
    return parseDataUrlToSvgXml(dataUri);
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
        ...studio.site.projectDependencies.flatMap(
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

function findElement(component: Component, uuid: string): TplNode {
  return ensure(
    flattenTpls(component.tplTree).find((t) => t.uuid === uuid),
    `Element ${uuid} not found in component ${component.name}`,
  );
}

function variantManager(studio: StudioCtx, component: Component) {
  const arena = ensure(
    isPageComponent(component)
      ? getPageArena(studio.site, component)
      : getComponentArena(studio.site, component),
    "Component arena not found",
  );
  const frame = getComponentArenaBaseFrame(arena);
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

function componentResult(
  studio: StudioCtx,
  component: Component,
  messages?: string[],
) {
  return outputResult(
    [buildComponentResource(component, { site: studio.site })],
    messages,
  );
}

type MutationPlan = {
  components: Component[];
  apply: () => void;
  result: () => ReturnType<typeof outputResult<ReadResultJson>>;
};

async function runMutation(studio: StudioCtx, operation: PrototypeMutation) {
  assertCanEditPrototype(studio);
  const plan = await prepareMutation(studio, operation);
  await change(studio, plan.components, plan.apply);
  return plan.result();
}

/** Preparation is read-only; every apply is synchronous inside one recorder. */
async function prepareMutation(
  studio: StudioCtx,
  operation: PrototypeMutation,
): Promise<MutationPlan> {
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
      result: () => canvasResult(studio),
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
        normalizeMixedArenaFrames(arena);
      },
      result: () => canvasResult(studio),
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
      await readAndSanitizeSvgXmlAsImage(studio.appCtx, input.svg),
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
      result: () => componentResult(studio, component),
    };
  }
  if (operation.name === "createComponent") {
    const input = operation.input;
    let created: Component | undefined;
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
        created = ensureOk(
          createComponent({
            tplMgr: studio.tplMgr(),
            name: input.name,
            type:
              input.type === "page" ? ComponentType.Page : ComponentType.Plain,
            ...(input.path ? { pageMeta: { path: input.path } } : {}),
          }),
        );
      },
      result: () =>
        componentResult(studio, ensure(created, "Component not created")),
    };
  }
  if (operation.name === "createStyleToken") {
    // Capture the resource only after Studio finishes model fixups.
    let created: import("@/wab/shared/model/classes").StyleToken | undefined;
    return {
      components: [],
      apply: () => {
        created = ensureOk(
          createStyleToken({ tplMgr: studio.tplMgr(), ...operation.input }),
        );
      },
      result: () =>
        outputResult([
          buildTokenResource(ensure(created, "Token not created"), {
            site: studio.site,
          }),
        ]),
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
        result: () =>
          outputResult([
            buildProjectResource(studio.site, undefined, {
              projectId: studio.siteInfo.id,
              tokens: true,
            }),
          ]),
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
        if (input.name !== undefined)
          studio.tplMgr().renameStyleToken(token, input.name);
        if (input.value !== undefined) {
          if (variants.length)
            ensureOk(
              setStyleTokenVariantedValue({
                site: studio.site,
                token,
                variants,
                value: input.value,
              }),
            );
          else {
            assert(input.value !== null, "Base token value cannot be null");
            token.value = input.value;
          }
        }
      },
      result: () =>
        outputResult([buildTokenResource(token, { site: studio.site })]),
    };
  }
  if (
    operation.name === "createGlobalVariantGroup" ||
    operation.name === "createGlobalVariant" ||
    operation.name === "createBreakpoint"
  ) {
    const result = () =>
      outputResult([
        buildProjectResource(studio.site, undefined, {
          projectId: studio.siteInfo.id,
          globalVariants: true,
          screenBreakpoints: true,
        }),
      ]);
    if (operation.name === "createGlobalVariantGroup")
      return {
        components: studio.site.components,
        apply: () => {
          studio.tplMgr().createGlobalVariantGroup(operation.input.name);
        },
        result,
      };
    if (operation.name === "createGlobalVariant") {
      const input = operation.input;
      const group = ensure(
        studio.site.globalVariantGroups.find(
          (group) =>
            group.uuid === input.groupUuid && !isScreenVariantGroup(group),
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
        result,
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
      result,
    };
  }
  const component = findComponent(studio, operation.input.componentUuid, true);
  if (operation.name === "deleteComponent")
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
      result: () =>
        outputResult([
          buildProjectResource(studio.site, undefined, {
            projectId: studio.siteInfo.id,
            components: true,
          }),
        ]),
    };
  const vtm = variantManager(studio, component);
  const messages: string[] = [];
  let apply: () => void;
  switch (operation.name) {
    case "insertHtml": {
      const input = operation.input;
      assert(
        input.location !== "replace" || !!input.elementUuid,
        "Replacement requires an explicit elementUuid",
      );
      const target = input.elementUuid
        ? findElement(component, input.elementUuid)
        : component.tplTree;
      const parsed = ensureOk(
        await htmlToTpl(input.html, {
          site: studio.site,
          vtm,
          appCtx: studio.appCtx,
          pageHrefs: true,
        }),
      );
      assert(
        !parsed.errors.length,
        parsed.errors.map(formatWIError).join("; "),
      );
      apply = () => {
        assert(
          findElement(component, target.uuid) === target,
          "Target changed while HTML was being prepared",
        );
        const errors = parsed.finalize({
          component,
          tplMgr: studio.tplMgr(),
          ccRegistry: studio.codeComponentsRegistry,
        });
        assert(!errors.length, errors.map(formatWIError).join("; "));
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
      assert(
        input.props ||
          input.styles ||
          input.visibleIf !== undefined ||
          input.repeat !== undefined,
        "Provide props, styles, visibleIf or repeat",
      );
      const tpl = findElement(component, input.elementUuid);
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
        const setting = vtm.ensureVariantSetting(tpl, combo);
        if (input.visibleIf !== undefined)
          setting.dataCond =
            input.visibleIf === null
              ? null
              : interpolatedStringToCodeExpr(input.visibleIf);
        if (input.repeat !== undefined)
          setting.dataRep =
            input.repeat === null
              ? null
              : mkNormalizedRep(
                  interpolatedStringToCodeExpr(input.repeat.collection),
                  input.repeat.itemName,
                  input.repeat.indexName,
                );
        if (input.props) {
          assert(
            isKnownTplComponent(tpl),
            "props requires a component instance; use insertHtml to replace native text/markup",
          );
          const vs = vtm.ensureVariantSetting(tpl, combo);
          for (const [name, value] of Object.entries(input.props))
            ensureOk(
              setComponentInstanceProp(tpl, name, value, {
                vs,
                tplMgr: studio.tplMgr(),
              }),
            );
        }
        if (input.styles)
          messages.push(
            ...ensureOk(
              setTplStyles(tpl, input.styles, {
                studioCtx: studio,
                vtm,
                variantCombo: combo,
              }),
            ),
          );
      };
      break;
    }
    case "deleteElement": {
      const tpl = findElement(component, operation.input.elementUuid);
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
      const source = findElement(component, input.elementUuid);
      const target = findElement(component, input.targetUuid);
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
            if (!siblings.length) return;
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
        if (operation.name === "deleteState")
          ensureOk(
            deleteComponentState(state, { site: studio.site, component }),
          );
        else {
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
      const tpl = findElement(component, input.elementUuid);
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
    apply: () => {
      assert(
        studio.site.components.includes(component),
        "Component removed during batch",
      );
      apply();
    },
    result: () =>
      studio.site.components.includes(component)
        ? componentResult(studio, component, messages)
        : outputResult([
            buildProjectResource(studio.site, undefined, {
              projectId: studio.siteInfo.id,
              components: true,
            }),
          ]),
  };
}

export const COPILOT_TOOLS: Record<string, CopilotTool<any>> = {
  identify: defineCopilotTool(meta.identify, async (studio, input) => {
    studio.setPreferredAiOutputFormat(input.outputFormat);
    return {
      ...input,
      projectId: studio.siteInfo.id,
      projectName: studio.siteInfo.name,
      canEdit:
        studio.canEditProject() &&
        studio.editMode &&
        studio.isAtTip &&
        !studio.blockChanges &&
        (!studio.siteInfo.isMainBranchProtected ||
          !!studio.dbCtx().branchInfo?.id),
    };
  }),
  read: defineCopilotTool(meta.read, async (studio, input) => {
    if (!input.componentUuids?.length && !input.elements?.length) {
      return outputResult([
        buildProjectResource(studio.site, undefined, {
          projectId: studio.siteInfo.id,
          components: true,
          tokens: true,
          screenBreakpoints: true,
          globalVariants: true,
        }),
      ]);
    }
    return outputResult([
      ...(input.componentUuids ?? []).map((uuid) =>
        buildComponentResource(findComponent(studio, uuid), {
          site: studio.site,
        }),
      ),
      ...(input.elements ?? []).map(({ componentUuid, elementUuid }) =>
        buildElementResource(
          findElement(findComponent(studio, componentUuid), elementUuid),
          { site: studio.site },
        ),
      ),
    ]);
  }),
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
      if (frame) studio.setStudioFocusOnFrame({ frame, autoZoom: true });
      return canvasResult(studio);
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
  installLibrary: defineCopilotTool(meta.installLibrary, async (studio, input) => {
    assertCanEditPrototype(studio);
    assert(!studio.contentEditorMode, "Library installation requires full editor permission");
    const existing = studio.site.projectDependencies.find(dep => dep.projectId === input.projectId);
    const dependency = existing ?? await studio.projectDependencyManager.addByProjectId(input.projectId);
    await studio.updateCcRegistry(usedHostLessPkgs(studio.site));
    return { projectId: dependency.projectId, version: dependency.version, installed: !existing };
  }),
  upgradeLibrary: defineCopilotTool(meta.upgradeLibrary, async (studio, input) => {
    assertCanEditPrototype(studio);
    assert(!studio.contentEditorMode, "Library upgrades require full editor permission");
    const dependency = ensure(studio.site.projectDependencies.find(dep => dep.projectId === input.projectId), "Library is not installed in this project");
    const previousVersion = dependency.version;
    const { pkg, depPkgs } = await studio.appCtx.api.getPkgVersion(dependency.pkgId);
    const { projectDependency } = unbundleProjectDependency(studio.bundler(), pkg, depPkgs);
    assert(projectDependency.projectId === input.projectId && projectDependency.pkgId === dependency.pkgId, "Published package does not match installed library");
    const upgraded = projectDependency.version !== previousVersion;
    if (upgraded) await studio.projectDependencyManager.upgradeProjectDeps([projectDependency]);
    return { projectId: input.projectId, previousVersion, version: projectDependency.version, upgraded };
  }),
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
        )
        .slice(0, input.limit);
      return outputResult(
        matches.map((tpl) => buildElementResource(tpl, { site: studio.site })),
      );
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
  executeBatch: defineCopilotTool(meta.executeBatch, async (studio, input) => {
    assertCanEditPrototype(studio);
    // Resolve targets and asynchronous HTML imports before entering the recorder.
    const plans: MutationPlan[] = [];
    for (const [index, operation] of input.operations.entries()) {
      try {
        plans.push(await prepareMutation(studio, operation));
      } catch (error) {
        throw new Error(
          `Operation ${index} (${operation.name}): ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
    await change(
      studio,
      Array.from(new Set(plans.flatMap((plan) => plan.components))),
      () => {
        for (const [index, plan] of plans.entries()) {
          try {
            plan.apply();
          } catch (error) {
            throw new Error(
              `Operation ${index} (${input.operations[index].name}): ${error instanceof Error ? error.message : String(error)}`,
            );
          }
        }
      },
    );
    return { results: plans.map((plan) => plan.result()) };
  }),
  navigate: defineCopilotTool(meta.navigate, async (studio, input) => {
    const component = findComponent(studio, input.componentUuid, true);
    studio.switchToComponentArena(component);
    return componentResult(studio, component);
  }),
  validate: defineCopilotTool(meta.validate, async (studio, input) => {
    const components = input.componentUuids
      ? input.componentUuids.map((uuid) => findComponent(studio, uuid, true))
      : studio.site.components.filter((c) => !isCodeComponent(c));
    const instances = components
      .flatMap((c) => flattenTpls(c.tplTree).filter(isKnownTplComponent))
      .filter((t) => isCodeComponent(t.component));
    const errors = [...genSiteErrors(studio.site)].map((e) => e.message);
    const antDesign6Instances = instances.filter((t) =>
      t.component.name.startsWith("plasmic-antd6-"),
    ).length;
    const warnings: string[] = [];
    if (!antDesign6Instances) {
      warnings.push(
        "No Ant Design 6 instances found in the selected prototype.",
      );
    }
    for (const component of components) {
      if (flattenTpls(component.tplTree).length === 1) {
        warnings.push(`Component "${component.name}" has no child elements.`);
      }
    }
    return {
      valid: !errors.length,
      errors,
      warnings,
      pages: components.filter(isPageComponent).length,
      components: components.length,
      codeComponentInstances: instances.length,
      antDesign6Instances,
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
