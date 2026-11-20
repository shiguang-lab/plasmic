import { InspectorReadOnly, InspectorInput, InspectorEdit } from "@/wab/client/components/studio/inspector-access";
import { maybeShowContextMenu } from "@/wab/client/components/ContextMenu";
import styles from "@/wab/client/components/style-controls/BoxGeometryCard.module.scss";
import {
  ExpsProvider,
  TplExpsProvider,
  changeStyle,
  createStyleContextMenu,
} from "@/wab/client/components/style-controls/StyleComponent";
import { AppContext } from "@/wab/client/components/top-view";
import { isTplCodeComponentStyleable } from "@/wab/client/code-components/code-components";
import { useI18n } from "@/wab/client/i18n";
import type { MessageKey } from "@/wab/client/i18n/locales";
import { useInspectorDom } from "@/wab/client/studio-ctx/inspector-state";
import { useStyleCells, useStyleIndicators } from "@/wab/client/studio-ctx/style-inputs-react";
import { useStyleTokenRefs } from "@/wab/client/studio-ctx/style-token-ref-inputs";
import { useVariantedStylesHelperFromCurrentCtx } from "@/wab/client/studio-ctx/varianted-style-context";
import { derefTokenRefs, isTokenRef } from "@/wab/commons/StyleToken";
import { PublicStyleSection } from "@/wab/shared/ApiSchema";
import { getSlotSelectionContainingTpl } from "@/wab/shared/SlotUtils";
import { VariantedStylesHelper } from "@/wab/shared/VariantedStylesHelper";
import { isPageComponent } from "@/wab/shared/core/components";
import {
  isPaddingValidForTpl,
  isSizeValidForTpl,
} from "@/wab/shared/core/style-props-tpl";
import {
  isComponentRoot,
  isTplCodeComponent,
  isTplColumn,
  isTplComponent,
  isTplSlot,
  isTplTag,
  resolvesToCodeComponent,
} from "@/wab/shared/core/tpls";
import {
  createNumericSize,
  isDraggableSize,
  showSizeCss,
  tryParseNumericSize,
} from "@/wab/shared/css-size";
import { deriveSizeStyleValue } from "@/wab/shared/sizingutils";
import { Corner, Side, oppSide, standardCorners, standardSides } from "@/wab/shared/geom";
import { canEditStyleSection, UiConfig } from "@/wab/shared/ui-config-utils";
import { Tooltip } from "antd";
import cn from "classnames";
import { getTargetBlockingCombo } from "@/wab/shared/defined-indicator";
import { isSelectableLocked } from "@/wab/shared/core/selection";
import * as React from "react";
import { useShallow } from "zustand/react/shallow";

export interface BoxDimensionCapability {
  editable: boolean;
  reason?: MessageKey;
}

export interface BoxGeometryCapabilities {
  /** False when the target exposes no observable box styles and should be omitted. */
  visible: boolean;
  margin: BoxDimensionCapability;
  padding: BoxDimensionCapability;
  radius: BoxDimensionCapability;
  size: {
    readable: boolean;
    editable: boolean;
    widthOnly?: boolean;
    reason?: MessageKey;
  };
  readOnly: boolean;
  readOnlyReason?: MessageKey;
  /** True when styles cannot be attached via Plasmic CSS and should be read from computed DOM styles. */
  readFromComputedStyle?: boolean;
}

export interface BoxGeometryMultiValue {
  value: string;
  mixed: boolean;
  blocked?: boolean;
  set?: boolean;
}

export interface BoxGeometryMultiTarget {
  capabilities: BoxGeometryCapabilities;
  values: Record<string, BoxGeometryMultiValue>;
  measuredSize?: { w: number; h: number };
  onCommitProps: (entries: ReadonlyArray<readonly [string, string]>) => void;
}

export interface ResolveBoxGeometryCapabilitiesParams {
  expsProvider: ExpsProvider;
  missingPositionClass?: boolean;
  contentEditorMode?: boolean;
  uiConfig?: UiConfig;
  enabledStyleSections?: readonly (PublicStyleSection | string)[] | boolean;
  readOnly?: boolean;
  locked?: boolean;
  ignoreSelectionEditCheck?: boolean;
  hasDomElement?: boolean;
}

function isSectionIncluded(
  enabledStyleSections:
    | readonly (PublicStyleSection | string)[]
    | boolean
    | undefined,
  section: PublicStyleSection,
  allowCodeComponentSpacing: boolean,
): boolean {
  if (enabledStyleSections === false) {
    return false;
  }
  if (Array.isArray(enabledStyleSections)) {
    if (
      allowCodeComponentSpacing &&
      (section === PublicStyleSection.Spacing ||
        section === PublicStyleSection.Positioning)
    ) {
      return true;
    }
    return (
      enabledStyleSections as readonly (PublicStyleSection | string)[]
    ).includes(section);
  }
  return true;
}

function resolveNestedCodeComponentMeta(
  viewCtx: TplExpsProvider["viewCtx"],
  tpl: TplExpsProvider["tpl"],
): ReturnType<TplExpsProvider["viewCtx"]["getTplCodeComponentMeta"]> {
  if (isTplCodeComponent(tpl)) {
    return viewCtx.getTplCodeComponentMeta(tpl);
  }
  if (isTplComponent(tpl)) {
    const root = tpl.component.tplTree;
    if (isTplTag(root) || isTplComponent(root)) {
      return resolveNestedCodeComponentMeta(viewCtx, root);
    }
  }
  return undefined;
}

export function resolveBoxGeometryCapabilities({
  expsProvider,
  missingPositionClass = false,
  contentEditorMode = false,
  uiConfig,
  enabledStyleSections,
  readOnly = false,
  locked,
  ignoreSelectionEditCheck = false,
  hasDomElement,
}: ResolveBoxGeometryCapabilitiesParams): BoxGeometryCapabilities {
  const hidden: BoxGeometryCapabilities = {
    visible: false,
    margin: { editable: false },
    padding: { editable: false },
    radius: { editable: false },
    size: { readable: false, editable: false },
    readOnly: true,
  };

  const studioCanEdit =
    (expsProvider.studioCtx.canEditProject?.() ?? true) &&
    (expsProvider.studioCtx.canEditBranch?.() ?? true);

  if (!(expsProvider instanceof TplExpsProvider)) {
    if (enabledStyleSections === false) {
      return hidden;
    }
    const spacingAllowed = isSectionIncluded(
      enabledStyleSections,
      PublicStyleSection.Spacing,
      false,
    );
    const borderAllowed = isSectionIncluded(
      enabledStyleSections,
      PublicStyleSection.Border,
      false,
    );
    const sizingAllowed = isSectionIncluded(
      enabledStyleSections,
      PublicStyleSection.Sizing,
      false,
    );
    if (!spacingAllowed && !borderAllowed && !sizingAllowed) {
      return hidden;
    }
    const effectiveEditable = !readOnly && studioCanEdit;
    const lockReason: MessageKey | undefined = effectiveEditable
      ? undefined
      : "Read-only mode";
    const marginEditable = effectiveEditable && spacingAllowed;
    const paddingEditable = effectiveEditable && spacingAllowed;
    const radiusEditable = effectiveEditable && borderAllowed;
    const sizeEditable = effectiveEditable && sizingAllowed;
    const allReadOnly = !marginEditable && !paddingEditable && !radiusEditable;

    return {
      visible: true,
      margin: {
        editable: marginEditable,
        reason: marginEditable
          ? undefined
          : lockReason ?? "Spacing editing is disabled",
      },
      padding: {
        editable: paddingEditable,
        reason: paddingEditable
          ? undefined
          : lockReason ?? "Spacing editing is disabled",
      },
      radius: {
        editable: radiusEditable,
        reason: radiusEditable
          ? undefined
          : lockReason ?? "Corner radius editing is disabled",
      },
      size: {
        readable: true,
        editable: sizeEditable,
        reason: sizeEditable ? undefined : lockReason ?? "Size is read-only",
      },
      readOnly: allReadOnly,
      readOnlyReason: lockReason ?? (allReadOnly ? "Box properties are read-only for this element" : undefined),
    };
  }

  const tpl = expsProvider.tpl;
  const viewCtx = expsProvider.viewCtx;
  const ccRegistry = viewCtx.studioCtx.codeComponentsRegistry;

  if (isTplSlot(tpl) || (!isTplTag(tpl) && !isTplComponent(tpl))) {
    return hidden;
  }

  const resolvesCC = resolvesToCodeComponent(tpl);
  const ccMeta = resolveNestedCodeComponentMeta(viewCtx, tpl);
  const effectiveStyleSections =
    enabledStyleSections ?? ccMeta?.styleSections;

  const activeUiConfig = uiConfig ?? viewCtx.studioCtx.getCurrentUiConfig();
  const canEditSectionByConfig = (section: PublicStyleSection) =>
    canEditStyleSection(activeUiConfig, section, {
      isContentCreator: contentEditorMode,
      defaultContentEditorVisible: false,
    });

  const spacingAllowedByConfig = canEditSectionByConfig(PublicStyleSection.Spacing);
  const sizingAllowedByConfig = canEditSectionByConfig(PublicStyleSection.Sizing);
  const borderAllowedByConfig = canEditSectionByConfig(PublicStyleSection.Border);
  const sizeReadable =
    sizingAllowedByConfig ||
    spacingAllowedByConfig ||
    borderAllowedByConfig;

  const styleEditingBlockedByComponent =
    effectiveStyleSections === false ||
    (isTplCodeComponent(tpl) &&
      !isTplCodeComponentStyleable(ccRegistry, tpl)) ||
    (resolvesCC &&
      missingPositionClass &&
      ccMeta?.styleSections !== true);

  if (styleEditingBlockedByComponent) {
    if (!sizeReadable) {
      return hidden;
    }
    const domAvailable =
      hasDomElement ?? isRealBoxDomElement(expsProvider.forDom());
    if (!domAvailable) {
      return hidden;
    }
    return {
      visible: true,
      margin: {
        editable: false,
        reason: "Box properties are read-only for this element",
      },
      padding: {
        editable: false,
        reason: "Box properties are read-only for this element",
      },
      radius: {
        editable: false,
        reason: "Box properties are read-only for this element",
      },
      size: {
        readable: true,
        editable: false,
        reason: "Size is read-only",
      },
      readOnly: true,
      readOnlyReason: "Box properties are read-only for this element",
      readFromComputedStyle: true,
    };
  }

  const sectionEnabledForCodeComponent = (section: PublicStyleSection) =>
    isSectionIncluded(effectiveStyleSections, section, true);

  const focusedSelectable = viewCtx.focusedSelectable?.();
  const inferredLocked =
    focusedSelectable &&
    "tpl" in focusedSelectable &&
    focusedSelectable.tpl === tpl &&
    viewCtx.valState
      ? isSelectableLocked(focusedSelectable, viewCtx.valState())
      : false;
  const isLocked = locked ?? inferredLocked;
  const selectionEditable = ignoreSelectionEditCheck
    ? !viewCtx.isDisposed
    : expsProvider.canEdit();
  const canEdit =
    !readOnly && !isLocked && studioCanEdit && selectionEditable;
  const nonEditableReason: MessageKey = isLocked
    ? "Element is locked"
    : "Read-only mode";
  const slot = getSlotSelectionContainingTpl(tpl);
  const slotProp =
    slot &&
    isTplCodeComponent(slot.getTpl()) &&
    ccRegistry
      .getRegisteredCodeComponentsMap()
      .get(slot.getTpl().component.name)?.meta.props[slot.slotParam.variable.name];
  const slotFixedRoot =
    !!slotProp &&
    typeof slotProp === "object" &&
    slotProp.type === "slot" &&
    !!slotProp.fixedRoot;

  const margin = ((): BoxDimensionCapability => {
    if (!canEdit) {
      return { editable: false, reason: nonEditableReason };
    }
    if (slotFixedRoot) {
      return { editable: false, reason: "Fixed slot root does not allow style edits" };
    }
    if (isComponentRoot(tpl)) {
      return { editable: false, reason: "Component root does not support margin" };
    }
    if (isTplColumn(tpl)) {
      return { editable: false, reason: "Columns do not support margin" };
    }
    if (!spacingAllowedByConfig) {
      return { editable: false, reason: "Spacing editing is disabled" };
    }
    return { editable: true };
  })();

  const padding = ((): BoxDimensionCapability => {
    if (!canEdit) {
      return { editable: false, reason: nonEditableReason };
    }
    if (slotFixedRoot) {
      return { editable: false, reason: "Fixed slot root does not allow style edits" };
    }
    if (!isPaddingValidForTpl(tpl, ccRegistry)) {
      if (isTplTag(tpl)) {
        return { editable: false, reason: "This element does not support padding" };
      }
      return { editable: false, reason: "This component does not support padding" };
    }
    if (!spacingAllowedByConfig) {
      return { editable: false, reason: "Spacing editing is disabled" };
    }
    return { editable: true };
  })();

  const radius = ((): BoxDimensionCapability => {
    if (!canEdit) {
      return { editable: false, reason: nonEditableReason };
    }
    if (slotFixedRoot) {
      return { editable: false, reason: "Fixed slot root does not allow style edits" };
    }
    if (!isTplTag(tpl) && !isTplCodeComponent(tpl)) {
      return { editable: false, reason: "This component does not support corner radius" };
    }
    if (!sectionEnabledForCodeComponent(PublicStyleSection.Border) || !borderAllowedByConfig) {
      return { editable: false, reason: "Corner radius editing is disabled" };
    }
    return { editable: true };
  })();

  const component = viewCtx.currentComponent();
  const isPageRoot = isComponentRoot(tpl) && isPageComponent(component);
  const sizeEditable =
    canEdit &&
    !slotFixedRoot &&
    !isPageRoot &&
    isSizeValidForTpl(tpl) &&
    sizingAllowedByConfig &&
    sectionEnabledForCodeComponent(PublicStyleSection.Sizing);

  if (
    !sizeReadable &&
    !margin.editable &&
    !padding.editable &&
    !radius.editable
  ) {
    return hidden;
  }

  const allReadOnly =
    readOnly ||
    !canEdit ||
    slotFixedRoot ||
    (!margin.editable && !padding.editable && !radius.editable);

  return {
    visible: true,
    margin,
    padding,
    radius,
    size: {
      readable: true,
      editable: sizeEditable,
      reason: sizeEditable ? undefined : "Size is read-only",
    },
    readOnly: allReadOnly,
    readOnlyReason: !canEdit
      ? nonEditableReason
      : slotFixedRoot
        ? "Fixed slot root does not allow style edits"
        : allReadOnly
          ? "Box properties are read-only for this element"
          : undefined,
  };
}

type EdgeProp = "margin" | "padding";

interface EdgeId {
  prop: EdgeProp;
  side: Side;
}

export const MARGIN_KEYS = standardSides.map((s) => `margin-${s}`);
export const PADDING_KEYS = standardSides.map((s) => `padding-${s}`);
export const RADIUS_KEYS = standardCorners.map((c) => `border-${c}-radius`);
export const SIZE_KEYS = ["width", "height"];
export const BOX_STYLE_KEYS = [...MARGIN_KEYS, ...PADDING_KEYS, ...RADIUS_KEYS, ...SIZE_KEYS];
const EMPTY_KEYS: readonly string[] = [];

function isDomElement(dom: unknown): dom is Element {
  return (
    !!dom &&
    typeof dom === "object" &&
    (dom as { nodeType?: unknown }).nodeType === 1 &&
    typeof (dom as { getBoundingClientRect?: unknown }).getBoundingClientRect === "function"
  );
}

function extractDomElement(dom: unknown): Element | undefined {
  if (!dom) {
    return undefined;
  }
  if (isDomElement(dom)) {
    return dom;
  }
  if (Array.isArray(dom) || (typeof dom === "object" && "0" in (dom as Record<string, unknown>))) {
    const first = (dom as ArrayLike<unknown>)[0];
    return isDomElement(first) ? first : undefined;
  }
  return undefined;
}

/**
 * Returns true when the resolved canvas DOM points to an actual standalone element
 * rather than a renderless virtual node or a projected part wrapper (e.g. Table.Column).
 */
export function isRealBoxDomElement(dom: unknown): boolean {
  const elt = extractDomElement(dom);
  if (!elt) {
    return false;
  }
  if (
    typeof elt.hasAttribute === "function" &&
    elt.hasAttribute("data-plasmic-canvas-part")
  ) {
    return false;
  }
  return true;
}

function normalizeComputedPx(raw: string | undefined): string {
  if (!raw) {
    return "0px";
  }
  const parsed = Number.parseFloat(raw);
  if (!Number.isFinite(parsed)) {
    return "0px";
  }
  const rounded = Math.round(parsed * 10) / 10;
  return `${rounded}px`;
}

function readComputedBoxValues(elt: Element): Record<string, string> | undefined {
  try {
    const view = elt.ownerDocument?.defaultView ?? window;
    const cs = view?.getComputedStyle?.(elt);
    if (!cs) {
      return undefined;
    }
    return {
      "margin-top": normalizeComputedPx(cs.marginTop),
      "margin-right": normalizeComputedPx(cs.marginRight),
      "margin-bottom": normalizeComputedPx(cs.marginBottom),
      "margin-left": normalizeComputedPx(cs.marginLeft),
      "padding-top": normalizeComputedPx(cs.paddingTop),
      "padding-right": normalizeComputedPx(cs.paddingRight),
      "padding-bottom": normalizeComputedPx(cs.paddingBottom),
      "padding-left": normalizeComputedPx(cs.paddingLeft),
      "border-top-left-radius": normalizeComputedPx(cs.borderTopLeftRadius),
      "border-top-right-radius": normalizeComputedPx(cs.borderTopRightRadius),
      "border-bottom-right-radius": normalizeComputedPx(cs.borderBottomRightRadius),
      "border-bottom-left-radius": normalizeComputedPx(cs.borderBottomLeftRadius),
    };
  } catch {
    return undefined;
  }
}

function shallowRecordEquals(
  a: Record<string, string> | undefined,
  b: Record<string, string> | undefined,
): boolean {
  if (a === b) {
    return true;
  }
  if (!a || !b) {
    return false;
  }
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) {
    return false;
  }
  return keysA.every((key) => a[key] === b[key]);
}

function formatCompactDim(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return "0";
  }
  if (trimmed.endsWith("px")) {
    const n = trimmed.slice(0, -2);
    if (/^-?\d+(\.\d+)?$/.test(n)) {
      return n;
    }
  }
  return trimmed;
}

function normalizeFallbackCssSize(
  prop: "width" | "height",
  rawValue: string | undefined,
): string {
  const trimmed = rawValue?.trim();
  if (!trimmed || trimmed === "default") {
    return "auto";
  }
  return deriveSizeStyleValue(prop, trimmed) || "auto";
}

function parsePixelNumber(value: string): number {
  const parsed = tryParseNumericSize(value);
  if (parsed && (parsed.unit === "px" || parsed.unit === "")) {
    return parsed.num;
  }
  return 0;
}

function normalizeBoxInput(
  rawInput: string,
  allowAuto: boolean,
  minValue: number | undefined,
): string | undefined {
  const trimmed = rawInput.trim();
  if (!trimmed) {
    return "0px";
  }
  if (allowAuto && trimmed.toLowerCase() === "auto") {
    return "auto";
  }
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
    const num = Number(trimmed);
    const clamped = minValue !== undefined ? Math.max(minValue, num) : num;
    return showSizeCss(createNumericSize(clamped, "px"));
  }
  const parsed = tryParseNumericSize(trimmed);
  if (parsed) {
    const clamped = minValue !== undefined ? Math.max(minValue, parsed.num) : parsed.num;
    return showSizeCss(createNumericSize(clamped, parsed.unit || "px"));
  }
  return undefined;
}

export interface BoxGeometryCardProps {
  expsProvider: ExpsProvider;
  capabilities?: BoxGeometryCapabilities;
  vsh?: VariantedStylesHelper;
  readOnly?: boolean;
  multiTarget?: BoxGeometryMultiTarget;
}

export const BoxGeometryCard = React.memo(function BoxGeometryCard(
  props: BoxGeometryCardProps,
) {
  const inspecting = React.useContext(InspectorReadOnly);
  const { t: uiT } = useI18n();
  const { expsProvider, vsh: providedVsh, readOnly = false, multiTarget } = props;
  const studioCtx = expsProvider.studioCtx;
  const app = React.useContext(AppContext) ?? studioCtx.app;
  const currentVsh = useVariantedStylesHelperFromCurrentCtx(
    providedVsh ? undefined : studioCtx,
  );
  const vsh = providedVsh ?? currentVsh;

  const [linked, setLinked] = React.useState(true);
  const [hoveredEdge, setHoveredEdge] = React.useState<EdgeId | null>(null);
  const [editingEdge, setEditingEdge] = React.useState<EdgeId | null>(null);
  const [editingText, setEditingText] = React.useState("");
  const [editingRadius, setEditingRadius] = React.useState(false);
  const [radiusText, setRadiusText] = React.useState("");
  const [measuredSize, setMeasuredSize] = React.useState<{ w: number; h: number } | undefined>(undefined);
  const [computedBoxValues, setComputedBoxValues] = React.useState<Record<string, string> | undefined>(undefined);
  const cardRef = React.useRef<HTMLDivElement>(null);

  const inspectorDom = useInspectorDom(
    !multiTarget && expsProvider instanceof TplExpsProvider
      ? expsProvider.viewCtx
      : undefined,
  );
  const resolvedDom = inspectorDom ?? expsProvider.forDom();
  const hasDomElement = isRealBoxDomElement(resolvedDom);

  const resolvedCapabilities = React.useMemo<BoxGeometryCapabilities>(
    () =>
      multiTarget?.capabilities ??
      props.capabilities ??
      resolveBoxGeometryCapabilities({ expsProvider, readOnly, hasDomElement }),
    [multiTarget, props.capabilities, expsProvider, readOnly, hasDomElement],
  );
  const readFromComputedStyle =
    !multiTarget && !!resolvedCapabilities.readFromComputedStyle;

  const lifetime = React.useMemo(
    () => studioCtx.arenaState.lifetime(),
    [studioCtx],
  );
  const subscribeLifetime = React.useCallback(
    (notify: () => void) => {
      lifetime.addEventListener("abort", notify);
      return () => lifetime.removeEventListener("abort", notify);
    },
    [lifetime],
  );
  const readAlive = React.useCallback(() => !lifetime.aborted, [lifetime]);
  const alive = React.useSyncExternalStore(subscribeLifetime, readAlive, readAlive);

  const cells = useStyleCells(expsProvider, alive ? BOX_STYLE_KEYS : EMPTY_KEYS);
  const indicators = useStyleIndicators(expsProvider, alive ? BOX_STYLE_KEYS : EMPTY_KEYS);

  const cellValueMap = React.useMemo(() => {
    const map = new Map<string, string>();
    if (multiTarget) {
      for (const key of BOX_STYLE_KEYS) {
        const entry = multiTarget.values[key];
        map.set(key, entry && !entry.mixed ? entry.value : "0px");
      }
      return map;
    }
    if (readFromComputedStyle && computedBoxValues) {
      for (const key of BOX_STYLE_KEYS) {
        map.set(key, computedBoxValues[key] ?? "0px");
      }
      return map;
    }
    cells.forEach((c) => map.set(c.key, c.value));
    return map;
  }, [cells, multiTarget, readFromComputedStyle, computedBoxValues]);

  const indicatorMap = React.useMemo(() => {
    const map = new Map<string, boolean>();
    if (readFromComputedStyle) {
      return map;
    }
    if (multiTarget) {
      for (const key of BOX_STYLE_KEYS) {
        map.set(key, !!multiTarget.values[key]?.set);
      }
      return map;
    }
    cells.forEach((c, idx) => {
      const ind = indicators[idx];
      map.set(c.key, ind?.source === "set");
    });
    return map;
  }, [cells, indicators, multiTarget, readFromComputedStyle]);

  const blockedByKey = React.useMemo(() => {
    const map = new Map<string, boolean>();
    if (readFromComputedStyle) {
      return map;
    }
    if (multiTarget) {
      for (const key of BOX_STYLE_KEYS) {
        map.set(key, !!multiTarget.values[key]?.blocked);
      }
      return map;
    }
    cells.forEach((c, idx) => {
      const ind = indicators[idx];
      map.set(c.key, !!(ind && getTargetBlockingCombo([ind])));
    });
    return map;
  }, [cells, indicators, multiTarget, readFromComputedStyle]);

  const rawSpacingValues = React.useMemo(
    () => [...MARGIN_KEYS, ...PADDING_KEYS].map((k) => cellValueMap.get(k) ?? "0px"),
    [cellValueMap],
  );
  const rawRadiusValues = React.useMemo(
    () => RADIUS_KEYS.map((k) => cellValueMap.get(k) ?? "0px"),
    [cellValueMap],
  );

  const resolvedSpacing = useStyleTokenRefs(
    studioCtx,
    rawSpacingValues,
    vsh,
    "SpacingOnly",
    useShallow((state) =>
      state.rows.map((row) => row.resolved?.value ?? derefTokenRefs([], row.input)),
    ),
  );
  const resolvedRadii = useStyleTokenRefs(
    studioCtx,
    rawRadiusValues,
    vsh,
    "SpacingOnly",
    useShallow((state) =>
      state.rows.map((row) => row.resolved?.value ?? derefTokenRefs([], row.input)),
    ),
  );

  React.useEffect(() => {
    if (!alive || multiTarget) {
      return;
    }
    const elt = extractDomElement(resolvedDom);
    if (!elt) {
      setMeasuredSize((prev) => (prev === undefined ? prev : undefined));
      setComputedBoxValues((prev) => (prev === undefined ? prev : undefined));
      return;
    }
    const measure = () => {
      const htmlElt = elt as Partial<HTMLElement>;
      const rect = elt.getBoundingClientRect();
      const rawW =
        typeof htmlElt.offsetWidth === "number" && htmlElt.offsetWidth > 0
          ? htmlElt.offsetWidth
          : rect.width;
      const rawH =
        typeof htmlElt.offsetHeight === "number" && htmlElt.offsetHeight > 0
          ? htmlElt.offsetHeight
          : rect.height;
      const w = Math.round(rawW);
      const h = Math.round(rawH);
      if (w > 0 || h > 0) {
        setMeasuredSize((prev) =>
          prev && prev.w === w && prev.h === h ? prev : { w, h },
        );
      } else {
        setMeasuredSize((prev) => (prev === undefined ? prev : undefined));
      }
      if (readFromComputedStyle) {
        const nextComputed = readComputedBoxValues(elt);
        setComputedBoxValues((prev) =>
          shallowRecordEquals(prev, nextComputed) ? prev : nextComputed,
        );
      } else {
        setComputedBoxValues((prev) => (prev === undefined ? prev : undefined));
      }
    };
    measure();
    const ro =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(measure)
        : undefined;
    ro?.observe(elt);
    elt.addEventListener("transitionend", measure);
    return () => {
      ro?.disconnect();
      elt.removeEventListener("transitionend", measure);
    };
  }, [alive, resolvedDom, cells, multiTarget, readFromComputedStyle]);

  const handleJumpToSize = React.useCallback(() => {
    const scope =
      cardRef.current?.closest(
        ".style-tab, .ant-modal-body, [data-overlayscrollbars-viewport], .studio-scrollbar",
      ) ?? document;
    const sizeTarget =
      scope.querySelector<HTMLElement>(
        '[data-testid="layout-section"], [data-test-id="size-section"], [data-test-id="size-width-section"]',
      ) ??
      document.querySelector<HTMLElement>(
        '[data-testid="layout-section"], [data-test-id="size-section"], [data-test-id="size-width-section"]',
      );
    if (!sizeTarget) {
      return;
    }
    sizeTarget.scrollIntoView?.({ behavior: "smooth", block: "center" });
    sizeTarget.animate?.(
      [
        { outline: "2px solid rgba(13, 153, 255, 0.9)", outlineOffset: "-2px" },
        { outline: "2px solid rgba(13, 153, 255, 0)", outlineOffset: "-2px" },
      ],
      { duration: 900, easing: "ease-out" },
    );
  }, []);

  if (!alive || !resolvedCapabilities.visible || cells.length < BOX_STYLE_KEYS.length) {
    return null;
  }

  const marginBlocked =
    resolvedCapabilities.margin.editable &&
    MARGIN_KEYS.every((k) => blockedByKey.get(k));
  const paddingBlocked =
    resolvedCapabilities.padding.editable &&
    PADDING_KEYS.every((k) => blockedByKey.get(k));
  const anyRadiusBlocked =
    resolvedCapabilities.radius.editable &&
    RADIUS_KEYS.some((k) => blockedByKey.get(k));

  const marginDimEditable = resolvedCapabilities.margin.editable && !marginBlocked;
  const paddingDimEditable = resolvedCapabilities.padding.editable && !paddingBlocked;
  const radiusDimEditable = resolvedCapabilities.radius.editable && !anyRadiusBlocked;

  const allBlockedByVariant =
    !resolvedCapabilities.readOnly &&
    (resolvedCapabilities.margin.editable ||
      resolvedCapabilities.padding.editable ||
      resolvedCapabilities.radius.editable) &&
    !marginDimEditable &&
    !paddingDimEditable &&
    !radiusDimEditable;

  const allReadOnly =
    readOnly ||
    resolvedCapabilities.readOnly ||
    (!marginDimEditable && !paddingDimEditable && !radiusDimEditable);

  const canEditEdge = (prop: EdgeProp, side: Side) => {
    if (allReadOnly) {
      return false;
    }
    const dimEditable =
      prop === "margin" ? marginDimEditable : paddingDimEditable;
    return dimEditable && !blockedByKey.get(`${prop}-${side}`);
  };

  const getEdgeResolved = (prop: EdgeProp, side: Side) => {
    const idx =
      (prop === "margin" ? 0 : 4) + standardSides.indexOf(side);
    const resolvedVal = resolvedSpacing.selected[idx];
    const key = `${prop}-${side}`;
    const multiEntry = multiTarget?.values[key];
    const isMixed = !!multiEntry?.mixed;
    const raw = isMixed ? "" : (cellValueMap.get(key) ?? "0px");
    return {
      key,
      raw,
      resolved: isMixed ? "" : (resolvedVal ?? raw),
      isMixed,
      isBlocked: !!blockedByKey.get(key),
      isToken: !isMixed && isTokenRef(raw),
      isSet: !!indicatorMap.get(key),
    };
  };

  const commitProps = (entries: ReadonlyArray<readonly [string, string]>) => {
    if (entries.length === 0) {
      return;
    }
    if (multiTarget) {
      multiTarget.onCommitProps(entries);
      return;
    }
    changeStyle(expsProvider, () => {
      const exp = expsProvider.mergedExp();
      entries.forEach(([propKey, nextVal]) => exp.set(propKey, nextVal));
    });
  };

  const commitSpacing = (prop: EdgeProp, side: Side, nextValue: string) => {
    if (!canEditEdge(prop, side)) {
      return;
    }
    const candidateSides: Side[] =
      linked && oppSide(side) !== side ? [side, oppSide(side)] : [side];
    const sidesToWrite = candidateSides.filter(
      (s) => !blockedByKey.get(`${prop}-${s}`),
    );
    commitProps(sidesToWrite.map((s) => [`${prop}-${s}`, nextValue] as const));
  };

  const startDragScrub = (
    event: React.MouseEvent<HTMLElement>,
    prop: EdgeProp,
    side: Side,
  ) => {
    if (event.button !== 0 || editingEdge) {
      return;
    }
    if (!canEditEdge(prop, side)) {
      return;
    }
    const { resolved, isMixed } = getEdgeResolved(prop, side);
    const draggable = !isMixed && isDraggableSize(resolved);
    const startNumeric = draggable ? tryParseNumericSize(resolved) : undefined;
    const startX = event.clientX;
    let dragged = false;

    const handleMove = (moveEv: MouseEvent) => {
      const dx = moveEv.clientX - startX;
      if (!dragged && Math.abs(dx) >= 3 && draggable && startNumeric) {
        dragged = true;
        studioCtx.startUnlogged();
        app?.setIsDragging(true);
      }
      if (dragged && startNumeric) {
        const step = Math.round(dx / 2);
        const rawNext = startNumeric.num + step;
        const clamped = prop === "padding" ? Math.max(0, rawNext) : rawNext;
        commitSpacing(
          prop,
          side,
          showSizeCss(createNumericSize(clamped, startNumeric.unit || "px")),
        );
      }
    };

    const handleUp = () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
      if (dragged) {
        app?.setIsDragging(false);
        studioCtx.stopUnlogged();
      } else {
        setEditingRadius(false);
        setEditingEdge({ prop, side });
        const cur = getEdgeResolved(prop, side);
        setEditingText(
          cur.isMixed
            ? ""
            : formatCompactDim(cur.resolved === "auto" ? "auto" : cur.resolved),
        );
      }
    };

    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
  };

  const commitEdgeInput = (prop: EdgeProp, side: Side, text: string) => {
    const normalized = normalizeBoxInput(
      text,
      prop === "margin",
      prop === "padding" ? 0 : undefined,
    );
    if (normalized !== undefined) {
      commitSpacing(prop, side, normalized);
    }
    setEditingEdge(null);
  };

  const radiusInfos = standardCorners.map((corner, idx) => {
    const key = `border-${corner}-radius`;
    const multiEntry = multiTarget?.values[key];
    const isMixed = !!multiEntry?.mixed;
    const raw = isMixed ? "" : (cellValueMap.get(key) ?? "0px");
    const resolved = isMixed ? "" : (resolvedRadii.selected[idx] ?? raw);
    return { corner, key, raw, resolved, isMixed };
  });
  const radiusNums = radiusInfos.map((r) => parsePixelNumber(r.resolved));
  const anyRadiusMixed = radiusInfos.some((r) => r.isMixed);
  const isRadiusUniform =
    !anyRadiusMixed &&
    radiusInfos.every((r) => r.resolved === radiusInfos[0].resolved);
  const radiusLabel = isRadiusUniform
    ? formatCompactDim(radiusInfos[0].resolved)
    : uiT("Mix");
  const radiusEditable = !allReadOnly && radiusDimEditable;
  const radiusTooltip = !resolvedCapabilities.radius.editable
    ? uiT(resolvedCapabilities.radius.reason ?? "Corner radius is read-only")
    : anyRadiusBlocked
      ? uiT("Overridden in an active variant")
      : anyRadiusMixed
        ? uiT("Mixed")
        : isRadiusUniform
          ? `${uiT("Corner radius")}: ${radiusInfos[0].resolved || "0px"}`
          : `${radiusInfos[0].resolved} · ${radiusInfos[1].resolved} · ${radiusInfos[2].resolved} · ${radiusInfos[3].resolved}`;

  const commitRadiusInput = (text: string) => {
    if (radiusEditable) {
      const normalized = normalizeBoxInput(text, false, 0);
      if (normalized !== undefined) {
        commitProps(
          standardCorners.map(
            (corner: Corner) => [`border-${corner}-radius`, normalized] as const,
          ),
        );
      }
    }
    setEditingRadius(false);
  };

  const band = (px: number) => Math.min(8, Math.max(0, Math.round(Math.abs(px) / 6)));
  const mtPx = parsePixelNumber(getEdgeResolved("margin", "top").resolved);
  const mrPx = parsePixelNumber(getEdgeResolved("margin", "right").resolved);
  const mbPx = parsePixelNumber(getEdgeResolved("margin", "bottom").resolved);
  const mlPx = parsePixelNumber(getEdgeResolved("margin", "left").resolved);
  const ptPx = parsePixelNumber(getEdgeResolved("padding", "top").resolved);
  const prPx = parsePixelNumber(getEdgeResolved("padding", "right").resolved);
  const pbPx = parsePixelNumber(getEdgeResolved("padding", "bottom").resolved);
  const plPx = parsePixelNumber(getEdgeResolved("padding", "left").resolved);

  const outerBoxStyle: React.CSSProperties = {
    paddingTop: 5 + Math.min(10, Math.round(Math.max(0, mtPx) / 5)),
    paddingBottom: 5 + Math.min(10, Math.round(Math.max(0, mbPx) / 5)),
    boxShadow: [
      `inset 0 ${band(mtPx)}px 0 0 rgba(148,163,184,0.16)`,
      `inset -${band(mrPx)}px 0 0 0 rgba(148,163,184,0.16)`,
      `inset 0 -${band(mbPx)}px 0 0 rgba(148,163,184,0.16)`,
      `inset ${band(mlPx)}px 0 0 0 rgba(148,163,184,0.16)`,
    ].join(", "),
  };

  const innerBoxStyle: React.CSSProperties = {
    paddingTop: 5 + Math.min(10, Math.round(Math.max(0, ptPx) / 5)),
    paddingBottom: 5 + Math.min(10, Math.round(Math.max(0, pbPx) / 5)),
    borderRadius: `${Math.min(12, Math.max(0, radiusNums[0]))}px ${Math.min(12, Math.max(0, radiusNums[1]))}px ${Math.min(12, Math.max(0, radiusNums[2]))}px ${Math.min(12, Math.max(0, radiusNums[3]))}px`,
    boxShadow: paddingDimEditable || ptPx > 0 || prPx > 0 || pbPx > 0 || plPx > 0
      ? [
          `inset 0 ${band(ptPx)}px 0 0 rgba(13,153,255,0.18)`,
          `inset -${band(prPx)}px 0 0 0 rgba(13,153,255,0.18)`,
          `inset 0 -${band(pbPx)}px 0 0 rgba(13,153,255,0.18)`,
          `inset ${band(plPx)}px 0 0 0 rgba(13,153,255,0.18)`,
        ].join(", ")
      : undefined,
  };

  const effectiveMeasuredSize = multiTarget?.measuredSize ?? measuredSize;
  const widthMixed = !!multiTarget?.values.width?.mixed;
  const heightMixed = !!multiTarget?.values.height?.mixed;
  const normalizedStyleW = widthMixed
    ? undefined
    : normalizeFallbackCssSize("width", cellValueMap.get("width"));
  const normalizedStyleH = heightMixed
    ? undefined
    : normalizeFallbackCssSize("height", cellValueMap.get("height"));
  const coreWidthDisplay = effectiveMeasuredSize
    ? String(effectiveMeasuredSize.w)
    : widthMixed
      ? uiT("Mix")
      : formatCompactDim(normalizedStyleW ?? "auto");
  const coreHeightDisplay = effectiveMeasuredSize
    ? String(effectiveMeasuredSize.h)
    : heightMixed
      ? uiT("Mix")
      : formatCompactDim(normalizedStyleH ?? "auto");
  const coreTooltipText = effectiveMeasuredSize
    ? `${uiT("Size")}: ${effectiveMeasuredSize.w} × ${effectiveMeasuredSize.h} px`
    : `${uiT("Size")}: ${widthMixed ? uiT("Mixed") : normalizedStyleW ?? "auto"} × ${heightMixed ? uiT("Mixed") : normalizedStyleH ?? "auto"}`;

  const renderEdgePill = (
    prop: EdgeProp,
    side: Side,
    vertical = false,
  ) => {
    const editable = canEditEdge(prop, side);
    const capReason =
      prop === "margin"
        ? resolvedCapabilities.margin.reason
        : resolvedCapabilities.padding.reason;
    const info = getEdgeResolved(prop, side);
    const isEditing = editingEdge?.prop === prop && editingEdge?.side === side;
    const isPeer =
      linked &&
      editable &&
      hoveredEdge?.prop === prop &&
      oppSide(hoveredEdge.side) === side;
    const displayValue = info.isMixed ? uiT("Mix") : formatCompactDim(info.resolved);
    const tooltipText = !editable
      ? info.isBlocked
        ? uiT("Overridden in an active variant")
        : uiT(capReason ?? "Read-only")
      : info.isMixed
        ? uiT("Mixed")
        : info.isToken
          ? `${prop}-${side}: ${info.resolved}`
          : `${prop}-${side}: ${info.raw}`;

    return (
      <Tooltip title={tooltipText} key={`${prop}-${side}`}>
        <div
          role={editable ? "button" : undefined}
          tabIndex={editable && !isEditing ? 0 : undefined}
          aria-label={`${prop}-${side}`}
          aria-readonly={!editable}
          data-testid={`box-edge-${prop}-${side}`}
          className={cn(styles.edgePill, {
            [styles.edgePillVertical]: vertical,
            [styles.edgePillEditable]: editable,
            [styles.edgePillReadOnly]: !editable,
            [styles.edgePillActive]: isEditing,
            [styles.edgePillPeer]: isPeer && !isEditing,
            [styles.edgePillSet]: info.isSet && editable && !isEditing && !info.isMixed,
            [styles.edgePillToken]: info.isToken,
          })}
          onMouseEnter={() => {
            if (editable) {
              setHoveredEdge({ prop, side });
            }
          }}
          onMouseLeave={() => setHoveredEdge(null)}
          onMouseDown={(ev) => startDragScrub(ev, prop, side)}
          onKeyDown={(ev) => {
            if (editable && !isEditing && (ev.key === "Enter" || ev.key === " ")) {
              ev.preventDefault();
              setEditingEdge({ prop, side });
              setEditingText(info.isMixed ? "" : displayValue);
            }
          }}
          onContextMenu={(ev) => {
            if (
              editable &&
              !multiTarget &&
              !expsProvider.getNativeStyleSource().inputs.isDisposed
            ) {
              maybeShowContextMenu(
                ev.nativeEvent,
                createStyleContextMenu(expsProvider, [info.key]),
              );
            }
          }}
        >
          {isEditing ? (
            <InspectorInput
              type="text"
              inputMode="decimal"
              autoFocus
              aria-label={`${prop}-${side} input`}
              className={styles.edgeInput}
              value={editingText}
              onFocus={(ev) => ev.currentTarget.select()}
              onChange={(ev) => setEditingText(ev.target.value)}
              onKeyDown={(ev) => {
                if (ev.key === "Enter") {
                  ev.preventDefault();
                  commitEdgeInput(prop, side, editingText);
                } else if (ev.key === "Escape") {
                  ev.preventDefault();
                  setEditingEdge(null);
                }
              }}
              onBlur={() => commitEdgeInput(prop, side, editingText)}
            />
          ) : (
            <span className={styles.edgeValueText}>{displayValue}</span>
          )}
        </div>
      </Tooltip>
    );
  };

  return (
    <div
      ref={cardRef}
      className={styles.card}
      data-testid="box-geometry-card"
      data-readonly={allReadOnly ? "true" : "false"}
    >
      <div className={styles.header}>
        <div className={styles.titleGroup}>
          <span className={styles.title}>{uiT("Box Geometry")}</span>
          {allReadOnly && !inspecting && (
            <Tooltip
              title={
                allBlockedByVariant
                  ? uiT("Overridden in an active variant")
                  : uiT(
                      resolvedCapabilities.readOnlyReason ??
                        "Box properties are read-only for this element",
                    )
              }
            >
              <span
                className={styles.readOnlyBadge}
                data-testid="box-readonly-badge"
              >
                {uiT("Read-only")}
              </span>
            </Tooltip>
          )}
        </div>

        {!allReadOnly && (
          <Tooltip
            title={
              linked
                ? uiT("Opposite edges linked")
                : uiT("Independent edges")
            }
          >
            <InspectorEdit><button
              type="button"
              aria-label={
                linked
                  ? uiT("Opposite edges linked")
                  : uiT("Independent edges")
              }
              aria-pressed={linked}
              data-testid="box-link-toggle"
              className={cn(styles.linkBtn, { [styles.linkBtnActive]: linked })}
              onClick={() => setLinked((prev) => !prev)}
            >
              <svg
                width="13"
                height="13"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.4"
              >
                {linked ? (
                  <path d="M6.5 9.5 9.5 6.5M5 7l-1.5 1.5a2.1 2.1 0 0 0 3 3L8 10M11 9l1.5-1.5a2.1 2.1 0 0 0-3-3L8 6" />
                ) : (
                  <path d="M5 7l-1.5 1.5a2.1 2.1 0 0 0 3 3L8 10M11 9l1.5-1.5a2.1 2.1 0 0 0-3-3L8 6M3 3l10 10" />
                )}
              </svg>
            </button></InspectorEdit>
          </Tooltip>
        )}
      </div>

      <div
        className={cn(styles.outerBox, {
          [styles.outerBoxReadOnly]: !marginDimEditable || allReadOnly,
        })}
        style={outerBoxStyle}
      >
        <div className={styles.topGrid}>
          <span className={styles.labelLeft}>M</span>
          {renderEdgePill("margin", "top")}
          <span className={styles.unitRight}>px</span>
        </div>

        <div className={styles.middleRow}>
          {renderEdgePill("margin", "left", true)}

          <div
            className={cn(styles.innerBox, {
              [styles.innerBoxReadOnly]: !paddingDimEditable || allReadOnly,
            })}
            style={innerBoxStyle}
          >
            <div className={styles.topGrid}>
              <span className={cn(styles.labelLeft, styles.labelPadding)}>P</span>
              {renderEdgePill("padding", "top")}
              <Tooltip title={radiusTooltip}>
                <button
                  type="button"
                  disabled={!radiusEditable}
                  aria-label={uiT("Corner radius")}
                  data-testid="box-radius-pill"
                  className={cn(styles.radiusPill, {
                    [styles.radiusPillEditable]: radiusEditable,
                    [styles.radiusPillReadOnly]: !radiusEditable,
                    [styles.radiusPillActive]: editingRadius,
                  })}
                  onClick={() => {
                    if (radiusEditable) {
                      setEditingEdge(null);
                      setEditingRadius(true);
                      setRadiusText(
                        isRadiusUniform
                          ? formatCompactDim(radiusInfos[0].resolved)
                          : "",
                      );
                    }
                  }}
                >
                  <span>╭</span>
                  {editingRadius ? (
                    <InspectorInput
                      type="text"
                      inputMode="decimal"
                      autoFocus
                      aria-label="border-radius input"
                      className={styles.edgeInput}
                      value={radiusText}
                      onFocus={(ev) => ev.currentTarget.select()}
                      onChange={(ev) => setRadiusText(ev.target.value)}
                      onKeyDown={(ev) => {
                        if (ev.key === "Enter") {
                          ev.preventDefault();
                          commitRadiusInput(radiusText);
                        } else if (ev.key === "Escape") {
                          ev.preventDefault();
                          setEditingRadius(false);
                        }
                      }}
                      onBlur={() => commitRadiusInput(radiusText)}
                    />
                  ) : (
                    <span>{radiusLabel}</span>
                  )}
                </button>
              </Tooltip>
            </div>

            <div className={styles.middleRow}>
              {renderEdgePill("padding", "left", true)}

              <Tooltip title={coreTooltipText}>
                <button
                  type="button"
                  className={styles.coreBox}
                  data-testid="box-core-size"
                  aria-label={coreTooltipText}
                  onClick={handleJumpToSize}
                >
                  <div className={styles.coreSizeText}>
                    {coreWidthDisplay}×<wbr />
                    {coreHeightDisplay}
                  </div>
                </button>
              </Tooltip>

              {renderEdgePill("padding", "right", true)}
            </div>

            <div className={styles.bottomRow}>
              {renderEdgePill("padding", "bottom")}
            </div>
          </div>

          {renderEdgePill("margin", "right", true)}
        </div>

        <div className={styles.bottomRow}>
          {renderEdgePill("margin", "bottom")}
        </div>
      </div>
    </div>
  );
});
