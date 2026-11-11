import type { CanvasQueryController, CanvasQueryPlan } from "../../../../../../react-web-bundle/src/canvas-queries";
import type { CanvasComponentController, CanvasComponentValues } from "../../../../../../react-web-bundle/src/canvas-component";
import { setEditingTextContext } from "@/wab/client/studio-ctx/editing-text-state";
import {
  SlateRenderNodeOpts,
  renderCanvasText,
  renderReadOnlyCanvasText,
  renderSlateChildren,
} from "@/wab/client/components/canvas/CanvasText";
import {
  cachedRenderTplNode,
  reactHookSpecsToKey,
} from "@/wab/client/components/canvas/canvas-cache";
import { wrapCanvasEventHandler } from "@/wab/client/components/canvas/canvas-interactions";
import { applyCanvasSessionState, canvasSessionInstanceKey, CanvasStateSpec } from "@/wab/client/components/canvas/canvas-session-state";
import {
  wrapCanvasErrorBoundary,
  withErrorDisplayFallback,
} from "@/wab/client/components/canvas/canvas-error";
import {
  isExplicitlySized,
  resizePlaceholder,
} from "@/wab/client/components/canvas/canvas-fns-impl";
import {
  CanvasObservedRenderSource,
  mkUseCanvasObserver,
} from "@/wab/client/components/canvas/canvas-observer";
import {
  showCanvasAuthNotification,
  showCanvasPageNavigationNotification,
  trapInteractionError,
} from "@/wab/client/components/canvas/studio-canvas-util";
import { getRealClassNames } from "@/wab/client/components/canvas/styles-name";
import { SubDeps } from "@/wab/client/components/canvas/subdeps";
import { globalHookCtx } from "@/wab/client/react-global-hook/globalHook";
import { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { EditingTextContext, ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { evaluateDataTokenDefinitions } from "@/wab/commons/DataToken";
import { mkTokenRef } from "@/wab/commons/StyleToken";
import { DeepReadonly } from "@/wab/commons/types";
import {
  getSlotParams,
  isLikelyTextTplSlot,
  isStyledTplSlot,
  shouldWrapSlotContentInDataCtxReader,
} from "@/wab/shared/SlotUtils";
import { VariantedStylesHelper } from "@/wab/shared/VariantedStylesHelper";
import {
  VariantCombo,
  getActiveVariantSettings,
  isBaseVariant,
  isCodeComponentVariant,
  isDisabledPseudoSelectorVariantForTpl,
  isGlobalVariant,
  isMaybeInteractiveCodeComponentVariant,
  isPseudoElementVariantForTpl,
  isScreenVariant,
  isStyleOrCodeComponentVariant,
  variantHasPrivatePseudoElementSelector,
} from "@/wab/shared/Variants";
import {
  componentToElementNames,
  componentToNonVariantParamNames,
  componentToVariantParamNames,
  computedNodeNamer,
  computedProjectFlags,
} from "@/wab/shared/cached-selectors";
import {
  INTERNAL_CC_CANVAS_PROP,
  classNameProp,
  dataCanvasEnvsProp,
  frameUidProp,
  internalCanvasElementProps,
  plasmicClonedIndex,
  renderingCtxProp,
  repFragmentKey,
  richTextProp,
  setControlContextDataProp,
  slotArgCompKeyProp,
  slotArgParamProp,
  slotExtraCanvasEnvProp,
  slotFragmentKey,
  slotPlaceholderAttr,
  valKeyProp,
  valOwnerProp,
} from "@/wab/shared/canvas-constants";
import {
  getBuiltinComponentRegistrations,
  isBuiltinCodeComponent,
} from "@/wab/shared/code-components/builtin-code-components";
import {
  isCodeComponentWithHelpers,
  isPlainObjectPropType,
  tryGetStateHelpers,
} from "@/wab/shared/code-components/code-components";
import { isTplRootWithCodeComponentVariants } from "@/wab/shared/code-components/variants";
import { toReactAttr } from "@/wab/shared/codegen/image-assets";
import { makeCssClassNameForVariantCombo } from "@/wab/shared/codegen/react-p/class-names";
import { nodeNameBackwardsCompatibility } from "@/wab/shared/codegen/react-p/constants";
import {
  getRepetitionIndexInternalName,
  getRepetitionItemInternalName,
  getRepetitionUuidInternalName,
  serializeDataRepsIndexName,
} from "@/wab/shared/codegen/react-p/data-reps";
import { ReactHookSpec } from "@/wab/shared/codegen/react-p/react-hook-spec";
import {
  NodeNamer,
  getExportedComponentName,
  makeRootResetClassName,
  makeWabHtmlTextClassName,
  makeWabInstanceClassName,
  makeWabSlotClassName,
  makeWabTextClassName,
} from "@/wab/shared/codegen/react-p/serialize-utils";
import { isServerQueryWithOperation } from "@/wab/shared/codegen/react-p/server-queries/utils";
import { deriveReactHookSpecs } from "@/wab/shared/codegen/react-p/utils";
import {
  paramToVarName,
  toJsIdentifier,
  toVarName,
} from "@/wab/shared/codegen/util";
import {
  assert,
  arrayEq,
  cx,
  ensure,
  ensureArray,
  ensureInstance,
  ensureType,
  maybe,
  notNil,
  switchType,
  tuple,
  unexpected,
  withDefaultFunc,
  withoutNils,
} from "@/wab/shared/common";
import {
  allComponentVariants,
  getComponentDisplayName,
  getRepetitionElementName,
  getRepetitionIndexName,
  isCodeComponent,
  isHostLessCodeComponent,
} from "@/wab/shared/core/components";
import {
  buildCustomCodePlasmicQuery,
  getCustomFunctionParams,
  wrapPlasmicQueryFetch,
} from "@/wab/shared/core/custom-functions";
import {
  ExprCtx,
  InteractionArgLoc,
  InteractionLoc,
  asCode,
  code,
  extractReferencedParam,
  getCodeExpressionWithFallback,
  getRawCode,
  isInteractionLoc,
  isRealCodeExpr,
  removeFallbackFromDataSourceOp,
} from "@/wab/shared/core/exprs";
import { mkParam } from "@/wab/shared/core/lang";
import {
  customFunctionId,
  makeCustomCodeQueryKey,
} from "@/wab/shared/core/query-ids";
import { makeSelectableKey } from "@/wab/shared/core/selection";
import { makeTokenValueResolver } from "@/wab/shared/core/site-style-tokens";
import {
  StateVariableType,
  getComponentStateOnChangePropNames,
  getLastPartOfImplicitStateName,
  getStateDisplayName,
  getStateOnChangePropName,
  getStateValuePropName,
  hasExplicitStateValue,
  getStateVarName,
  getVirtualWritableStateInitialValue,
  isReadonlyState,
  isWritableState,
  shouldHaveImplicitState,
} from "@/wab/shared/core/states";
import { plasmicImgAttrStyles } from "@/wab/shared/core/style-props";
import {
  canvasProjectId,
  classNameForRuleSet,
  defaultStyleClassNames,
  getTriggerableSelectors,
  makeCanvasRuleNamers,
  makeDefaultStyleValuesDict,
  makeStyleExprClassName,
  makeStyleScopeClassName,
  studioDefaultStylesClassNameBase,
} from "@/wab/shared/core/styles";
import { toFinalToken } from "@/wab/shared/core/tokens";
import {
  RawTextLike,
  TplTextTag,
  ancestorsUp,
  flattenExprs,
  getNumberOfRepeatingAncestors,
  getOwnerSite,
  isExprText,
  isGridChild,
  isRawText,
  isTplCodeComponent,
  isTplColumn,
  isTplComponent,
  isTplIcon,
  isTplImage,
  isTplRepeated,
  isTplTag,
  isTplTextBlock,
  summarizeTpl,
  tplHasRef,
} from "@/wab/shared/core/tpls";
import { uniqifyClassName } from "@/wab/shared/css";
import { parseDataUrlToSvgXml } from "@/wab/shared/data-urls";
import { DEVFLAGS, DevFlagsType } from "@/wab/shared/devflags";
import {
  EffectiveVariantSetting,
  getEffectiveVariantSetting,
} from "@/wab/shared/effective-variant-setting";
import { stampIgnoreError } from "@/wab/shared/error-handling";
import { CanvasEnv, canvasRefCommands, evalCodeWithEnv } from "@/wab/shared/eval";
import { exprUsesCtxOrFreeVars } from "@/wab/shared/eval/expression-parser";
import { ContainerType } from "@/wab/shared/layoututils";
import { canvasFactory } from "@/wab/client/components/canvas/canvas-factories";
import {
  CollectionExpr,
  Component,
  ComponentDataQuery,
  CompositeExpr,
  CustomCode,
  CustomFunctionExpr,
  DataSourceOpExpr,
  EventHandler,
  Expr,
  FunctionArg,
  FunctionExpr,
  ImageAssetRef,
  MapExpr,
  Marker,
  ObjectPath,
  PageHref,
  Param,
  QueryInvalidationExpr,
  RenderExpr,
  Site,
  State,
  StrongFunctionArg,
  StyleExpr,
  StyleTokenRef,
  TemplatedString,
  TplComponent,
  TplNode,
  TplRef,
  TplSlot,
  TplTag,
  VarRef,
  Variant,
  VariantSetting,
  VariantsRef,
  VirtualRenderExpr,
  ensureKnownNamedState,
  isKnownColorPropType,
  isKnownCustomCode,
  isKnownDefaultStylesClassNamePropType,
  isKnownDefaultStylesPropType,
  isKnownEventHandler,
  isKnownNamedState,
  isKnownStateParam,
  isKnownStyleExpr,
  isKnownStyleScopeClassNamePropType,
  isKnownTplTag,
} from "@/wab/shared/model/classes";
import { isRenderFuncType, typeFactory } from "@/wab/shared/model/model-util";
import { canAddChildren } from "@/wab/shared/parenting";
import {
  getPlumeCanvasPlugin,
  getPlumeCodegenPlugin,
  getPlumeEditorPlugin,
} from "@/wab/shared/plume/plume-registry";
import { hashExpr } from "@/wab/shared/site-diffs";
import { PageSizeType, deriveSizeStyleValue } from "@/wab/shared/sizingutils";
import { placeholderImgUrl } from "@/wab/shared/urls";
import { JsIdentifier } from "@/wab/shared/utils/regex-js-identifier";
import {
  makeVariantComboSorter,
  sortedVariantSettings,
} from "@/wab/shared/variant-sort";
import {
  TplVisibility,
  getEffectiveVsVisibility,
  normalizeDisplayValue,
  getTplComponentDefaultDisplayByActiveVariants,
} from "@/wab/shared/visibility-utils";
import type {
  PlasmicQueryResult,
  QueryComponentNode,
  usePlasmicInvalidate,
} from "@plasmicapp/data-sources";
import { DataDict, mkMetaName } from "@plasmicapp/host";
import { $StateSpec, StateInitializerDeclaration } from "@plasmicapp/react-web";
import type * as ReactWeb from "@plasmicapp/react-web";
import {
  get,
  isString,
  last,
  omit,
  pick,
  toPath,
  uniqBy,
  without,
  zipObject,
} from "lodash";
import type React from "react";
import { maybeMakePlasmicImgSrc } from "src/wab/shared/codegen/react-p/image";
import defer = setTimeout;

export const hasLoadingBoundaryKey = "plasmicInternalHasLoadingBoundary";
const enableLoadingBoundaryKey = "plasmicInternalEnableLoadingBoundary";

export type PinnedVariants = Map<Variant, boolean | null>;
export type PinMap = Map<string, PinnedVariants>;

export interface RenderingCtx {
  sub: SubDeps;
  rootClassName: string | undefined;
  site: Site;
  projectFlags: DevFlagsType;
  valKey: string;
  renderSlotInstance?: string;
  ownersStack: string[]; // `ValComponent` keys
  // ownerComponent, ownerKey and nodeNamer can only be undefined for the
  // "top-level" TplComponent like ArenaFrame.container or global contexts tpls.
  ownerComponent: Component | undefined;
  ownerKey: string | undefined;
  nodeNamer: NodeNamer | undefined;
  overrides: Record<string, any>;
  activeVariants: Set<Variant>;
  reactHookSpecs: ReactHookSpec[];
  triggerProps: Record<string, React.HTMLAttributes<HTMLElement>>;
  env: CanvasEnv;
  wrappingEnv: CanvasEnv;
  viewCtx: ViewCtx;
  forceValComponentKeysWithDefaultSlotContents?: Set<string>;

  // $state is part of the tpl evaluation environment, which we use to
  // determine if we can cache a rendered tpl node. Since all elements
  // in a component will have the same $state, we only make this
  // snapshot once, per component. We need to make a snapshot because
  // $state is altered by mutation.
  $stateSnapshot: Readonly<Record<string, any>>;
  readonly pinnedVariants?: ReadonlySet<Variant>;
  readonly registerRef: ReturnType<typeof ReactWeb.usePlasmicRefs>["registerRef"] | undefined;
  readonly getRefs: ReturnType<typeof ReactWeb.usePlasmicRefs>["getRefs"] | undefined;

  inline?: boolean;
  // `slate` is only passed by rich text blocks to their marker nodes when
  // the text is being edited. In that case, Slate requires rendering these
  // attributes and children to work properly.
  slate?: SlateRenderNodeOpts;

  setDollarQueries: React.Dispatch<React.SetStateAction<Record<string, any>>>;
  setDollarQ: React.Dispatch<React.SetStateAction<Record<string, any>>>;

  plasmicInvalidate: ReturnType<typeof usePlasmicInvalidate> | undefined;
  stateSpecs: $StateSpec<any>[];
  /** Output declarations belong to this render owner; cached nodes replay them. */
  stateInitializers?: StateInitializerDeclaration[];

  // This is used to enable code components variants in the canvas
  $ccVariants: Record<string, boolean>;
  updateVariant: (changes: Record<string, boolean>) => void;
  /** Explicit existing React boundary to refresh when a rendered input changes. */
  onRenderInvalidated?: () => void;
  /** Immutable token definitions; each component evaluates its own runtime values. */
  dataTokenDefinitions?: import("@/wab/commons/DataToken").DataTokenDefinitions;
}

interface CanvasComponentProps extends Partial<
  Record<(typeof internalCanvasElementProps)[number], any>
> {
  [valKeyProp]: string;
  [dataCanvasEnvsProp]: { env: CanvasEnv; wrappingEnv: CanvasEnv };
  [renderingCtxProp]: RenderingCtx;
  [plasmicClonedIndex]?: number;
  [valOwnerProp]?: string;
  [classNameProp]: string;
  [frameUidProp]?: number;
  [slotArgCompKeyProp]?: string;
  [slotArgParamProp]?: string;
  ref?: React.Ref<any>;
}

export const createCanvasComponent = canvasFactory(
  (
    viewCtx: ViewCtx,
    component: Component,
  ): React.ComponentType<CanvasComponentProps> => {
    const canvasCtx = viewCtx.canvasCtx;
    const sub = canvasCtx.Sub;
    const getArgsAndVariants = () => ({
      internalArgProps: componentToNonVariantParamNames(component),
      internalVariantProps: componentToVariantParamNames(component),
    });
    const CanvasComponent = sub.createCanvasComponentType<CanvasComponentProps>((originalProps) => {
      return mkUseCanvasObserver(sub, viewCtx, viewCtx.canvasRenderOwner.observerInput(viewCtx, component))((onRenderInvalidated) => {
        const inherited = originalProps[renderingCtxProp];
        const input = createCanvasComponentInputs(viewCtx, component, inherited?.valKey ?? "", serverQueryRegistrationKey(component));
        const controller = createCanvasComponentController(viewCtx, component, input, onRenderInvalidated);
        return sub.React.createElement(sub.CanvasComponentRuntime<CanvasComponentProps, ReturnType<typeof input.getState>, CanvasComponentPrepared, RenderingCtx, ReturnType<typeof input.getState>["tokens"]>, { controller, originalProps });
      }, component.name);
    });
    Object.assign(CanvasComponent, {
      displayName: getExportedComponentName(component) + "__Impl",
    });
    const plumePlugin = getPlumeCanvasPlugin(component);
    const MaybePlumeComp =
      (plumePlugin?.genCanvasWrapperComponent(
        sub,
        CanvasComponent,
        mkUseCanvasObserver(sub, viewCtx, viewCtx.canvasRenderOwner.observerInput(viewCtx, component)),
        getArgsAndVariants,
        component,
        viewCtx,
        (_comp) => createCanvasComponent(viewCtx, _comp),
      ) as React.ComponentType<CanvasComponentProps>) ?? CanvasComponent;
    const CanvasComponentWrapper = sub.createCanvasComponentType<CanvasComponentProps>((props, ref) =>
      wrapCanvasErrorBoundary({
          ctx: props[renderingCtxProp] ?? makeEmptyRenderingCtx(viewCtx, ""),
          nodeOrComponent: component,
          children: sub.React.createElement(MaybePlumeComp, {
            ...props,
            ref,
          }),
        }),
    ) as typeof MaybePlumeComp;
    Object.assign(CanvasComponentWrapper, {
      displayName: getExportedComponentName(component),
      ...(component.plumeInfo
        ? {
            __plumeType: component.plumeInfo.type,
          }
        : {}),
    });
    return CanvasComponentWrapper;
  },
 (viewCtx, component) => [viewCtx, component, component.plumeInfo?.type],
);

export interface ExtraSlotCanvasEnvData {
  env: CanvasEnv;
  tplComponentValKey: string;
  slotPropUuid: string;
}

export function mkEventHandlerEnv(
  env: CanvasEnv,
  studioCtx: StudioCtx,
  reactWeb: RenderingCtx["sub"]["reactWeb"],
  plasmicInvalidate: RenderingCtx["plasmicInvalidate"],
  win: typeof window,
  dataSources?: RenderingCtx["sub"]["dataSources"],
) {
  return {
    ...env,
    $refs: env[canvasRefCommands]?.() ?? {},
    __wrapUserFunction: (
      loc: InteractionLoc | InteractionArgLoc,
      fn: () => any,
      args: Record<string, any>,
    ) => {
      try {
        if (isInteractionLoc(loc)) {
          // Special handling for some interactions on canvas.

          if (loc.actionName === "navigation") {
            if (typeof args.destination !== "string" || !args.destination.trim()) {
              throw new Error("Navigation destination must be a non-empty string");
            }
            const destination = args.destination;
            if (destination.startsWith("#")) {
              win.document
                .getElementById(destination.substring(1))
                ?.scrollIntoView({ behavior: "smooth" });
            } else {
              showCanvasPageNavigationNotification(
                studioCtx,
                `${args.destination}`,
              );
            }
            return;
          } else if (loc.actionName === "login" || loc.actionName === "logout") {
            showCanvasAuthNotification("interactive mode");
            return;
          }
        }

        return fn();
      } catch (error) {
        trapInteractionError(studioCtx, loc, error);
        stampIgnoreError(error);
        throw error;
      }
    },
    __wrapUserPromise: async (
      loc: InteractionLoc | InteractionArgLoc,
      promise: Promise<unknown>,
    ) => {
      try {
        return await promise;
      } catch (error) {
        trapInteractionError(studioCtx, loc, error);
        stampIgnoreError(error);
        throw error;
      }
    },
    $stateGet: reactWeb.get,
    $stateSet: reactWeb.set,
    executePlasmicDataOp:
      dataSources?.executePlasmicDataOp ??
      studioCtx.executePlasmicDataOp.bind(studioCtx),
    plasmicInvalidate: plasmicInvalidate,
  };
}

function mkEventHandlerEnvFromRenderingCtx(ctx: RenderingCtx) {
  return mkEventHandlerEnv(
    {
      ...ctx.sub.reactWeb.getStateCommandEnv(ctx.env),
      [canvasRefCommands]: ctx.getRefs,
      $props: ctx.sub.reactWeb.getStateCommandEnv(ctx.env.$props),
      $ctx: ctx.sub.reactWeb.getStateCommandEnv(ctx.env.$ctx),
    },
    ctx.viewCtx.studioCtx,
    ctx.sub.reactWeb,
    ctx.plasmicInvalidate,
    ctx.viewCtx.canvasCtx.win(),
    ctx.sub.dataSources,
  );
}

function mkInitFuncExpr(
  state: State,
  variantCombo: VariantCombo,
  viewCtx: ViewCtx,
  exprCtx: ExprCtx,
  isForRegisterInitFunc?: boolean,
) {
  if (viewCtx.component !== exprCtx.component && isWritableState(state)) {
    // we need to transform the root component writable states
    // into private to interact with them on its own component
    return undefined;
  }

  const isCurrentComponent = viewCtx.currentComponent() === exprCtx.component;

  if (!state.tplNode && state.variableType === "variant") {
    // The root starts from this artboard's variant props in either mode.
    // Nested instances continue to use their registered variant defaults.
    return code(
      `${
        state.param.previewExpr && viewCtx.component === exprCtx.component
          ? getRawCode(state.param.previewExpr, exprCtx)
          : state.param.defaultExpr && viewCtx.component !== exprCtx.component
            ? getRawCode(state.param.defaultExpr, exprCtx)
            : `$props["${getStateValuePropName(state)}"]`
      }`,
    );
  } else if (!state.tplNode && state.param.previewExpr && isCurrentComponent) {
    return state.param.previewExpr;
  } else if (!state.tplNode && state.param.defaultExpr) {
    return state.param.defaultExpr;
  } else if (state.tplNode) {
    const effectiveVs = getEffectiveVariantSetting(state.tplNode, variantCombo);
    const maybeArg = effectiveVs.args.find(
      (arg) => arg.param === state.implicitState?.param,
    );
    const maybeAttr = isTplTag(state.tplNode)
      ? effectiveVs.attrs[toVarName(ensureKnownNamedState(state).name)]
      : undefined;
    const initExpr = isTplComponent(state.tplNode) ? maybeArg?.expr : maybeAttr;
    if (
      !isForRegisterInitFunc &&
      (ancestorsUp(state.tplNode).some(isTplRepeated) ||
        (initExpr && exprUsesCtxOrFreeVars(initExpr)))
    ) {
      // Repeated paths and context-dependent values are declared by their render owner.
      return undefined;
    }
    if (
      state.implicitState &&
      isTplCodeComponent(state.tplNode) &&
      isReadonlyState(state.implicitState) &&
      state.implicitState.param.previewExpr &&
      isCurrentComponent
    ) {
      // for plasmic component, we always fire an onChange in the first render, but for code components
      // we can only initialize it if the user specify an initVal/initFunc
      return state.implicitState.param.previewExpr;
    } else if (
      state.implicitState &&
      isTplCodeComponent(state.tplNode) &&
      isReadonlyState(state.implicitState) &&
      state.implicitState.param.defaultExpr
    ) {
      // for plasmic component, we always fire an onChange in the first render, but for code components
      // we can only initialize it if the user specify an initVal/initFunc
      return state.implicitState.param.defaultExpr;
    } else if (
      state.implicitState &&
      !initExpr &&
      isTplComponent(state.tplNode) &&
      isWritableState(state.implicitState)
    ) {
      return getVirtualWritableStateInitialValue(state.implicitState);
    } else {
      return initExpr;
    }
  }
  return undefined;
}

function mkInitFuncFromExpr(
  initFuncExpr: Expr,
  viewCtx: ViewCtx,
  env: Record<string, any> | undefined,
  exprCtx: ExprCtx,
  isForRegisterInitFunc?: boolean,
) {
  return evalCodeWithEnv(
    `(({$props, $state, $queries, $q${
      isForRegisterInitFunc ? ", $ctx" : ""
    }}) => (
      ${getRawCode(initFuncExpr, exprCtx)}
    ))`,
    { ...(env ?? {}) },
    viewCtx.canvasCtx.win(),
  );
}

function mkInitFunc(
  state: State,
  variantCombo: VariantCombo,
  viewCtx: ViewCtx,
  env: Record<string, any> | undefined,
  exprCtx: ExprCtx,
  isForRegisterInitFunc?: boolean,
) {
  const initFuncExpr = mkInitFuncExpr(
    state,
    variantCombo,
    viewCtx,
    exprCtx,
    isForRegisterInitFunc,
  );
  if (!initFuncExpr) {
    return undefined;
  }
  return mkInitFuncFromExpr(
    initFuncExpr,
    viewCtx,
    env,
    exprCtx,
    isForRegisterInitFunc,
  );
}

function mkInitFuncHash(
  state: State,
  variantCombo: VariantCombo,
  viewCtx: ViewCtx,
  exprCtx: ExprCtx,
) {
  const initFuncExpr = mkInitFuncExpr(state, variantCombo, viewCtx, exprCtx);
  return initFuncExpr
    ? `${state.variableType}${hashExpr(viewCtx.site, initFuncExpr, exprCtx)}`
    : "";
}

function isSlotArgElement(v: React.ReactElement) {
  const props =
    isString(v.key) && v.key.startsWith(slotFragmentKey)
      ? JSON.parse(v.key.slice(slotFragmentKey.length))
      : v.props;
  return !!props[slotArgCompKeyProp] && !!props[slotArgParamProp];
}

function renderWithTriggers(ctx: RenderingCtx, component: Component, childrenFn: (newCtx: RenderingCtx) => React.ReactNode) {
  const steps = uniqBy(ctx.reactHookSpecs, (spec) => spec.hookName).flatMap((spec) =>
    getTriggerableSelectors(spec.sv).map((opt, index) => {
      const trigger = ensure(opt.trigger, "Trigger condition is expected to be not null");
      return { group: spec.hookName, hook: trigger.hookName, opposite: !!trigger.isOpposite, propName: spec.getTriggerPropNames()[index] };
    }));
  return ctx.sub.React.createElement(ctx.sub.CanvasTriggersRuntime, {
    policy: ctx.viewCtx.studioCtx.renderPolicy.store,
    steps,
    render: ({ interactive, triggers, triggerProps }) => childrenFn({
      ...ctx,
      triggerProps,
      activeVariants: new Set([
        ...ctx.activeVariants,
        ...component.variants.filter((variant) => {
          if (!isStyleOrCodeComponentVariant(variant)) { return false; }
          if (!isCodeComponentVariant(variant)) {
            const hook = ctx.reactHookSpecs.find((spec) => spec.sv === variant);
            return !!hook && !!triggers[hook.hookName];
          }
          if (isMaybeInteractiveCodeComponentVariant(variant) && !interactive) { return false; }
          return variant.codeComponentVariantKeys.every((key) => ctx.$ccVariants[key]);
        }),
      ]),
    }),
  });
}

const dataPickerHiddenMeta = { hidden: true };

/** One finite component input: model fields, registrations, pins, tokens and
 * user/policy values are captured before the iframe render subscribes. */
const createCanvasComponentInputs = canvasFactory((view: ViewCtx, component: Component, valKey: string, idsKey: string) => {
  const owner = view.canvasRenderOwner;
  const variants = owner.variantInputs(view);
  const sources = {
    model: owner.observerInput(view, component),
    functions: owner.functionInputs(view).store,
    ownerPins: variants.ownerStore(valKey),
    globals: variants.globalStore,
    forceDefaultSlot: variants.slotStore(valKey),
    tokens: owner.dataTokenInputs(view).store,
    policy: view.studioCtx.renderPolicy.store,
    currentUser: view.studioCtx.currentAppUserStore,
    registrations: createServerQueryRegistrationInput(view, component, idsKey),
  };
  const read = () => ({
    model: sources.model.getState(),
    functions: sources.functions.getState(),
    ownerPins: sources.ownerPins.getState(),
    globals: sources.globals.getState(),
    forceDefaultSlot: sources.forceDefaultSlot.getState(),
    tokens: sources.tokens.getState(),
    policy: sources.policy.getState(),
    currentUser: sources.currentUser.getState(),
    registrations: sources.registrations.getState(),
  });
  let current = Object.freeze(read());
  const getState = () => {
    const next = read();
    if (!arrayEq(Object.values(current), Object.values(next))) { current = Object.freeze(next); }
    return current;
  };
  return {
    getState,
    getInitialState: getState,
    subscribe: (listener: () => void) => {
      const stops = Object.values(sources).map((source) => source.subscribe(listener));
      return () => stops.forEach((stop) => stop());
    },
  };
});

const createCanvasComponentController = canvasFactory((view: ViewCtx, component: Component, input: ReturnType<typeof createCanvasComponentInputs>, onRenderInvalidated: () => void) => {
  const sub = view.canvasCtx.Sub, owner = view.canvasRenderOwner;
  const controller: CanvasComponentController<CanvasComponentProps, ReturnType<typeof input.getState>, CanvasComponentPrepared, RenderingCtx, ReturnType<typeof input.getState>["tokens"]> = {
    input,
    dataTokenDefinitions: (snapshot) => snapshot.tokens,
    evaluateDataTokens: (definitions) => evaluateDataTokenDefinitions(definitions, {}),
    prepare: (props, snapshot, values) => prepareCanvasComponent(props, view, component, snapshot, values),
    finish: (prepared, commands, state, values) => {
      const result = finishCanvasComponent(prepared, commands, state, values);
      return { ...result, context: { ...result.context, onRenderInvalidated } };
    },
    retain(key, slot) {
      const lifetime = view.disposeSignal;
      if (lifetime.aborted) { return () => undefined; }
      const release = owner.retainDataTokenConsumer(key, slot);
      lifetime.addEventListener("abort", release, { once: true });
      return () => { lifetime.removeEventListener("abort", release); release(); };
    },
    commit(_ctx, commands) {
      if (!view.isDisposed && !view.disposeSignal.aborted && input.getState().policy.interactive && view.component === component) {
        view.change(() => view.syncInteractiveVariants(commands));
      }
    },
    render(ctx) {
      return renderWithTriggers(ctx, component, (next) => wrapInComponentDataQueries(next, component));
    },
  };
  return controller;
});

// Trigger props are supplied by the native trigger component chain.
function prepareCanvasComponent(
  originalProps: object,
  viewCtx: ViewCtx,
  component: Component,
  input: ReturnType<ReturnType<typeof createCanvasComponentInputs>["getState"]>,
  values: CanvasComponentValues,
) {
  const canvasCtx = viewCtx.canvasCtx;
  const sub = canvasCtx.Sub;
  const functionEnvironment = input.functions;

  const nodeNamer = computedNodeNamer(component);

  const root = ensureInstance(component.tplTree, TplComponent, TplTag);
  const rootName = ensure(nodeNamer(root), () => "Expected root name to exist");

  const internalProps = pick(originalProps, internalCanvasElementProps);

  const argAndVariantNames = { internalArgProps: componentToNonVariantParamNames(component), internalVariantProps: componentToVariantParamNames(component) };

  const { args, overrides: originalOverrides, variants } = sub.reactWeb.deriveRenderOpts(
    omit(originalProps, internalCanvasElementProps),
    {
      name: rootName,
      descendantNames: componentToElementNames(component),
      internalArgPropNames: argAndVariantNames.internalArgProps,
      internalVariantPropNames: argAndVariantNames.internalVariantProps,
    },
  );

  // Renamed slot arguments no longer represent overrides. Copy each edited
  // override instead of mutating the caller's registered props.
  const overrides = Object.fromEntries(Object.entries(originalOverrides).map(([name, override]) => [name, override?.props ? {
    ...override,
    props: Object.fromEntries(Object.entries(override.props).filter(([_key, value]) => {
      const entries = ensureArray(value);
      return !entries.length || !entries.every((entry: any) => entry && sub.React.isValidElement(entry) && isSlotArgElement(entry));
    })),
  } : override]));

  const reactHookSpecs = deriveReactHookSpecs(component, nodeNamer);

  const { plasmicInvalidate } = values;

  const renderingCtx: RenderingCtx = {
    // renderingCtx could be undefined, if this canvas component has for
    // some reason completely lost track of its rendering ctx (probably
    // by being used by some code or plume component in some surprising way;
    // for example, Select renders Select.Option without any rendering ctx
    // if Select options are provided as an array.
    ...(internalProps[renderingCtxProp] ?? makeEmptyRenderingCtx(viewCtx, "")),
    reactHookSpecs,
    triggerProps: {},
    plasmicInvalidate,
  };
  const { ownerPins, globals, forceDefaultSlot } = input;
  const models = viewCtx.studioCtx.modelSnapshots;
  const pinMap: PinMap = new Map(ownerPins ? [[ownerPins.key,
    new Map(ownerPins.pins.map((pin) => [models.resolve(pin.variant), pin.active]))]] : []);
  const globalPins = new Map(globals.map((pin) => [models.resolve(pin.variant), pin.active]));
  const forceDefaultKeys = new Set(forceDefaultSlot ? [renderingCtx.valKey] : []);

  const initialActiveVariants = deriveActiveVariants(
    component,
    variants,
    pinMap,
    globalPins,
    renderingCtx,
  );

  const meta = maybeGetCodeComponentMeta(viewCtx, component);

  const { $ctx, getRefs, $queries, $q, dataSourcesCtx, $globalActions, evaluatedDataTokens } = values;
  // Hide $props.<vgName> from data picker to avoid confusion with
  // $state.<vgName>, which should be preferred.
  const variantProps = variantsToProps(component, [...initialActiveVariants], {
    hideFromDataPicker: true,
  });
  const $props = {
    ...args,
    // Hide $props.<stateName> from data picker to avoid confusion with
    // $state.<stateName>, which should be preferred.
    ...Object.fromEntries(
      component.states.map((s) => [
        mkMetaName(getStateValuePropName(s)),
        dataPickerHiddenMeta,
      ]),
    ),
    // we need to use the canvas constructors
    ...viewCtx.canvasCtx.win().JSON.parse(JSON.stringify(variantProps)),
    // Hide $props.on<propName>Change from data picker.
    ...Object.fromEntries(
      withoutNils(component.states.map((s) => getStateOnChangePropName(s))).map(
        (s) => [mkMetaName(s), dataPickerHiddenMeta],
      ),
    ),
  };

  const dataTokenDefinitions = input.tokens;
  const currentAppUser = input.currentUser.appUser;

  const env = {
    $props,
    $ctx,
    [canvasRefCommands]: getRefs,
    $$: functionEnvironment,
    dataSourcesCtx,
    $globalActions,
    $queries,
    $q,
    ...evaluatedDataTokens?.$dataTokens,
    dataTokensEnv: evaluatedDataTokens?.pickerEnv,
    ...(viewCtx.studioCtx.siteInfo.hasAppAuth
      ? { currentUser: currentAppUser }
      : {}),
  };

  const projectFlags = computedProjectFlags(viewCtx.site);

  const stateSpecs = component.states.map((state) => ({
    path: getStateVarName(state),
    type: state.accessType as "private" | "readonly" | "writable",
    initFunc: mkInitFunc(
      state,
      Array.from(initialActiveVariants),
      viewCtx,
      env,
      { component, projectFlags, inStudio: true },
    ),
    initFuncHash: mkInitFuncHash(
      state,
      Array.from(initialActiveVariants),
      viewCtx,
      { component, projectFlags, inStudio: true },
    ),
    ...(state.accessType !== "private"
      ? { onChangeProp: getStateOnChangePropName(state) }
      : {}),
    ...(isWritableState(state) && viewCtx.component !== component
      ? { valueProp: getStateValuePropName(state) }
      : {}),
    variableType: state.variableType as StateVariableType,
    ...(state.tplNode &&
    isTplCodeComponent(state.tplNode) &&
    tplHasRef(state.tplNode)
      ? { refName: nodeNamer(state.tplNode) }
      : {}),
    ...(state.tplNode &&
    isTplCodeComponent(state.tplNode) &&
    isCodeComponentWithHelpers(state.tplNode.component) &&
    meta &&
    isKnownNamedState(state.implicitState)
      ? {
          onMutate: tryGetStateHelpers(meta.meta, state.implicitState)
            ?.onMutate,
        }
      : {}),
  }));
  return {
    data: { renderingCtx, component, viewCtx, pinMap, globalPins, forceDefaultKeys, nodeNamer, env, overrides, stateSpecs, dataTokenDefinitions, interactive: input.policy.interactive },
    stateSpecs,
    stateEnv: { $props, $queries, $q, $ctx, getRefs },
  };
}

type CanvasComponentPrepared = ReturnType<typeof prepareCanvasComponent>["data"];

function finishCanvasComponent(
  prepared: CanvasComponentPrepared,
  commands: ReactWeb.$State,
  state: Readonly<Record<string, any>>,
  values: CanvasComponentValues,
) {
  const { renderingCtx, component, viewCtx, pinMap, globalPins, forceDefaultKeys, nodeNamer, env, overrides, stateSpecs, dataTokenDefinitions } = prepared;
  const activeVariants = deriveActiveVariants(component, state, pinMap, globalPins, renderingCtx);
  const ctx: RenderingCtx = {
    ...renderingCtx,
    valKey: renderingCtx.valKey + "." + component.tplTree.uuid,
    activeVariants,
    pinnedVariants: new Set([
      ...[...globalPins].filter(([_variant, active]) => active).map(([variant]) => variant),
      ...[...(pinMap.get(renderingCtx.valKey) ?? [])].filter(([_variant, active]) => active).map(([variant]) => variant),
    ]),
    nodeNamer,
    env: { ...env, $state: state },
    wrappingEnv: { ...env, $state: state },
    registerRef: values.registerRef,
    getRefs: values.getRefs,
    overrides,
    ownerComponent: component,
    ownerKey: renderingCtx.valKey,
    ownersStack: [...renderingCtx.ownersStack, renderingCtx.valKey],
    $stateSnapshot: state,
    dataTokenDefinitions,
    forceValComponentKeysWithDefaultSlotContents: forceDefaultKeys,
    setDollarQueries: values.setDollarQueries,
    setDollarQ: values.setDollarQ,
    stateSpecs,
    $ccVariants: values.$ccVariants,
    updateVariant: values.updateVariant,
  };
  return { context: ctx, consumerKey: computeFullKey(ctx), consumerSlot: ctx.renderSlotInstance };
}

function deriveActiveVariants(
  component: Component,
  variants: Record<string, any>,
  pinMap: PinMap,
  globalPins: Map<Variant, boolean>,
  ctx: RenderingCtx,
) {
  return new Set<Variant>([
    ...[...globalPins.entries()].filter(([_, b]) => !!b).map(([v]) => v),
    ...[...(pinMap.get(ctx.valKey)?.entries() ?? [])]
      .filter(([_, b]) => !!b)
      .map(([v]) => v),
    ...component.variantGroups.flatMap((vg) =>
      vg.variants.filter((v) => {
        const groupName = toVarName(vg.param.variable.name);
        const variantName = toVarName(v.name);
        return ctx.sub.reactWeb.hasVariant(variants, groupName, variantName);
      }),
    ),
  ]);
}

function variantsToProps(
  component: Component,
  variants: Variant[],
  opts?: { hideFromDataPicker: boolean },
): Record<string, string | string[] | boolean | undefined> {
  const props = Object.fromEntries(
    component.variantGroups.map((vg) => {
      const vgName = toVarName(vg.param.variable.name);
      const values = vg.variants
        .filter((v) => variants.includes(v))
        .map((v) => toVarName(v.name));
      if (values.length === 1) {
        return [vgName, values[0]];
      }
      if (vg.multi) {
        return [vgName, values];
      }
      return [vgName, undefined];
    }),
  );
  if (opts?.hideFromDataPicker) {
    const keys = Object.keys(props);
    for (const key of keys) {
      props[mkMetaName(key)] = dataPickerHiddenMeta;
    }
  }
  return props;
}


export function renderFrameRoot(
  viewCtx: ViewCtx,
  root: TplNode,
  onRenderInvalidated: () => void,
): React.ReactElement {
  const sub = viewCtx.canvasCtx.Sub;
  const viewState = viewCtx.canvasRenderOwner.variantInputs(viewCtx);
  const r = sub.React.createElement;
  return r(sub.CanvasRoot<ReturnType<typeof viewState.globalStore.getState>>, {
    globals: viewState.globalStore,
    owner: viewCtx.canvasRenderOwner,
    onRenderInvalidated,
    render: (globals) => {
      const globalPins = new Map(globals.map((pin) => [viewCtx.studioCtx.modelSnapshots.resolve(pin.variant), pin.active]));
      const rootCtx: RenderingCtx = {
        ...makeEmptyRenderingCtx(viewCtx, root.uuid),
        onRenderInvalidated,
        activeVariants: new Set([
          viewCtx.site.globalVariant,
          ...[...globalPins.entries()].filter(([_, active]) => !!active).map(([variant]) => variant),
        ]),
      };
      const content = renderWithStateInitializers(rootCtx, (scope) => renderTplNode(root, scope));
      return r(sub.DataProvider, {
        name: enableLoadingBoundaryKey,
        hidden: true,
        data: true,
      }, r(sub.React.Suspense, { fallback: "Loading..." }, content));
    },
  });
}

function makeEmptyRenderingCtx(viewCtx: ViewCtx, valKey: string): RenderingCtx {
  return {
    activeVariants: new Set(),
    env: {
      $ctx: {},
      $props: {},
      $state: {},
      $q: {},
      $queries: {},
      $$: {},
      currentUser: {},
      $dataTokens: {},
    },
    wrappingEnv: {
      $ctx: {},
      $props: {},
      $state: {},
      $q: {},
      $queries: {},
      $$: {},
      currentUser: {},
      $dataTokens: {},
    },
    ownersStack: [],
    reactHookSpecs: [],
    triggerProps: {},
    nodeNamer: undefined,
    ownerComponent: undefined,
    ownerKey: undefined,
    overrides: {},
    projectFlags: computedProjectFlags(viewCtx.site),
    rootClassName: "",
    site: viewCtx.site,
    sub: viewCtx.canvasCtx.Sub,
    valKey: valKey,
    viewCtx,
    $stateSnapshot: {},
    registerRef: undefined,
    getRefs: undefined,
    setDollarQueries: () => {},
    setDollarQ: () => {},
    stateSpecs: [],
    plasmicInvalidate: undefined,
    $ccVariants: {},
    updateVariant: () => {},
  };
}

export function renderTplNode(node: TplNode, ctx: RenderingCtx) {
  globalHookCtx.uuidToTplNode.set(node.uuid, new WeakRef(node));
  globalHookCtx.valKeyToOwnerKey.set(ctx.valKey, ctx.ownerKey);
  return withErrorDisplayFallback(
    ctx,
    node,
    () => {
      const result = cachedRenderTplNode(node, ctx, () => {
        const initializers: StateInitializerDeclaration[] = [];
        const rendered = renderReppable(node, { ...ctx, stateInitializers: initializers, wrappingEnv: ctx.env });
        return { rendered, initializers };
      });
      if (result.initializers.length) {
        ensure(ctx.stateInitializers, "State declarations require a render owner").push(...result.initializers);
      }
      return result.rendered;
    },
    {
      hasLoadingBoundary: ctx.env.$ctx[hasLoadingBoundaryKey],
    },
  );
}

/** Collect declarations without changing ordinary child element types or props.
 * Every independently rendered callback owns a fresh collection and commit fiber. */
export function renderWithStateInitializers(ctx: RenderingCtx, render: (scope: RenderingCtx) => React.ReactNode): React.ReactNode {
  const initializers: StateInitializerDeclaration[] = [];
  const node = render({ ...ctx, stateInitializers: initializers });
  return initializers.length
    ? ctx.sub.React.createElement(ctx.sub.reactWeb.StateInitializer, { state: ctx.env.$state, initializers }, node)
    : node;
}

function getAutoOpenSelectionInfo(ctx: RenderingCtx, node: TplNode) {
  const info = ctx.viewCtx.canvasRenderOwner.selectionInput(ctx.viewCtx, node, ctx.valKey).getState();
  return ctx.viewCtx.canvasCtx.frameInfo(ctx.viewCtx).getState().exporting || !ctx.viewCtx.studioCtx.renderPolicy.store.getState().autoOpen
    ? { id: node.uuid, isSelected: false, selectedSlotName: null }
    : info;
}

function renderReppable(tplNode: TplNode, ctx: RenderingCtx) {
  const node = ensureInstance(tplNode, TplTag, TplComponent, TplSlot);
  const activeVSettings = getSortedActiveVariantSettings(node, ctx);
  const dataRep = last(activeVSettings.map((vs) => vs.dataRep).filter(Boolean));
  if (dataRep) {
    const collection = ensureArray(
      evalCodeWithEnv(
        getCodeExpressionWithFallback(
          ensureInstance(dataRep.collection, CustomCode, ObjectPath),
          {
            component: ctx.ownerComponent ?? null,
            projectFlags: ctx.projectFlags,
            inStudio: true,
          },
        ),
        ctx.env,
        ctx.viewCtx.canvasCtx.win(),
      ),
    );
    const idx = getNumberOfRepeatingAncestors(node) - 1;
    const elementInternalName = getRepetitionItemInternalName(idx);
    const indexInternalName = getRepetitionIndexInternalName(idx);
    const uuidToIndexInternalName = getRepetitionUuidInternalName(node.uuid);
    const contents: React.ReactElement[] = [];
    const usedKeys = new Set<React.Key>();
    const nextSuffix = new Map<React.Key, number>();
    collection.forEach((item, index) => {
      const element = renderNonReppable(
        node,
        {
          ...ctx,
          env: {
            ...ctx.env,
            [getRepetitionElementName(dataRep)]: item,
            [getRepetitionIndexName(dataRep)]: index,
            [elementInternalName]: item,
            [indexInternalName]: index,
            [uuidToIndexInternalName]: index,
          },
          wrappingEnv: ctx.env,
        },
        activeVSettings,
      );
      if (!element) {
        return;
      }

      const baseKey = element.key ?? `${ctx.valKey}-unkeyed-${contents.length}`;
      let key = baseKey;
      if (usedKeys.has(baseKey)) {
        // Existing suffixes stay occupied throughout this render. Continue
        // where the previous duplicate left off to preserve collision order.
        let suffix = nextSuffix.get(baseKey) ?? 2;
        while (usedKeys.has(`${baseKey}-${suffix}`)) {
          suffix++;
        }
        nextSuffix.set(baseKey, suffix + 1);
        key = `${baseKey}-${suffix}`;
      }
      usedKeys.add(key);
      const cloneProps = {
        key,
        [plasmicClonedIndex]: index,
      };
      contents.push(ctx.sub.React.cloneElement(element, cloneProps));
    });
    if (contents.length < 2) {
      return contents[0] ?? null;
    }
    return ctx.sub.React.createElement(
      ctx.sub.React.Fragment,
      { key: `${repFragmentKey}-${ctx.valKey}` },
      contents,
    );
  } else {
    return renderNonReppable(node, ctx, activeVSettings);
  }
}

export function getSortedActiveVariantSettings(
  tpl: TplNode,
  ctx: Pick<RenderingCtx, "site" | "activeVariants" | "ownerComponent">,
) {
  const activeSettings = getActiveVariantSettings(tpl, ctx.activeVariants);
  if (activeSettings.length <= 1) {
    return activeSettings;
  }

  return sortedVariantSettings(
    activeSettings,
    makeVariantComboSorter(
      ctx.site,
      ensure(
        ctx.ownerComponent,
        () => `ownerComponent should exist in tplNodes with multiple vsettings`,
      ),
    ),
  );
}

function renderNonReppable(
  node: TplNode,
  ctx: RenderingCtx,
  activeVSettings: VariantSetting[],
) {
  return switchType(node)
    .when(TplComponent, (tpl) => renderTplComponent(tpl, ctx, activeVSettings))
    .when(TplTag, (tpl) => renderTplTag(tpl, ctx, activeVSettings))
    .when(TplSlot, (tpl) => renderTplSlot(tpl, ctx, activeVSettings))
    .result();
}

function maybeGetCodeComponentMeta(viewCtx: ViewCtx, component: Component) {
  return DEVFLAGS.ccStubs || !isCodeComponent(component)
    ? undefined
    : viewCtx.canvasCtx
        .getRegisteredCodeComponentsAndContextsMap()
        .get(component.name);
}

function renderTplComponent(
  node: TplComponent,
  ctx: RenderingCtx,
  activeVSettings: VariantSetting[],
): React.ReactElement | null {
  const effectiveVs = new EffectiveVariantSetting(
    node,
    activeVSettings,
    ctx.site,
  );

  const { rendered, style: visibilityStyle } = determineAutoOpenState(ctx, node, effectiveVs);

  if (!rendered) {
    return null;
  }

  let ComponentImpl:
    React.ComponentType<any> | React.DetailedReactHTMLElement<any, any>;

  const meta = maybeGetCodeComponentMeta(ctx.viewCtx, node.component);
  if (
    !meta &&
    !DEVFLAGS.ccStubs &&
    isTplCodeComponent(node) &&
    isHostLessCodeComponent(node.component) &&
    ctx.viewCtx.canvasCtx.isUpdatingCcRegistry()
  ) {
    return null;
  }

  const exprCtx: ExprCtx = {
    component: ctx.ownerComponent ?? null,
    projectFlags: ctx.projectFlags,
    inStudio: true,
  };

  const props = computeTplComponentArgs(node, effectiveVs, ctx);
  const sourceProps = { ...props };
  const isComponentRoot = ctx.ownerComponent?.tplTree === node;
  const positionClassName = uniqifyClassName(
    [
      makeWabInstanceClassName({ targetEnv: "canvas" }),
      visibilityStyle && ctx.viewCtx.canvasCtx.getVisibleDisplayClass(visibilityStyle.display),
      isComponentRoot && ctx.rootClassName,
      ...activeVSettings.map((vs) => classNameForRuleSet(vs.rs)),
    ]
      .filter(Boolean)
      .join(" "),
  );

  if (isCodeComponent(node.component)) {
    ComponentImpl = meta
      ? meta.impl
      : getCodeComponentStub(node.component, ctx.sub.React);

    const ccClassNameProp =
      node.component.codeComponentMeta.classNameProp || "className";

    props[ccClassNameProp] = withoutNils([
      props[ccClassNameProp],
      isComponentRoot ? ctx.rootClassName : undefined,
      ...(isComponentRoot
        ? getComponentRootTagResetClassNames(ctx, false)
        : []),
      ...getRealClassNames(positionClassName),
    ]).join(" ");
    props[setControlContextDataProp] = ctx.viewCtx.createSetContextDataFn(
      ctx.valKey,
    );

    if (isComponentRoot && isTplRootWithCodeComponentVariants(node)) {
      props["plasmicUpdateVariant"] = ctx.updateVariant;
    }

    if (meta) {
      for (const [prop, propMeta] of Object.entries(meta.meta.props)) {
        const isSlotProp =
          propMeta === "slot" ||
          (isPlainObjectPropType(propMeta) && propMeta.type === "slot");
        if (isSlotProp && props[prop] == null) {
          const param = node.component.params.find(
            (p) => p.variable.name === prop,
          );
          if (param) {
            const selKey = slotSelectionKeyFromRenderingCtx(
              ensure(
                ctx.valKey,
                () => `valKey should exist for slot placeholders`,
              ),
              param,
            );
            if (
              !ctx.viewCtx.studioCtx.renderPolicy.store.getState().showSlotPlaceholder ||
              // We don't show placeholder unless we're currently
              // editing the owner component
              !(ctx.ownerKey && isKeyInEditableStack(ctx, ctx.ownerKey)) ||
              // We don't render a placeholder if hidePlaceholder:true and
              // it is not the currently focused selectable or the user
              // has chosen to hide slot placeholders
              (isPlainObjectPropType(propMeta) &&
                // hidePlaceholder is optional on only some members of the
                // ObjectStudioPropType union; TS 7.0 no longer allows reading it
                // off the whole union, so narrow with a targeted cast.
                (propMeta as { hidePlaceholder?: boolean }).hidePlaceholder &&
                makeSelectableKey(ctx.viewCtx.focusedSelectable()) !== selKey)
            ) {
              continue;
            }
            const slotPlaceholder = ctx.sub.React.createElement(
              mkCanvasSlotPlaceholder(ctx.sub),
              {
                ctx,
                param,
                component: node.component,
                isPropOrSlot: "prop",
                slotSelectionKey: selKey,
              },
            );
            props[prop] = isRenderFuncType(param.type)
              ? () => slotPlaceholder
              : slotPlaceholder;
          }
        }
      }
      const isFetcherComponent =
        isBuiltinCodeComponent(node.component) &&
        node.component.name ===
          getBuiltinComponentRegistrations().PlasmicFetcher.meta.name;
      if (isFetcherComponent) {
        props["queries"] = ctx.env.$queries;
      }
    }
  } else {
    props[renderingCtxProp] = { ...ctx, rootClassName: positionClassName };
    ComponentImpl = createCanvasComponent(ctx.viewCtx, node.component);
  }
  props[valKeyProp] = ctx.valKey;
  props[classNameProp] = positionClassName;
  props[dataCanvasEnvsProp] = getEnvId(ctx);
  if (ctx.ownerKey) {
    props[valOwnerProp] = ctx.ownerKey;
  }
  if (isFrameRoot(ctx)) {
    props[frameUidProp] = ctx.viewCtx.arenaFrame().uid;
  }
  if (isCodeComponent(node.component) && meta) {
    const remountProps = Object.entries(meta.meta.props)
      .filter(
        ([_name, propType]) =>
          isPlainObjectPropType(propType) && (propType as any).forceRemount,
      )
      .map(([name]) => props[name]);
    props["key"] =
      props["key"] ?? `${ctx.valKey}-${JSON.stringify(remountProps)}`;
  } else {
    props["key"] = props["key"] ?? ctx.valKey;
  }

  const dataReps = serializeDataRepsIndexName(node).map(
    (varName) => ctx.env[varName],
  );
  const builtinEventHandlers: Record<string, any[]> = {};
  const canvasStateSpecs: CanvasStateSpec[] = [];
  ctx.ownerComponent?.states
    .filter((state) => state.tplNode === node)
    .forEach((state) => {
      assert(
        !!state.implicitState,
        `${getStateDisplayName(state)} should be an implicit state`,
      );
      const tplVarName = toVarName(state.tplNode!.name ?? "undefined");
      const statePath = [
        tplVarName,
        ...dataReps,
        toVarName(getLastPartOfImplicitStateName(state)),
      ];
      const maybeOnChangePropName = getStateOnChangePropName(
        state.implicitState,
      );
      const explicitlyControlled = hasExplicitStateValue(state, props) &&
        props[getStateValuePropName(state.implicitState)] !== undefined;
      const stateHelpers =
        isTplCodeComponent(node) && meta
          ? tryGetStateHelpers(
              meta.meta,
              ensureKnownNamedState(state.implicitState),
            )
          : undefined;
      if (isTplCodeComponent(node) && meta && isWritableState(state.implicitState)) {
        const registered = meta.meta.states?.[ensureKnownNamedState(state.implicitState).name];
        const propMeta = meta.meta.props[getStateValuePropName(state.implicitState)];
        canvasStateSpecs.push({
          valueProp: getStateValuePropName(state.implicitState),
          onChangeProp: maybeOnChangePropName,
          initialValueProp: registered?.initialValueProp ??
            (isPlainObjectPropType(propMeta) && "uncontrolledProp" in propMeta ? propMeta.uncontrolledProp : undefined),
          controlled: explicitlyControlled,
          onChangeArgsToValue: stateHelpers?.onChangeArgsToValue,
        });
      }
      if (maybeOnChangePropName && !explicitlyControlled) {
        const pushEventHandler = (handler: any) => {
          withDefaultFunc(
            builtinEventHandlers,
            maybeOnChangePropName,
            () => [],
          ).push(handler);
        };
        if (node.component.plumeInfo) {
          const plugin = getPlumeCodegenPlugin(node.component);
          pushEventHandler((...args: unknown[]) => {
            ctx.sub.reactWeb.generateStateOnChangeProp(
              ctx.sub.reactWeb.getStateCommandValue(ctx.env.$state),
              statePath,
            )(
              plugin?.genOnChangeEventToValue
                ? evalCodeWithEnv(
                    plugin.genOnChangeEventToValue,
                    mkEventHandlerEnvFromRenderingCtx(ctx),
                    ctx.viewCtx.canvasCtx.win(),
                  ).apply(null, args)
                : args[0],
            );
          });
        } else if (
          isTplCodeComponent(node) &&
          stateHelpers?.onChangeArgsToValue
        ) {
          pushEventHandler((...eventArgs: any[]) => {
            ctx.sub.reactWeb.generateStateOnChangeProp(
              ctx.sub.reactWeb.getStateCommandValue(ctx.env.$state),
              statePath,
            )(stateHelpers.onChangeArgsToValue?.apply(null, eventArgs));
          });
        } else {
          pushEventHandler(
            ctx.sub.reactWeb.generateStateOnChangeProp(
              ctx.sub.reactWeb.getStateCommandValue(ctx.env.$state),
              statePath,
            ),
          );
        }
      }
      if (isWritableState(state.implicitState) && !explicitlyControlled) {
        props[getStateValuePropName(state.implicitState)] =
          ctx.sub.reactWeb.generateStateValueProp(ctx.env.$state, statePath);
      }
    });
  if (ctx.ownerComponent) {
    mergeEventHandlers(
      props,
      builtinEventHandlers,
      !isTplCodeComponent(node)
        ? getComponentStateOnChangePropNames(ctx.ownerComponent, node)
        : new Set(),
    );
  }

  ctx.ownerComponent?.states.forEach((state) => {
    if (state.tplNode !== node) {
      return;
    }
    const initFuncExpr = mkInitFuncExpr(
      state,
      Array.from(ctx.activeVariants),
      ctx.viewCtx,
      exprCtx,
      true,
    );
    if (
      initFuncExpr &&
      (exprUsesCtxOrFreeVars(initFuncExpr) || dataReps.length > 0)
    ) {
      const { $state: _renderState, ...initializerEnv } = ctx.env;
      ensure(ctx.stateInitializers, "State declarations require a render owner").push({
        path: getStateVarName(state),
        initFunc: mkInitFuncFromExpr(initFuncExpr, ctx.viewCtx, ctx.env, exprCtx, true),
        repetitionIndex: dataReps,
        env: initializerEnv,
      });
    }
  });

  if (tplHasRef(node)) {
    const refProp = node.component.codeComponentMeta?.refProp ?? "ref";
    props[refProp] = ensure(ctx.registerRef, "A named template ref requires its component runtime")(
      ensure(ctx.nodeNamer?.(node), `Only named tpls can have ref`),
    );
  }

  if (
    meta &&
    ctx.ownerComponent &&
    shouldHaveImplicitState(ctx.ownerComponent, node)
  ) {
    const stateHelpers = meta.meta.componentHelpers?.helpers.states ?? {};

    // We loop by ctx.ownerComponent.states, instead of by meta.meta.states,
    // because for hostless components, if we add new states but haven't
    // upgraded yet, meta.meta.states will have states that are not yet in
    // ctx.ownerComponent.states.
    ctx.ownerComponent.states.map((state) => {
      if (state.tplNode === node && isKnownNamedState(state.implicitState)) {
        const stateName = state.implicitState.name;
        const stateHelper = stateHelpers[stateName];
        if (stateHelper && "initFunc" in stateHelper) {
          // first we search for initFunc in the helper
          ensure(ctx.stateInitializers, "State declarations require a render owner").push({
            path: getStateVarName(state),
            initFunc: ({ $props }) => stateHelper.initFunc?.($props),
            repetitionIndex: dataReps,
            env: { $props: props },
          });
        }
      }
    });
  }

  if (isCodeComponent(node.component)) {
    const codeComponentSelectionInfo = getAutoOpenSelectionInfo(ctx, node);
    props[INTERNAL_CC_CANVAS_PROP] = {
      selected: codeComponentSelectionInfo.isSelected,
      slot: codeComponentSelectionInfo.selectedSlotName,
      editing:
        !ctx.viewCtx.studioCtx.renderPolicy.store.getState().interactive &&
        !ctx.viewCtx.canvasCtx.frameInfo(ctx.viewCtx).getState().exporting &&
        ctx.viewCtx.contentEditor.isExpanded(computeFullKey(ctx)),
      // The artboard shows its full page height; components with internal
      // vertical scroll viewports may render all of their content instead.
      fullContent: ctx.viewCtx.canvasCtx.frameInfo(ctx.viewCtx).getState().fullPageHeight,
    };
    if (
      meta?.meta.canvasOverlay &&
      !ctx.viewCtx.canvasCtx.frameInfo(ctx.viewCtx).getState().exporting
    ) {
      const autoOpen =
        codeComponentSelectionInfo.isSelected &&
        (!meta?.meta.canvasOverlay?.triggerSlot || codeComponentSelectionInfo.selectedSlotName !==
          meta.meta.canvasOverlay.triggerSlot);
      const sessionSourceProps = ctx.renderSlotInstance ? sourceProps : props;
      ctx.viewCtx.syncCanvasOverlayState(
        computeCanvasSessionKey(ctx),
        autoOpen || !!sessionSourceProps.open,
        sessionSourceProps.open,
        sessionSourceProps.defaultOpen,
      );
    }
    props[INTERNAL_CC_CANVAS_PROP].onReveal = () => {
      ctx.viewCtx.autoOpenedUuid =
        node.component.params.find(
          (p) =>
            p.variable.name === codeComponentSelectionInfo.selectedSlotName,
        )?.uuid ?? node.uuid;
    };
    if (!ctx.viewCtx.canvasCtx.frameInfo(ctx.viewCtx).getState().exporting) {
      props[INTERNAL_CC_CANVAS_PROP].states = applyCanvasSessionState(
        ctx.viewCtx.canvasSessionState, computeCanvasSessionKey(ctx), props, canvasStateSpecs,
        ctx.viewCtx.studioCtx.renderPolicy.store.getState().interactive,
        () => ctx.viewCtx.scheduleSync({ eval: true, styles: false, asap: true }),
        !!meta?.meta.canvasOverlay,
        ctx.renderSlotInstance ? sourceProps : undefined,
      );
    }
  }

  let elt = createPlasmicElementProxy(node, ctx, ComponentImpl, props);
  if (isTplTag(node.parent) && isCodeComponent(node.component)) {
    // When we're rendering a code component, we wrap it in an error boundary,
    // but only when it's a child of a TplTag. This is because code components
    // can be picky about the type of elements that are passed in as props
    // so we can't just wrap always wrap them. Even normal Plasmic TplComponent
    // may be picky since it may render a code component under the hood.  But
    // we know for sure that TplTags are not picky, so this is the easiest /
    // best we can do.
    elt = wrapCanvasErrorBoundary({
        ctx,
        nodeOrComponent: node,
        children: elt,
        nodeProps: props,
      });
  }
  return elt;
}

function isFrameRoot(ctx: RenderingCtx) {
  return !ctx.valKey.includes(".");
}

function maybeUnwrapFragments(
  sub: SubDeps,
  child: React.ReactElement | undefined | null,
) {
  if (
    sub.React.isValidElement<{ children?: React.ReactNode }>(child) &&
    child.type === sub.React.Fragment &&
    child.key?.startsWith(repFragmentKey)
  ) {
    return child.props.children;
  }
  return child;
}

function computeRenderedArg(
  param: Param,
  tpls: TplNode[],
  ctx: RenderingCtx,
  envOverrides: Partial<CanvasEnv>,
) {
  if (tpls.length === 0) {
    return null;
  }

  const elements = withoutNils(
    tpls
      .flatMap((child) => {
        const childCtx = Object.assign({}, ctx);
        childCtx.env = {
          ...ctx.env,
          ...envOverrides,
        };
        childCtx.wrappingEnv = {
          ...ctx.wrappingEnv,
          ...envOverrides,
        };
        childCtx.valKey = ctx.valKey + "." + child.uuid;
        const elt = renderTplNode(child, childCtx);
        // When passing args to code components, code components
        // can be picky about what they receive. Specifically, components
        // like react-slick will create slides based on each element in
        // the children array. If the `child` is a repeated element,
        // then `renderTplNode` will wrap the repeated elements in a
        // Fragment, which we now unwrap so that we pass in an array
        // of elements as expected by the code component.
        return maybeUnwrapFragments(ctx.sub, elt);
      })
      .map((v) => {
        if (!ctx.sub.React.isValidElement<Record<string, unknown>>(v)) {
          return v;
        }
        let attrs: Record<string, string> = {
          [slotArgCompKeyProp]: ctx.valKey,
          [slotArgParamProp]: param.uuid,
        };
        if (v.type === ctx.sub.React.Fragment) {
          const existingKey = v.key;
          if (
            isString(existingKey) &&
            existingKey.startsWith(slotFragmentKey)
          ) {
            const existingAttrs = JSON.parse(
              existingKey.slice(slotFragmentKey.length),
            );
            attrs = { ...existingAttrs, ...attrs };
          }
          attrs = {
            key: `${slotFragmentKey}${JSON.stringify(attrs)}`,
          };
        }
        return ctx.sub.React.cloneElement(v, attrs);
      }),
  );
  if (param.variable.name === "children") {
    return elements;
  }
  return elements.length === 0
    ? null
    : elements.length === 1
      ? elements[0]
      : ctx.sub.React.createElement(ctx.sub.React.Fragment, {}, elements);
}

function computeTplComponentArgs(
  tpl: TplComponent,
  effectiveVs: EffectiveVariantSetting,
  ctx: RenderingCtx,
) {
  const ofCodeComponent = isCodeComponent(tpl.component);
  const exprCtx: ExprCtx = {
    component: ctx.ownerComponent ?? null,
    projectFlags: ctx.projectFlags,
    inStudio: true,
  };

  const rootCtx = ctx;
  const evalArgExpr = (
    param: DeepReadonly<Param>,
    expr: DeepReadonly<Expr>,
    evaluationCtx: RenderingCtx = rootCtx,
  ): any => {
    return switchType(expr)
      .when(RenderExpr, (_expr) => {
        if (_expr.tpl.length === 0) {
          // An empty code-component slot leaves the native default intact.
          // Explicit null expressions still override it.
          return ofCodeComponent ? undefined : null;
        } else {
          const renderContents = (renderCtx: RenderingCtx, envOverrides: Partial<CanvasEnv>) => {
            const contents = (extraEnv: Partial<CanvasEnv>, scope = renderCtx, onRenderInvalidated = scope.onRenderInvalidated) =>
              computeRenderedArg(param, _expr.tpl, { ...scope, onRenderInvalidated }, { ...extraEnv, ...envOverrides });
            if (shouldWrapSlotContentInDataCtxReader(tpl.component, param)) {
              return wrapInDataCtxReader(
                renderCtx,
                ($newCtx, onRenderInvalidated, scope) =>
                  withErrorDisplayFallback(
                    renderCtx,
                    tpl,
                    () =>
                      renderCtx.sub.React.createElement(renderCtx.sub.CanvasWrapper, {
                        // Expose the slot's data context even when descendants do not render.
                        [slotExtraCanvasEnvProp]: ensureType<ExtraSlotCanvasEnvData>({
                          env: { ...renderCtx.env, ...envOverrides, $ctx: { ...$newCtx } },
                          slotPropUuid: param.uuid,
                          tplComponentValKey: renderCtx.valKey,
                        }),
                        children: contents({ $ctx: $newCtx }, scope, onRenderInvalidated),
                      }),
                    {
                      hasLoadingBoundary:
                        $newCtx?.[hasLoadingBoundaryKey] ||
                        renderCtx.env.$ctx?.[hasLoadingBoundaryKey],
                    },
                  ),
                `DataCtxReaderChildren(${tpl.uuid}.${param.variable.name})`,
              );
            }
            return contents({});
          };
          if (isRenderFuncType(param.type)) {
            const paramType = param.type;
            return (...args: any[]) => mkUseCanvasObserver(evaluationCtx.sub, evaluationCtx.viewCtx, evaluationCtx.viewCtx.canvasRenderOwner.observerInput(evaluationCtx.viewCtx, tpl, evaluationCtx))(
              (onRenderInvalidated) => evaluationCtx.sub.React.createElement(evaluationCtx.sub.CanvasRenderSlot, {
                render: (instance) => renderWithStateInitializers(
                  { ...evaluationCtx, onRenderInvalidated, renderSlotInstance: JSON.stringify([evaluationCtx.renderSlotInstance, param.uuid, instance]) },
                  (scope) => renderContents(scope, zipObject(paramType.params.map((parameter) => parameter.argName), args)),
                ),
              }),
            );
          }
          return renderContents(evaluationCtx, {});
        }
      })
      .when(CustomCode, (_expr) => {
        return evalCodeWithEnv(
          getCodeExpressionWithFallback(_expr, exprCtx),
          evaluationCtx.env,
          evaluationCtx.viewCtx.canvasCtx.win(),
        );
      })
      .when(DataSourceOpExpr, (_expr) => {
        // Remove currentUser from env so that it doesn't get passed to the operations for now
        const { currentUser: _, ...rest } = evaluationCtx.env;
        return evalCodeWithEnv(
          asCode(_expr, exprCtx).code,
          rest,
          evaluationCtx.viewCtx.canvasCtx.win(),
        );
      })
      .when(VarRef, (_expr) => {
        const component = ensure(
          evaluationCtx.ownerComponent,
          () => `ownerComponent should exist as we're passing VarRef args`,
        );
        const referencedParam = extractReferencedParam(component, _expr);
        if (!referencedParam) {
          return undefined;
        }
        return evaluationCtx.env.$props[canvasParamToVarName(component, referencedParam)];
      })
      .when(StyleTokenRef, (_expr) => {
        if (isKnownColorPropType(param.type) && param.type.noDeref) {
          return mkTokenRef(_expr.token);
        }
        const vsh = new VariantedStylesHelper(evaluationCtx.site, [
          ...evaluationCtx.activeVariants,
        ]);
        const resolver = makeTokenValueResolver(evaluationCtx.site);
        return resolver(toFinalToken(_expr.token, evaluationCtx.site), vsh);
      })
      .when(PageHref, (_expr) =>
        evalCodeWithEnv(
          asCode(_expr, exprCtx).code,
          evaluationCtx.env,
          evaluationCtx.viewCtx.canvasCtx.win(),
        ),
      )
      .when(ImageAssetRef, (_expr) =>
        ofCodeComponent
          ? _expr.asset.dataUri
          : maybeMakePlasmicImgSrc(_expr.asset, exprCtx),
      )
      .when(VariantsRef, (_expr) =>
        _expr.variants.map((v) => toVarName(v.name)),
      )
      .when(ObjectPath, (_expr) =>
        evalCodeWithEnv(
          getCodeExpressionWithFallback(_expr, exprCtx),
          evaluationCtx.env,
          evaluationCtx.viewCtx.canvasCtx.win(),
        ),
      )
      .when(EventHandler, (_expr) => {
        return wrapCanvasEventHandler(
          evaluationCtx.viewCtx,
          (...eventArgs: unknown[]) => evalCodeWithEnv(
            getRawCode(expr, exprCtx),
            mkEventHandlerEnvFromRenderingCtx(evaluationCtx),
            evaluationCtx.viewCtx.canvasCtx.win(),
          )(...eventArgs),
        );
      })
      .when(FunctionArg, (functionArg) => evalArgExpr(param, functionArg.expr, evaluationCtx))
      .when(CollectionExpr, (collectionExpr) => [
        ...collectionExpr.exprs.map((_expr) =>
          _expr ? evalArgExpr(param, _expr, evaluationCtx) : undefined,
        ),
      ])
      .when(MapExpr, (_expr) =>
        Object.fromEntries(
          Object.entries(_expr.mapExpr).map(([name, iexpr]) => [
            name,
            flattenExprs(iexpr).some(isKnownEventHandler)
              ? evalArgExpr(param, iexpr, evaluationCtx)
              : evalCodeWithEnv(getRawCode(iexpr, exprCtx), evaluationCtx.env, evaluationCtx.viewCtx.canvasCtx.win()),
          ]),
        ),
      )
      .when(StyleExpr, (_expr) => {
        // For a ClassNamePropType (with StyleExpr value), we actually don't
        // want to just use the styles for this specific _expr. Instead,
        // we want to include all the "active" StyleExprs across different
        // VariantSettings. So if there are overrides on base variant, and
        // color=blue variant, we want this to evaluate to
        // `pcls_base pcls_type_blue`, and not just `pcls_type_blue` (which
        // is what `_expr` corresponds to). So we actually ignore `_expr`,
        // and we look at what the all the active variant settings, and
        // string together all the active StyleExpr class names.
        const classes: string[] = [];
        for (const vs of effectiveVs.variantSettings) {
          const arg2 = vs.args.find((arg) => arg.param === param);
          if (arg2 && isKnownStyleExpr(arg2.expr)) {
            classes.push(makeStyleExprClassName(arg2.expr));
          }
        }
        return classes.join(" ");
      })
      .when(TemplatedString, (templatedString) =>
        evalCodeWithEnv(
          getRawCode(templatedString, exprCtx),
          evaluationCtx.env,
          evaluationCtx.viewCtx.canvasCtx.win(),
        ),
      )
      .when(FunctionExpr, (functionExpr) =>
        flattenExprs(functionExpr.bodyExpr).some(isKnownEventHandler)
          ? (...args: unknown[]) => evalArgExpr(param, functionExpr.bodyExpr, {
            ...evaluationCtx, env: { ...evaluationCtx.env, ...zipObject(functionExpr.argNames, args) },
          })
          : evalCodeWithEnv(asCode(functionExpr, exprCtx).code, evaluationCtx.env, evaluationCtx.viewCtx.canvasCtx.win()),
      )
      .when(TplRef, (_expr) =>
        unexpected(`Cannot evaluate TplRef as a component arg`),
      )
      .when(QueryInvalidationExpr, (_expr) =>
        unexpected(`Cannot evaluate QueryInvalidationExpr as component arg`),
      )
      .when(CompositeExpr, (composite) => {
        if (!flattenExprs(composite).some(isKnownEventHandler)) {
          return evalCodeWithEnv(asCode(composite, exprCtx).code, evaluationCtx.env, evaluationCtx.viewCtx.canvasCtx.win());
        }
        const value = evalCodeWithEnv(composite.hostLiteral, evaluationCtx.env, evaluationCtx.viewCtx.canvasCtx.win());
        for (const [path, expression] of Object.entries(composite.substitutions)) {
          const keys = toPath(path);
          const parent = keys.length > 1 ? get(value, keys.slice(0, -1)) : value;
          parent[ensure(last(keys), "Composite substitutions require a property path")] = flattenExprs(expression).some(isKnownEventHandler)
            ? evalArgExpr(param, expression, evaluationCtx)
            : evalCodeWithEnv(getRawCode(expression, exprCtx), evaluationCtx.env, evaluationCtx.viewCtx.canvasCtx.win());
        }
        return value;
      })
      .when(CustomFunctionExpr, (_expr) =>
        unexpected(`Cannot evaluate CustomFunctionExpr as a component arg`),
      )
      .result();
  };

  const args: Record<string, any> = {};

  const addToEnv = (param: DeepReadonly<Param>, val: any) => {
    if (!param.variable.name) {
      return;
    }
    args[canvasParamToVarName(tpl.component, param)] = val;
  };

  for (const arg of effectiveVs.args) {
    // Keep click handlers available for explicit modifier clicks. Other events
    // remain absent in edit mode, including mount/onChange callbacks.
    if (
      !ctx.viewCtx.studioCtx.renderPolicy.store.getState().interactive &&
      isKnownEventHandler(arg.expr) &&
      canvasParamToVarName(tpl.component, arg.param) !== "onClick"
    ) {
      continue;
    }
    addToEnv(arg.param, evalArgExpr(arg.param, arg.expr));
  }

  for (const [name, expr] of Object.entries(effectiveVs.attrs)) {
    if (
      ctx.viewCtx.studioCtx.renderPolicy.store.getState().interactive ||
      (name === "onClick" && isKnownEventHandler(expr))
    ) {
      const tempParam = mkParam({
        name,
        type: typeFactory.any(),
        paramType: "prop",
      });
      addToEnv(tempParam, evalArgExpr(tempParam, expr));
    }
  }

  let rootDefaults: Record<string, any> | undefined = undefined;
  if (tpl === ctx.viewCtx.componentArgsContainer()) {
    // This is the root TplComponent!
    const plugin = getPlumeEditorPlugin(tpl.component);
    if (plugin?.getArtboardRootDefaultProps) {
      rootDefaults = plugin.getArtboardRootDefaultProps(tpl.component);
    }
  }

  const isInCurrentComponentStack = ctx.viewCtx.componentStackFrames().some((frame) => frame.tplComponent === tpl);

  const ccMeta = maybeGetCodeComponentMeta(ctx.viewCtx, tpl.component);

  for (const param of tpl.component.params) {
    const maybePropMeta = ccMeta?.meta.props[param.variable.name];

    if (
      ctx.viewCtx.component === tpl.component &&
      tpl.component.variantGroups.find((vg) => vg.param === param)
    ) {
      // Do not set variants, because they are managed inside the component
      // using pin manager and $state.
      continue;
    } else if (
      ctx.viewCtx.studioCtx.renderPolicy.store.getState().interactive &&
      maybePropMeta &&
      isPlainObjectPropType(maybePropMeta) &&
      (maybePropMeta as any).editOnly
    ) {
      // Do not pass editOnly props on interactive mode.
      continue;
    } else if (
      param.previewExpr &&
      // We don't do this initialization for state params, as their initial
      // values are initialized in `$state`.  A state prop's initial expr
      // may not make sense in this context; for example, a state's initial
      // value may reference other `$state.value` or `$queries.something`,
      // and we take special care when initializing `$state` and `$queries`
      // to take that into account, but we don't do that here.
      !isKnownStateParam(param) &&
      isInCurrentComponentStack &&
      !(canvasParamToVarName(tpl.component, param) in args)
    ) {
      addToEnv(param, evalArgExpr(param, param.previewExpr));
    } else if (
      param.defaultExpr &&
      !isKnownStateParam(param) &&
      !(canvasParamToVarName(tpl.component, param) in args)
    ) {
      addToEnv(param, evalArgExpr(param, param.defaultExpr));
    } else if (isKnownStyleScopeClassNamePropType(param.type)) {
      addToEnv(
        param,
        makeStyleScopeClassName(
          tpl,
          makeCanvasRuleNamers(tpl.component).nonInteractive,
          param.type.scopeName,
        ),
      );
    } else if (isKnownDefaultStylesClassNamePropType(param.type)) {
      addToEnv(
        param,
        getComponentRootTagResetClassNames(
          ctx,
          param.type.includeTagStyles,
        ).join(" "),
      );
    } else if (isKnownDefaultStylesPropType(param.type)) {
      addToEnv(
        param,
        makeDefaultStyleValuesDict(ctx.site, Array.from(ctx.activeVariants)),
      );
    } else if (
      rootDefaults &&
      param.variable.name in rootDefaults &&
      !(canvasParamToVarName(tpl.component, param) in args)
    ) {
      addToEnv(param, rootDefaults[param.variable.name]);
    }
  }

  return args;
}

function getComponentRootTagResetClassNames(
  ctx: RenderingCtx,
  includeTagStyles: boolean,
) {
  const component = ensure(
    ctx.ownerComponent,
    "isComponentRoot means it must have an owning component",
  );
  const rootResetClass = makeRootResetClassName(
    `${getOwnerSite(component).uid}`,
    { targetEnv: "canvas", stylesOpts: { scheme: "css" } },
  );
  return withoutNils([
    "plasmic-tokens",
    rootResetClass,
    includeTagStyles ? `${rootResetClass}_tags` : undefined,
    ...Array.from(ctx.activeVariants)
      // Get class names for non-screen variants only, as screen variants are handled via media query
      .filter(
        (v) => isGlobalVariant(v) && !isScreenVariant(v) && !isBaseVariant(v),
      )
      // Include each global variant class name separately (instead of as a combo),
      // because the Studio UI and codegen only support varianted tokens with 1 variant.
      .map(
        (v) =>
          makeCssClassNameForVariantCombo([v], {
            targetEnv: "canvas",
            prefix: "__wab_",
          }) ?? undefined,
      ),
  ]);
}

function canvasParamToVarName(
  component: Component,
  param: DeepReadonly<Param>,
) {
  return paramToVarName(component, param, { useControlledProp: true });
}

function mergeEventHandlers(
  userAttrs: Record<string, any>,
  builtinEventHandlers: Record<string, any[]>,
  onChangeAttrs: Set<JsIdentifier> = new Set(),
) {
  const chained = (
    attr: string,
    attrBuiltinEventHandlers: any[],
    userAttr: any[],
  ) => {
    return async (...args: any[]) => {
      for (const handler of attrBuiltinEventHandlers) {
        await handler.apply(null, args);
      }

      // Check if we should skip user attr handlers because of state initialization trigger
      if (
        onChangeAttrs.has(toJsIdentifier(attr)) &&
        args.length > 1 &&
        args[1] &&
        args[1]._plasmic_state_init_
      ) {
        return;
      }

      for (const handler of userAttr) {
        await handler.apply(null, args);
      }
    };
  };
  Object.keys(builtinEventHandlers).forEach((key) => {
    userAttrs[key] = chained(
      toJsIdentifier(key),
      withoutNils(builtinEventHandlers[key]),
      withoutNils([userAttrs[key]]),
    );
  });
}

function renderTplTag(
  node: TplTag,
  ctx: RenderingCtx,
  activeVSettingsWithoutDisabled: VariantSetting[],
): React.ReactElement | null {
  const effectiveVsWithoutDisabled = new EffectiveVariantSetting(
    node,
    activeVSettingsWithoutDisabled,
    ctx.site,
  );
  const { activeVSettings, evaledAttrs, effectiveVs, isComponentRoot } =
    computeActiveVariantsForMaybeDisabledTag(
      node,
      ctx,
      activeVSettingsWithoutDisabled,
      effectiveVsWithoutDisabled,
    );

  const { rendered, style } = determineAutoOpenState(ctx, node, effectiveVs);

  if (!rendered) {
    return null;
  }

  const variantRuleSetClasses = activeVSettings.map((vs) =>
    classNameForRuleSet(vs.rs),
  );
  // classNames for variant settings where all variants either evaluate to true,
  // or is a private pseudo selector.  That's because we should always include
  // the classes targeting pseudo elements, like ::placeholder.
  const pseudoVariantClasses = getActivePseudoElementVariantClasses(
    isComponentRoot,
    node,
    ctx,
  );
  const isPlaceholder =
    (node.tag === "img" && !evaledAttrs["src"]) ||
    (node.tag === "svg" && !evaledAttrs["outerHTML"]);

  let tag: string | React.ElementType = node.tag;
  if (isPlaceholder) {
    delete evaledAttrs["outerHTML"];
    evaledAttrs["src"] = placeholderImgUrl(node.tag === "svg");
    tag = "img";
  } else if (node.tag === "img" && ctx.projectFlags.usePlasmicImg) {
    tag = ctx.sub.reactWeb.PlasmicImg;
  } else if (node.tag === "svg") {
    tag = ctx.sub.CanvasIcon;
    evaledAttrs.placeholderUrl = placeholderImgUrl(true);
  }
  const classes = uniqifyClassName(
    [
      ...defaultStyleClassNames(studioDefaultStylesClassNameBase, {
        tag: tag === ctx.sub.reactWeb.PlasmicImg ? "PlasmicImg" : node.tag,
        projectId: canvasProjectId,
      }),
      ...variantRuleSetClasses,
      ...pseudoVariantClasses,
      isComponentRoot ? ctx.rootClassName : undefined,
      isComponentRoot && "__wab_val_root",
      ...(isComponentRoot
        ? getComponentRootTagResetClassNames(ctx, false)
        : []),
      "__wab_tag",
      ctx.inline && "__wab_inline",
      effectiveVs.rsh().get("display") === "grid" && "__wab_grid",
      isTplImage(node) &&
        (node.tag === "img" ? "__wab_img_instance" : "__wab_svg"),
    ]
      .filter(Boolean)
      .join(" "),
  );
  const attrs = {
    ...evaledAttrs,
    onAuxClick: (e: MouseEvent) => {
      if (tag === "a") {
        e.preventDefault();
        e.stopPropagation();
      }
    },
    className: cx(classes, evaledAttrs["className"]),
    ...(ctx.slate && !isTplImage(node)
      ? {
          children: renderSlateChildren({
              node,
              inline: !!ctx.inline,
              slate: ctx.slate,
              effectiveVs,
              ctx,
            }),
        }
      : !isTplImage(node) && !isTplTextBlock(node)
        ? {
            children: deriveTplTagChildren(node, ctx, effectiveVs, evaledAttrs),
          }
        : {}),
    ...(ctx.slate
      ? { ...ctx.slate.attributes, "data-nonselectable": true }
      : {}),
  };

  if (tag === ctx.sub.reactWeb.PlasmicImg) {
    plasmicImgAttrStyles.forEach((prop) => {
      const reactProp = toReactAttr(`display-${prop}`);
      if (!(reactProp in attrs)) {
        const val = effectiveVs.rsh().getRaw(prop);
        if (val) {
          attrs[reactProp] = deriveSizeStyleValue(prop as any, val);
        }
      }
    });
    attrs["loader"] = "plasmic";
  }
  const state = ctx.ownerComponent?.states.find(
    (istate) => istate.tplNode === node,
  );
  if (state) {
    assert(state.tplNode?.name, "a stateful tag should have a named tplNode");
    const dataReps = ancestorsUp(node)
      .filter(isTplRepeated)
      .map(
        (parentNode) =>
          ctx.env[getRepetitionIndexName(parentNode.vsettings[0].dataRep!)],
      )
      .reverse();

    const tplVarName = toVarName(state.tplNode.name);
    const stateVarName = toVarName(getLastPartOfImplicitStateName(state));
    const statePath = [tplVarName, ...dataReps, stateVarName];
    attrs["value"] = ctx.sub.reactWeb.generateStateValueProp(
      ctx.env.$state,
      statePath,
    );
    const builtinEventHandlers: Record<string, any> = {
      onChange: [
        (e: React.ChangeEvent<HTMLInputElement>) =>
          ctx.sub.reactWeb.generateStateOnChangeProp(
            ctx.sub.reactWeb.getStateCommandValue(ctx.env.$state),
            statePath,
          )(e.target.value),
      ],
    };
    mergeEventHandlers(attrs, builtinEventHandlers);
  }
  adjustFinalAttrs(attrs, node, activeVSettings);

  attrs[valKeyProp] = ctx.valKey;
  attrs[classNameProp] = classes;
  attrs[dataCanvasEnvsProp] = getEnvId(ctx);
  if (ctx.ownerKey) {
    attrs[valOwnerProp] = ctx.ownerKey;
  }
  attrs["key"] = attrs["key"] ?? ctx.valKey;

  if (tplHasRef(node)) {
    attrs["ref"] = ensure(ctx.registerRef, "A named template ref requires its component runtime")(
      ensure(node.name, `Only named tpls can have ref`),
    );
  }

  if (style) {
    attrs["style"] = {
      ...(attrs["style"] ?? {}),
      ...style,
    };
  }

  if (isTplTextBlock(node)) {
    return ctx.sub.React.createElement(mkRichText(ctx.sub), {
      ctx,
      node,
      effectiveVs,
      attrs,
      tag,
    });
  }

  return createPlasmicElementProxy(node, ctx, tag, attrs);
}

/**
 * Computes active variant settings and other related results for
 * a tag.  The main complication here is that if a tag is disabled,
 * we need to enable the corresponding :disabled variant settings.
 */
function computeActiveVariantsForMaybeDisabledTag(
  node: TplTag,
  ctx: RenderingCtx,
  activeVSettings: VariantSetting[],
  effectiveVs: EffectiveVariantSetting,
) {
  const evaledAttrs = Object.fromEntries(
    Object.entries(effectiveVs.attrs).map(([attr, expr]) => {
      if (
        !ctx.viewCtx.studioCtx.renderPolicy.store.getState().interactive &&
        isKnownEventHandler(expr) &&
        attr !== "onClick"
      ) {
        return tuple(attr, null);
      }
      const expression = evalTagAttrExprToString(node, attr, expr, ctx);
      const value = isKnownEventHandler(expr)
        ? wrapCanvasEventHandler(ctx.viewCtx, (...args: unknown[]) =>
          evalCodeWithEnv(expression, mkEventHandlerEnvFromRenderingCtx(ctx), ctx.viewCtx.canvasCtx.win())(...args))
        : evalCodeWithEnv(expression, ctx.env, ctx.viewCtx.canvasCtx.win());
      return tuple(attr, value);
    }),
  );

  if (node.tag === "input") {
    evaledAttrs["autoComplete"] = "new-password";
  }

  const disabled = evaledAttrs["disabled"] === true;
  const component = ensure(
    ctx.ownerComponent,
    () => `TplTag should have have owner component`,
  );
  const isComponentRoot = component.tplTree === node;

  if (disabled) {
    // This element is disabled! We need to activate the variant settings
    // targeting :disabled.  Note that this is the only style selector we have
    // that depends on an attr; all other pseudoselectors correspond to actual
    // interactions (like :hover, etc) and so don't need to be special-cased
    // in this way.

    // First, we check for active VariantSettings for this element that
    // has a :disabled selector
    const activeDisabledVSettings = node.vsettings.filter((vs) => {
      if (activeVSettings.includes(vs)) {
        // Already activated (via pinning), so no need to add
        return false;
      }
      const disabledVariants = vs.variants.filter((v) =>
        isDisabledPseudoSelectorVariantForTpl(v, isComponentRoot),
      );
      if (
        disabledVariants.length > 0 &&
        without(vs.variants, ...disabledVariants).every(
          (v) => isBaseVariant(v) || ctx.activeVariants.has(v),
        )
      ) {
        return true;
      }
      return false;
    });
    if (activeDisabledVSettings.length > 0) {
      // Found some, so update the list of activeVSettings and the effectiveVs
      // We don't need to recomptue evaledAttrs because attrs cannot be targeted
      // from private variants.
      activeVSettings = sortedVariantSettings(
        [...activeVSettings, ...activeDisabledVSettings],
        makeVariantComboSorter(ctx.site, component),
      );
      effectiveVs = new EffectiveVariantSetting(
        node,
        activeVSettings,
        ctx.site,
      );
    }
    if (isComponentRoot) {
      // If this is a component root, we'll also want to activate the component-level
      // :disabled variants, so that children elements can render accordingly.  Note that
      // this is also the only time where we are modifying the `ctx.activeVariants`
      // while evaluating a TplTag!
      const activeDisabledCompVariants = allComponentVariants(component).filter(
        (v) =>
          (isDisabledPseudoSelectorVariantForTpl(v, true) &&
            isBaseVariant(v)) ||
          ctx.activeVariants.has(v),
      );
      if (activeDisabledCompVariants.length > 0) {
        ctx.activeVariants = new Set([
          ...ctx.activeVariants,
          ...activeDisabledCompVariants,
        ]);
      }
    }
  }

  return {
    activeVSettings,
    effectiveVs,
    evaledAttrs,
    ctx,
    isComponentRoot,
  };
}

/**
 * Evaluates attribute expression to a string
 */
function evalTagAttrExprToString(
  tpl: TplTag,
  attr: string,
  expr: Expr,
  ctx: RenderingCtx,
): string {
  const exprCtx: ExprCtx = {
    component: ctx.ownerComponent ?? null,
    projectFlags: ctx.projectFlags,
    inStudio: true,
  };

  return switchType(expr)
    .when(CustomCode, (customCode: CustomCode) => {
      if (isRealCodeExpr(customCode)) {
        return getCodeExpressionWithFallback(customCode, exprCtx);
      }
      return customCode.code;
    })
    .when(VarRef, (varRef: VarRef) => {
      return `$props.${toVarName(varRef.variable.name)}`;
    })
    .when(ImageAssetRef, (imageAssetRef: ImageAssetRef) => {
      const dataUri = imageAssetRef.asset.dataUri;
      if (isTplIcon(tpl) && attr === "outerHTML" && dataUri) {
        return JSON.stringify(parseDataUrlToSvgXml(dataUri));
      }
      return JSON.stringify(
        maybeMakePlasmicImgSrc(imageAssetRef.asset, exprCtx),
      );
    })
    .when(PageHref, (pageHref: PageHref) => {
      return asCode(pageHref, exprCtx).code;
    })
    .when(ObjectPath, (objectPath: ObjectPath) => {
      return getCodeExpressionWithFallback(objectPath, exprCtx);
    })
    .when(EventHandler, (eventHandler: EventHandler) => {
      return getRawCode(eventHandler, exprCtx);
    })
    .when(TemplatedString, (templatedString: TemplatedString) => {
      return asCode(templatedString, exprCtx).code;
    })
    .when(
      [
        DataSourceOpExpr,
        VariantsRef,
        FunctionArg,
        StrongFunctionArg,
        CollectionExpr,
        MapExpr,
        RenderExpr,
        VirtualRenderExpr,
        StyleExpr,
        StyleTokenRef,
        FunctionExpr,
        TplRef,
        QueryInvalidationExpr,
        CompositeExpr,
        CustomFunctionExpr,
      ],
      (_) => {
        assert(false, "Unexpected expr type");
      },
    )
    .result();
}

function getActivePseudoElementVariantClasses(
  isComponentRoot: boolean,
  tpl: TplNode,
  ctx: RenderingCtx,
) {
  const settings = tpl.vsettings.filter((vs) => {
    if (
      vs.variants.some((v) => isPseudoElementVariantForTpl(v, isComponentRoot))
    ) {
      return vs.variants.every(
        (v) =>
          isBaseVariant(v) ||
          ctx.activeVariants.has(v) ||
          isPseudoElementVariantForTpl(v, isComponentRoot),
      );
    }
    return false;
  });
  return settings.map((vs) => classNameForRuleSet(vs.rs));
}

function adjustFinalAttrs(
  finalAttrs: any,
  tpl: TplTag,
  activeVariantSettings: VariantSetting[],
) {
  if (tpl.tag === "input" || tpl.tag === "textarea") {
    // When rendering input, we always set "value", so that we are always
    // a "controlled" input, even when there's no value attr actually set on the
    // TplNode.  That's because if we switch between setting and not setting
    // the "value" attr, we are switching between "controlled" and "uncontrolled",
    // and the behavior there is undefined.  Specifically, if we set a "value",
    // and then unset it, we will see that the DOM input element will still have
    // that value set.
    finalAttrs["value"] =
      finalAttrs["value"] || finalAttrs["defaultValue"] || "";

    if (
      activeVariantSettings.some((vs) =>
        vs.variants.some((v) =>
          variantHasPrivatePseudoElementSelector(v, "::placeholder"),
        ),
      )
    ) {
      // If we are explicitly targeting the
      // ::placeholder variant, then temporarily blank out the `value`
      // attribute so that the browser is indeed showing the ::placeholder
      // styles.
      finalAttrs["value"] = "";
    }
  }

  // Don't actually render element in disabled state since disabled
  // element won't trigger mouse events.
  if (finalAttrs["disabled"]) {
    delete finalAttrs["disabled"];
  }
}

function evalDataCondExpr(
  ctx: RenderingCtx,
  effectiveVs: EffectiveVariantSetting,
) {
  const dataCondExpr = effectiveVs.dataCond;
  if (dataCondExpr == null) {
    return true;
  }
  const exprCtx: ExprCtx = {
    component: ctx.ownerComponent ?? null,
    projectFlags: ctx.projectFlags,
    inStudio: true,
  };
  // Visibility expressions may reference server queries ($q.myQ.data) which throws
  // a promise while loading, or error on fail. Treat any throw as "not visible" to
  // not crash canvas rendering. Once queries settle, re-render will re-evaluate this correctly.
  try {
    return !!evalCodeWithEnv(
      getCodeExpressionWithFallback(dataCondExpr, exprCtx),
      ctx.env,
      ctx.viewCtx.canvasCtx.win(),
    );
  } catch {
    return false;
  }
}

function determineAutoOpenState(
  ctx: RenderingCtx,
  node: TplNode,
  effectiveVs: EffectiveVariantSetting,
) {
  const visibility = getEffectiveVsVisibility(effectiveVs);
  const display = effectiveVs.rsh().get("display");
  const hiddenByDisplay = visibility === TplVisibility.DisplayNone || display === "none";
  const nativeVisible = !hiddenByDisplay && (visibility === TplVisibility.Visible ||
    evalDataCondExpr(ctx, effectiveVs));
  // This decision is the only export-sensitive part of native node visibility.
  // Record its actual dependency without evaluating the visibility policy twice.
  const visibilityUsesExport = !nativeVisible || ctx.viewCtx.canvasSessionState.has(computeCanvasSessionKey(ctx), "$visibility");
  ctx.viewCtx.canvasRenderOwner.setExportVisibilityInput(ctx, visibilityUsesExport);
  let visible = nativeVisible;
  if (visibilityUsesExport && !ctx.viewCtx.canvasCtx.frameInfo(ctx.viewCtx).getState().exporting) {
    const session = ctx.viewCtx.canvasSessionState;
    const instance = computeCanvasSessionKey(ctx);
    if (!nativeVisible || session.has(instance, "$visibility")) {
      visible = !!session.resolve(instance, "$visibility", nativeVisible, [
      visibility, hiddenByDisplay, effectiveVs.dataCond ? hashExpr(ctx.site, effectiveVs.dataCond, {
        component: ctx.ownerComponent ?? null, projectFlags: ctx.projectFlags, inStudio: true,
      }) : undefined,
      ]);
      if (!nativeVisible) {
        visible = !!session.reveal(instance, "$visibility", getAutoOpenSelectionInfo(ctx, node).isSelected);
      }
    }
  }
  const autoOpened = visible && !nativeVisible;
  if (autoOpened) {ctx.viewCtx.autoOpenedUuid = node.uuid;}
  return {
    rendered: visibility === TplVisibility.DisplayNone || visibility === TplVisibility.Visible || visible,
    autoOpened,
    style: hiddenByDisplay && visible
      ? { display: normalizeDisplayValue(isTplComponent(node) && (!effectiveVs.rsh().has("display") || display === "none")
          ? getTplComponentDefaultDisplayByActiveVariants(node, Array.from(ctx.activeVariants)) ?? "block"
          : display === "none" ? "revert" : display) }
      : undefined,
  };
}

function deriveTplTagChildren(
  node: TplTag,
  ctx: RenderingCtx,
  effectiveVs: EffectiveVariantSetting,
  evaledAttrs: Record<string, any>,
): React.ReactNode {
  const r = ctx.sub.React.createElement;
  if (node.tag === "select") {
    return [...node.children].map((child) => {
      assert(
        isTplTag(child),
        "Select is expected to have only TplTag children",
      );
      const childEffectiveVs = new EffectiveVariantSetting(
        child,
        getSortedActiveVariantSettings(child, ctx),
        ctx.site,
      );
      return r(
        "option",
        {
          value: evalCodeWithEnv(
            evalTagAttrExprToString(
              node,
              "value",
              childEffectiveVs.attrs.value,
              ctx,
            ),
            ctx.env,
            ctx.viewCtx.canvasCtx.win(),
          ),
        },
        ...(isRawText(childEffectiveVs.text)
          ? [childEffectiveVs.text.text]
          : []),
      );
    });
  } else if (evaledAttrs.children) {
    return evaledAttrs.children;
  } else if (node.children.length > 0) {
    const children = node.children.flatMap((child) =>
      renderTplNode(child, {
        ...ctx,
        valKey: ctx.valKey + "." + child.uuid,
      }),
    );
    if (children.length === 1) {
      return children[0];
    }
    return children;
  } else if (canAddChildren(node)) {
    const suppressPlaceholder = supressContainerPlaceholder(
      node,
      ctx,
      effectiveVs,
    );
    if (!suppressPlaceholder) {
      return r(mkEmptyContainerPlaceholder(ctx.sub), {
        summary: summarizeTpl(node, effectiveVs.rsh()),
        node: node,
        onAutoResized: () => {
          // This can be very expensive as you go in and out of spotlight
          // mode, as all the empty containers will end up calling this and
          // triggering a ton of re-rendering of the Studio UI. At a glance,
          // removing this call messes up the spotlight shading a bit
          // (when a container suddenly becomes empty, the spotlight is
          // off), but that gets fixed upon the next action. The hoverbox
          // etc all seems fine.  Anyway, may be worth turning off
          // and observing for now.
          // ctx.viewCtx.studioCtx.styleChanged.dispatch()
        },
        effectiveVs,
        ctx,
      });
    }
  }
  return null;
}

function supressContainerPlaceholder(
  node: TplTag,
  ctx: RenderingCtx,
  effectiveVs: EffectiveVariantSetting,
) {
  if (!ctx.viewCtx.studioCtx.renderPolicy.store.getState().showContainerPlaceholder) {
    return true;
  }
  if (!(ctx.ownerKey && isKeyInEditableStack(ctx, ctx.ownerKey))) {
    return true;
  }
  if (effectiveVs.rsh().get("display") === "grid") {
    return true;
  }
  return false;
}

interface EmptyContainerPlaceholderProps {
  summary: string;
  ctx: RenderingCtx;
  node: TplTag;
  onAutoResized: () => void;
  effectiveVs: EffectiveVariantSetting;
}

const mkEmptyContainerPlaceholder = canvasFactory((sub: SubDeps) =>
  sub.createCanvasComponentType<EmptyContainerPlaceholderProps>(({ node, onAutoResized, summary, ctx, effectiveVs }) => {
    return mkUseCanvasObserver(sub, ctx.viewCtx, ctx.viewCtx.canvasRenderOwner.observerInput(ctx.viewCtx, node, ctx))(() =>
      withErrorDisplayFallback(ctx, node, () => sub.React.createElement(sub.CanvasPlaceholder, {
        summary,
        resize(element) {
          if (ctx.viewCtx.isDisposed || ctx.viewCtx.disposeSignal.aborted) { return; }
          if (resizePlaceholder(element, { forceAutoHeight: isTplColumn(node) || isGridChild(node), isContainerSized: isExplicitlySized(effectiveVs) })) { onAutoResized(); }
        },
      }), { hasLoadingBoundary: ctx.env.$ctx[hasLoadingBoundaryKey] }),
    );
  }),
);

interface RichTextProps {
  ctx: RenderingCtx;
  node: TplTextTag;
  attrs: Record<string, any>;
  effectiveVs: EffectiveVariantSetting;
  tag: string | React.ElementType;
  className?: string;
}

const mkRichText = canvasFactory((sub: SubDeps) =>
  sub.createCanvasComponentType<RichTextProps, HTMLElement>(({ ctx, node, attrs, tag, effectiveVs, className, ...rest }, outerRef) => {
    const react = sub.React;
    return mkUseCanvasObserver(ctx.sub, ctx.viewCtx, ctx.viewCtx.canvasRenderOwner.observerInput(ctx.viewCtx, node, ctx))(() =>
      withErrorDisplayFallback(ctx, node, () => react.createElement(ctx.sub.CanvasRichTextFrame, {
        policy: ctx.viewCtx.studioCtx.renderPolicy.store,
        canEdit: isEditable(node, ctx),
        attributeRef: attrs.ref,
        outerRef,
        render({ isEditing, isTextEditable, ref, handle }) {
          const onChange = (text: string, markers: Marker[]) => {
            if (ctx.viewCtx.isDisposed || ctx.viewCtx.disposeSignal.aborted) { return; }
            const current = ctx.viewCtx.editingTextContext();
            if (current) { setEditingTextContext(ctx.viewCtx, { ...current, draftText: new RawTextLike(text, markers) }); }
          };
          const onUpdateContext = (partial: Partial<EditingTextContext>) => {
            if (ctx.viewCtx.isDisposed || ctx.viewCtx.disposeSignal.aborted) { return; }
            const current = ctx.viewCtx.editingTextContext();
            if (current) { setEditingTextContext(ctx.viewCtx, { ...current, ...partial }); }
          };
          return wrapCanvasErrorBoundary({ ctx, nodeOrComponent: node, children: createPlasmicElementProxy(node, ctx, tag, {
            ...attrs,
            className: cx(attrs.className, className, [
              ...(isTextEditable ? [makeWabTextClassName({ targetEnv: "canvas" }), "__wab_editor"] : []),
              isExprText(effectiveVs.text) && effectiveVs.text.html && makeWabHtmlTextClassName({ targetEnv: "canvas" }),
              isEditing && "__wab_editing",
            ]),
            [richTextProp]: { text: effectiveVs.text, handle },
            ...rest,
            ref,
            children: attrs.children ?? (isEditing
              ? renderCanvasText({ node, readOnly: false, onChange, onUpdateContext, inline: !!ctx.inline, ctx, effectiveVs })
              : renderReadOnlyCanvasText({ node, inline: !!ctx.inline, ctx, effectiveVs })),
          }) });
        },
      }), { hasLoadingBoundary: ctx.env.$ctx[hasLoadingBoundaryKey] }),
    );
  }),
);

function isEditable(node: TplNode, ctx: RenderingCtx) {
  if (!ctx.viewCtx.studioCtx.renderPolicy.store.getState().devMode) {
    return false;
  }

  if (ctx.ownerKey == null || ctx.viewCtx.valComponentStack().length === 0) {
    return true;
  }

  return ctx.ownerKey === last(ctx.viewCtx.valComponentStack())?.key;
}

function renderTplSlot(
  node: TplSlot,
  ctx: RenderingCtx,
  activeVSettings: VariantSetting[],
): React.ReactElement | null {
  const { rendered } = determineAutoOpenState(
    ctx,
    node,
    new EffectiveVariantSetting(node, activeVSettings, ctx.site),
  );

  if (!rendered) {
    return null;
  }

  const varName = toVarName(node.param.variable.name);

  let contents: React.ReactNode[] | undefined;
  if (
    ctx.forceValComponentKeysWithDefaultSlotContents?.has(ctx.ownerKey!) ||
    ctx.env.$props[varName] === undefined
  ) {
    // Render default contents if we are forced to do so, or if there's nothing
    // passed in for the corresponding arg.
    // When the default contents, clear out component specific values to avoid
    // user confusion.
    if (node.defaultContents.length > 0) {
      contents = node.defaultContents.flatMap((child) =>
        renderTplNode(child, {
          ...ctx,
          env: {
            ...ctx.env,
            $props: {},
            $q: {},
            $queries: {},
            $state: {},
          },
          valKey: ctx.valKey + "." + child.uuid,
        }),
      );
    } else {
      contents = undefined;
    }
  } else {
    contents = withoutNils(ensureArray(ctx.env.$props[varName]));
  }

  const slotClass =
    contents && contents.length > 0 && isStyledTplSlot(node)
      ? [
          makeWabSlotClassName({ targetEnv: "canvas" }),
          ...activeVSettings.map((vs) => classNameForRuleSet(vs.rs)),
        ].join(" ")
      : undefined;

  if (
    (contents == null || contents.length === 0) &&
    !supressSlotPlaceholder(node, ctx)
  ) {
    const ownerKey = ensure(
      ctx.ownerKey,
      () => `ownerKey should exist for slot placeholders`,
    );
    contents = [
      ctx.sub.React.createElement(mkCanvasSlotPlaceholder(ctx.sub), {
        ctx,
        node,
        param: node.param,
        component: ensure(
          ctx.ownerComponent,
          "Must be rendering slot belonging to some component",
        ),
        isPropOrSlot: isKeyInEditableStack(ctx, ctx.valKey) ? "slot" : "prop",
        slotSelectionKey: slotSelectionKeyFromRenderingCtx(
          ownerKey,
          node.param,
        ),
      }),
    ];
  }

  const internalAttrs = {
    [valKeyProp]: ctx.valKey,
    // We're not passing the CanvasEnv for unstyled TplSlots because `getEnvId`
    // is not stable, so it would change the fragment key every time, making the
    // slot subtree unmount and remount.
    // [dataCanvasEnvsProp]: getEnvId(ctx),
    ...(ctx.ownerKey ? { [valOwnerProp]: ctx.ownerKey } : {}),
    ...(slotClass
      ? { [dataCanvasEnvsProp]: getEnvId(ctx), [classNameProp]: slotClass }
      : {}),
  };

  if (slotClass) {
    return ctx.sub.React.createElement(
      "div",
      {
        className: slotClass,
        ...internalAttrs,
      },
      ...(contents ?? []),
    );
  } else {
    return ctx.sub.React.createElement(
      ctx.sub.React.Fragment,
      { key: `${slotFragmentKey}${JSON.stringify(internalAttrs)}` },
      ...(contents ?? []),
    );
  }
}

function supressSlotPlaceholder(node: TplSlot, ctx: RenderingCtx) {
  if (!ctx.viewCtx.studioCtx.renderPolicy.store.getState().showSlotPlaceholder) {
    return true;
  }
  if (!ctx.viewCtx.studioCtx.renderPolicy.store.getState().showContainerPlaceholder) {
    return true;
  }
  return !(
    // We should show placeholder for this TplSlot if:
    // 1. This is a TplSlot of a component we are currently editing
    (ctx.ownerKey && isKeyInEditableStack(ctx, ctx.ownerKey)) ||
    // 2. This is a SlotSelection of a component instance that belongs
    //    to the component we're currently editing
    (ctx.ownersStack.length > 1 &&
      isKeyInEditableStack(ctx, ctx.ownersStack[ctx.ownersStack.length - 2]))
  );
}

function isKeyInEditableStack(ctx: RenderingCtx, valKey: string) {
  return ctx.viewCtx.valComponentStack().some((value) => value.key === valKey);
}

interface CanvasSlotPlaceholderProps {
  ctx: RenderingCtx;
  component: Component;
  // If empty, is a SlotSelection for a code component
  node?: TplSlot;
  param: Param;
  // if `prop`, it's in a TplComponent in current context;
  // if `slot`, it's TplSlot of current editable component
  isPropOrSlot: "prop" | "slot";
  slotSelectionKey: string;
}

const mkCanvasSlotPlaceholder = canvasFactory(
  (sub: SubDeps) =>
    sub.createCanvasComponentType<CanvasSlotPlaceholderProps>(({
      ctx,
      component,
      node,
      param,
      isPropOrSlot,
      slotSelectionKey,
    }) => {
      return mkUseCanvasObserver(ctx.sub, ctx.viewCtx, ctx.viewCtx.canvasRenderOwner.observerInput(ctx.viewCtx, node ?? component, ctx))(
        () =>
          withErrorDisplayFallback(
            ctx,
            node ?? component,
            () => {
              const r = sub.React.createElement;
              return r(
                "div",
                {
                  className: "__wab_placeholder",
                  style: { display: "block" },
                  [slotPlaceholderAttr]: slotSelectionKey,
                },
                r("div", {
                  className: cx({
                    __wab_placeholder__inner: true,
                    __wab_placeholder__inner__autoWidth: true,
                    __wab_placeholder__inner__autoHeight: true,
                    "__wab_placeholder__inner__autoHeight--text":
                      node && isLikelyTextTplSlot(node),
                  }),
                }),
                r(
                  "div",
                  { className: "__wab_placeholder__tag" },
                  `${getComponentDisplayName(component)} ${
                    isPropOrSlot === "prop" ? "Slot" : "Slot Target"
                  }: ${param.variable.name}`,
                ),
                r(
                  "div",
                  {
                    className: cx({ __wab_placeholder_border: true }),
                  },
                  r("div", {
                    className: cx({ __wab_placeholder_border_inner: true }),
                  }),
                ),
              );
            },
            {
              hasLoadingBoundary: ctx.env.$ctx[hasLoadingBoundaryKey],
            },
          ),
        `mkCanvasSlotPlaceholder(${component.name}.${param.variable.name})`,
      );
    }),
);

// Should keep in sync with `makeSlotSelectionKey` and parse it in globalHook.ts
function slotSelectionKeyFromRenderingCtx(tplCompKey: string, param: Param) {
  return `${tplCompKey}~${param.uuid}`;
}

export function getCodeComponentStub(
  component: Component,
  react: typeof React,
) {
  assert(isCodeComponent(component), "Expected Code component");
  const slotNames = getSlotParams(component).map(
    (param) => param.variable.name,
  );
  return (props: object) => {
    return react.createElement(
      "div",
      omit(props, slotNames),
      ...withoutNils(slotNames.map((name) => props[name])),
    );
  };
}

function createPlasmicElementProxy(
  node: TplNode,
  ctx: RenderingCtx,
  impl: React.ElementType<any> | string,
  attrs: object,
) {
  const nodeName = ctx.nodeNamer?.(node);
  const triggeredHooks = ctx.reactHookSpecs.filter(
    (spec) => spec.triggerNode === node,
  );
  return ctx.sub.reactWeb.createPlasmicElementProxy(impl as React.ElementType, {
    ...attrs,
    ...(nodeName != null
      ? {
          "data-plasmic-name": nodeName,
          "data-plasmic-override":
            ctx.overrides[nodeName] ??
            (isKnownTplTag(node) &&
            !node.name &&
            nodeName in nodeNameBackwardsCompatibility
              ? ctx.overrides[
                  nodeNameBackwardsCompatibility[
                    nodeName as keyof typeof nodeNameBackwardsCompatibility
                  ]
                ]
              : undefined),
        }
      : {}),
    ...(node === ctx.ownerComponent?.tplTree
      ? { "data-plasmic-root": true }
      : {}),
    ...(triggeredHooks.length > 0
      ? {
          "data-plasmic-trigger-props": triggeredHooks.flatMap((spec) =>
            spec
              .getTriggerPropNames()
              .map((propName) => ctx.triggerProps[propName]),
          ),
        }
      : {}),
  }) as React.ReactElement;
}

export interface CanvasFrameInfo {
  // Using constants to avoid pulling in Arenas.ts
  viewMode: "stretch" | "centered";
  height: number;
  isHeightAutoDerived: boolean;
  /** Studio view preference to show the full content height of the page. */
  fullPageHeight: boolean;
  readonly exporting: boolean;
  bgColor: string | undefined;
  pageSizeType?: PageSizeType;
  containerType?: ContainerType;
  defaultInitialPageFrameSize?: number;
}


export function computeFullKey(ctx: RenderingCtx) {
  const parts = ctx.valKey.split(".");
  return parts
    .map((uuid) => {
      return `${uuid}[${ctx.env[getRepetitionUuidInternalName(uuid)] ?? 0}]`;
    })
    .join(".");
}

export function computeCanvasSessionKey(ctx: RenderingCtx) {
  return canvasSessionInstanceKey(computeFullKey(ctx), ctx.renderSlotInstance);
}

// We want to store the `env` for this node in the props. However, `tplSlots`
// might render React fragments, which store all the data in the fragment key.
// Since we can't stringify the envs, we need to create an ID for them.
// MobX can stop observing an environment before React finishes committing the
// fiber that still references its id. Remove the weak index only after GC (or
// frame disposal), rather than onBecomeUnobserved.
const envCleanup = new FinalizationRegistry<{
  id: string;
  frameUid: number;
  fullKey: string;
}>(({ id, frameUid, fullKey }) => {
  globalHookCtx.frames.get(frameUid)?.envIdToFullKey.delete(id);
  globalHookCtx.envIdToEnvs.delete(id);
  if (globalHookCtx.fullKeyToEnvId.get(fullKey) === id) {
    globalHookCtx.fullKeyToEnvId.delete(fullKey);
  }
});

let envIdCount = 1;
export function getEnvId(ctx: RenderingCtx) {
  const envs = { env: ctx.env, wrappingEnv: ctx.wrappingEnv };
  const id = `${envIdCount}`;
  ctx.viewCtx.canvasRenderOwner.retainEnvironment(ctx, id, envs);
  envIdCount++;
  const frameUid = ctx.viewCtx.arenaFrame().uid;
  const frame = ensure(globalHookCtx.frames.get(frameUid), "Missing canvas frame state");
  const fullKey = `${frameUid}:${computeFullKey(ctx)}`;
  frame.envIdToFullKey.set(id, fullKey);
  envCleanup.register(envs, { id, frameUid, fullKey });
  globalHookCtx.envIdToEnvs.set(id, new WeakRef(envs));
  globalHookCtx.fullKeyToEnvId.set(fullKey, id);
  return id;
}


function wrapInDataCtxReader(
  ctx: RenderingCtx,
  contents: ($ctx: DataDict | undefined, onRenderInvalidated: () => void, scope: RenderingCtx) => React.ReactNode,
  label: string,
) {
  return ctx.sub.React.createElement(
    ctx.sub.DataCtxReader as React.FunctionComponent<{
      children: ($ctx: DataDict | undefined) => React.ReactNode;
    }>,
    {
      children: ($newCtx) => {
        return mkUseCanvasObserver(ctx.sub, ctx.viewCtx, ctx.viewCtx.canvasRenderOwner.observerInput(ctx.viewCtx, ctx.ownerComponent ?? ctx.viewCtx.component, ctx))(
          (onRenderInvalidated) => renderWithStateInitializers(ctx, (scope) => contents($newCtx, onRenderInvalidated, scope)),
          label,
        );
      },
    },
  );
}


function getServerQueryFuncReg(ctx: Pick<RenderingCtx, "viewCtx">, op: CustomFunctionExpr) {
  return ctx.viewCtx.canvasCtx
    .getRegisteredFunctionsMap()
    .get(customFunctionId(op.func));
}

function serverQueryRegistrationKey(component: Component) {
  return JSON.stringify(component.serverQueries.filter(isServerQueryWithOperation)
    .flatMap((query) => isKnownCustomCode(query.op) ? [] : [customFunctionId(query.op.func)]));
}

const createServerQueryRegistrationInput = canvasFactory((view: ViewCtx, component: Component, _idsKey: string) => {
  const registry = view.canvasCtx.registrations;
  const ids = new Set(component.serverQueries.filter(isServerQueryWithOperation)
    .flatMap((query) => isKnownCustomCode(query.op) ? [] : [customFunctionId(query.op.func)]));
  const stores = [...ids].map((id) => registry.function(id));
  let current = Object.freeze(stores.map((store) => store.getState()));
  const getState = () => {
    const next = stores.map((store) => store.getState());
    if (!arrayEq(current, next)) { current = Object.freeze(next); }
    return current;
  };
  return {
    getState,
    getInitialState: getState,
    subscribe: (listener: () => void) => {
      const stops = stores.map((store) => store.subscribe(listener));
      return () => stops.forEach((stop) => stop());
    },
  };
});


function buildCanvasServerQueryTree(ctx: Pick<RenderingCtx, "viewCtx" | "projectFlags">, component: Component, staticEnv: Record<string, any>): QueryComponentNode {
  const serverQueriesByKey = component.serverQueries
    .filter(isServerQueryWithOperation)
    .map((query) => {
      const varName = toVarName(query.name);
      const uuidName = `${query.uuid}:${varName}`;
      if (isKnownCustomCode(query.op)) {
        return {
          query,
          varName,
          funcReg: undefined,
          key: `custom:${uuidName}:${query.op.code}`,
        };
      }
      // The tree below drops queries with unregistered functions, so key on
      // registration as well, to rebuild the tree once one lands. No other
      // dep changes when the registry refreshes.
      const funcReg = getServerQueryFuncReg(ctx, query.op);
      const funcId = customFunctionId(query.op.func);
      return {
        query,
        varName,
        funcReg,
        key: `func:${uuidName}:${funcId}${funcReg ? "" : ":?"}`,
      };
    });

 return {
      type: "component",
      queries: Object.fromEntries(
        serverQueriesByKey
          .map(({ query, varName, funcReg }) => {
            // Route through shared studio cache so a non-deterministic/stateful functions
            // execute once per cache key (canvas + preview + modal agree).
            const wrapFetch = ctx.viewCtx.studioCtx.executeServerQuery;
            if (isKnownCustomCode(query.op)) {
              return [
                varName,
                wrapPlasmicQueryFetch(
                  buildCustomCodePlasmicQuery(
                    // Match QueryResultPreview/modal custom-code id.
                    makeCustomCodeQueryKey(query.uuid),
                    query.op.code,
                    () => staticEnv,
                  ),
                  wrapFetch,
                ),
              ] as const;
            }
            if (!funcReg) {
              return null;
            }
            const op = query.op;
            const funcId = customFunctionId(op.func);
            return [
              varName,
              {
                id: funcId,
                fn: ((...fnArgs: any[]) =>
                  wrapFetch(
                    funcId,
                    funcReg.function as any,
                    ...fnArgs,
                  )) as typeof funcReg.function,
                args: ({
                  $q,
                  $props,
                  $ctx,
                  $state,
                }: {
                  $q: Record<string, PlasmicQueryResult>;
                  $props: Record<string, unknown>;
                  $ctx: Record<string, unknown>;
                  $state: Record<string, unknown>;
                }) => {
                  return getCustomFunctionParams(
                    op,
                    { ...staticEnv, $q, $props, $ctx, $state },
                    {
                      component,
                      projectFlags: ctx.projectFlags,
                      inStudio: true,
                    },
                    ctx.viewCtx.canvasCtx.win(),
                  );
                },
              },
            ] as const;
          })
          .filter(notNil),
      ),
      stateSpecs: [],
      propsContext: {},
      children: [],
    };
}




const createCanvasServerQueryTree = canvasFactory(
  (view: ViewCtx, component: Component, _key: string, _registrations: unknown, staticEnv: Record<string, any>, projectFlags: DevFlagsType) =>
    buildCanvasServerQueryTree({ viewCtx: view, projectFlags }, component, staticEnv),
  (view, component, key, registrations, staticEnv, projectFlags) => [view, component, key, registrations, projectFlags, ...Object.entries(staticEnv).flat()],
);


const createCanvasQueryController = canvasFactory((view: ViewCtx, component: Component, idsKey: string) => {
  const controller: CanvasQueryController<RenderingCtx, ReturnType<ReturnType<typeof createServerQueryRegistrationInput>["getState"]>> = {
    registrations: createServerQueryRegistrationInput(view, component, idsKey),
    plan(ctx, registrations): CanvasQueryPlan {
      const staticEnv = Object.fromEntries(Object.entries(ctx.env).filter(([name]) => !["$ctx", "$props", "$state", "$q"].includes(name)));
      const key = JSON.stringify(component.serverQueries.filter(isServerQueryWithOperation).map((query) => [query.uuid, query.name, getRawCode(query.op, { component, projectFlags: ctx.projectFlags, inStudio: true })]));
      const server = createCanvasServerQueryTree(view, component, key, registrations, staticEnv, ctx.projectFlags);
      const legacy = component.dataQueries.filter((query) => !!query.op).map((query) => {
        const expression = asCode(removeFallbackFromDataSourceOp(ensure(query.op, "A data query operation is required")), { component, projectFlags: ctx.projectFlags, inStudio: true }).code;
        return { key: query.uuid, name: toVarName(query.name), evaluate: (env: Parameters<CanvasQueryPlan["legacy"][number]["evaluate"]>[0]) => evalCodeWithEnv(expression, env, view.canvasCtx.win()) };
      });
      return { server, legacy };
    },
    environment: (ctx) => ctx.env,
    refCommands: (ctx) => ctx.getRefs,
    specs: (ctx) => ctx.stateSpecs,
    withQueries(ctx, state, $q, $queries) {
      return { ...ctx, env: { ...ctx.env, $state: state, $q, $queries }, wrappingEnv: { ...ctx.wrappingEnv, $state: state, $q, $queries }, $stateSnapshot: state };
    },
    publish(ctx, server, legacy) {
      if (view.isDisposed || view.disposeSignal.aborted) { return; }
      const equal = (left: Record<string, unknown>, right: Record<string, unknown>) => Object.keys(left).length === Object.keys(right).length && Object.keys(left).every((key) => left[key] === right[key]);
      if (!equal(ctx.env.$q, server)) { ctx.setDollarQ(server); }
      if (!equal(ctx.env.$queries, legacy)) { ctx.setDollarQueries(legacy); }
    },
    renderInput(ctx) {
      const variants = component.variantGroups.flatMap((group) => group.variants.filter((variant) => ctx.sub.reactWeb.hasVariant(ctx.env.$state, toVarName(group.param.variable.name), toVarName(variant.name))));
      const activeVariants = new Set<Variant>([...ctx.activeVariants].filter(isStyleOrCodeComponentVariant));
      for (const variant of ctx.pinnedVariants ?? []) { activeVariants.add(variant); }
      for (const variant of variants) { activeVariants.add(variant); }
      return new CanvasObservedRenderSource(view, (onRenderInvalidated) => renderWithStateInitializers({ ...ctx, activeVariants, onRenderInvalidated }, (scope) => renderTplNode(component.tplTree, scope)));
    },
  };
  return controller;
});

function wrapInComponentDataQueries(ctx: RenderingCtx, component: Component) {
  const controller = createCanvasQueryController(ctx.viewCtx, component, serverQueryRegistrationKey(component));
  return ctx.sub.React.createElement(ctx.sub.CanvasQueriesRuntime<RenderingCtx, ReturnType<typeof controller.registrations.getState>>, { controller, context: ctx });
}

export const _testOnlyUtils = {
  mkRichText,
  computeCanvasSessionKey,
  mkInitFunc,
  mkInitFuncHash,
  computeActiveVariantsForMaybeDisabledTag,
  computeTplComponentArgs,
  determineAutoOpenState,
  createCanvasQueryController,
  buildCanvasServerQueryTree,
  createServerQueryRegistrationInput,
  serverQueryRegistrationKey,
};
