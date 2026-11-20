import { InspectorInput, InspectorChoice, InspectorEdit, InspectorReadOnly } from "@/wab/client/components/studio/inspector-access";
import { WithContextMenu } from "@/wab/client/components/ContextMenu";
import { isTplCodeComponentStyleable } from "@/wab/client/code-components/code-components";
import styles from "@/wab/client/components/style-controls/PositionCard.module.scss";
import {
  ExpsProvider,
  TplExpsProvider,
  changeStyle,
  createStyleContextMenu,
  getLabelForStyleName,
} from "@/wab/client/components/style-controls/StyleComponent";
import { DimManip, roundDim } from "@/wab/client/DimManip";
import { useI18n } from "@/wab/client/i18n";
import type { MessageKey } from "@/wab/client/i18n/locales";
import { useStyleCells, useStyleIndicators } from "@/wab/client/studio-ctx/style-inputs-react";
import { useStylePanelLayoutSnapshot } from "@/wab/client/studio-ctx/style-panel-layout-inputs";
import { useStyleTokenRefs } from "@/wab/client/studio-ctx/style-token-ref-inputs";
import { useVariantedStylesHelperFromCurrentCtx } from "@/wab/client/studio-ctx/varianted-style-context";
import { maybe, spawn } from "@/wab/shared/common";
import { PublicStyleSection } from "@/wab/shared/ApiSchema";
import { getSlotSelectionContainingTpl } from "@/wab/shared/SlotUtils";
import { VariantedStylesHelper } from "@/wab/shared/VariantedStylesHelper";
import { isSelectableLocked } from "@/wab/shared/core/selection";
import {
  isPositioningValidForTpl,
  isTransformValidForTpl,
} from "@/wab/shared/core/style-props-tpl";
import {
  isComponentRoot,
  isTplCodeComponent,
  isTplComponent,
  isTplSlot,
  isTplTag,
  resolvesToCodeComponent,
} from "@/wab/shared/core/tpls";
import { parseCssNumericNew } from "@/wab/shared/css";
import {
  Unit,
  createNumericSize,
  ensureUnit,
  isDraggableSize,
  showSizeCss,
  tryParseNumericSize,
} from "@/wab/shared/css-size";
import {
  CssTransforms,
  RotateTransform,
  ScaleTransform,
} from "@/wab/shared/css/transforms";
import { getTargetBlockingCombo, isIndicatorExplicitlySet } from "@/wab/shared/defined-indicator";
import {
  Corner,
  Side,
  cornerToSides,
  oppSide,
  standardCorners,
  standardSides,
} from "@/wab/shared/geom";
import { PositionLayoutType } from "@/wab/shared/layoututils";
import { canEditStyleSection, UiConfig } from "@/wab/shared/ui-config-utils";
import { Tooltip } from "antd";
import cn from "classnames";
import * as React from "react";
import { useShallow } from "zustand/react/shallow";

export interface PositionCapabilities {
  visible: boolean;
  isRootDisabled: boolean;
  positionEditable: boolean;
  positionReason?: MessageKey;
  transformVisible: boolean;
  transformEditable: boolean;
  transformReason?: MessageKey;
  readOnly: boolean;
  readOnlyReason?: MessageKey;
}

export interface ResolvePositionCapabilitiesParams {
  expsProvider: ExpsProvider;
  missingPositionClass?: boolean;
  contentEditorMode?: boolean;
  uiConfig?: UiConfig;
  enabledStyleSections?: readonly (PublicStyleSection | string)[] | boolean;
  readOnly?: boolean;
  locked?: boolean;
  ignoreSelectionEditCheck?: boolean;
  showTransformQuickBar?: boolean;
  showRootPositioning?: boolean;
}

function isSectionIncluded(
  enabledStyleSections:
    | readonly (PublicStyleSection | string)[]
    | boolean
    | undefined,
  section: PublicStyleSection,
  alwaysAllowPositioningOnArray: boolean,
): boolean {
  if (enabledStyleSections === false) {
    return false;
  }
  if (Array.isArray(enabledStyleSections)) {
    if (
      alwaysAllowPositioningOnArray &&
      section === PublicStyleSection.Positioning
    ) {
      return true;
    }
    return (
      enabledStyleSections as readonly (PublicStyleSection | string)[]
    ).includes(section);
  }
  return true;
}

export function resolvePositionCapabilities({
  expsProvider,
  missingPositionClass = false,
  contentEditorMode = false,
  uiConfig,
  enabledStyleSections,
  readOnly = false,
  locked,
  ignoreSelectionEditCheck = false,
  showTransformQuickBar = true,
  showRootPositioning = true,
}: ResolvePositionCapabilitiesParams): PositionCapabilities {
  const hidden: PositionCapabilities = {
    visible: false,
    isRootDisabled: false,
    positionEditable: false,
    transformVisible: false,
    transformEditable: false,
    readOnly: true,
  };

  const studioCanEdit =
    (expsProvider.studioCtx.canEditProject?.() ?? true) &&
    (expsProvider.studioCtx.canEditBranch?.() ?? true);

  if (!(expsProvider instanceof TplExpsProvider)) {
    if (enabledStyleSections === false) {
      return hidden;
    }
    const positioningAllowed = isSectionIncluded(
      enabledStyleSections,
      PublicStyleSection.Positioning,
      false,
    );
    if (!positioningAllowed) {
      return hidden;
    }
    const transformAllowed =
      showTransformQuickBar &&
      isSectionIncluded(
        enabledStyleSections,
        PublicStyleSection.Transform,
        false,
      );
    const effectiveEditable = !readOnly && studioCanEdit;
    const lockReason: MessageKey | undefined = effectiveEditable
      ? undefined
      : "Read-only mode";

    return {
      visible: true,
      isRootDisabled: false,
      positionEditable: effectiveEditable,
      positionReason: lockReason,
      transformVisible: transformAllowed,
      transformEditable: effectiveEditable && transformAllowed,
      transformReason: effectiveEditable ? undefined : lockReason,
      readOnly: !effectiveEditable,
      readOnlyReason: lockReason,
    };
  }

  const tpl = expsProvider.tpl;
  const viewCtx = expsProvider.viewCtx;
  const ccRegistry = viewCtx.studioCtx.codeComponentsRegistry;

  if (isTplSlot(tpl) || (!isTplTag(tpl) && !isTplComponent(tpl))) {
    return hidden;
  }

  const resolvesCC = resolvesToCodeComponent(tpl);
  const ccMeta = isTplCodeComponent(tpl)
    ? viewCtx.getTplCodeComponentMeta(tpl)
    : undefined;
  const effectiveStyleSections =
    enabledStyleSections ?? ccMeta?.styleSections;

  if (
    effectiveStyleSections === false ||
    (isTplCodeComponent(tpl) && !isTplCodeComponentStyleable(ccRegistry, tpl))
  ) {
    return hidden;
  }

  if (resolvesCC && missingPositionClass && ccMeta?.styleSections !== true) {
    return hidden;
  }

  if (!isPositioningValidForTpl(tpl, expsProvider.mergedExp())) {
    return hidden;
  }

  const activeUiConfig = uiConfig ?? viewCtx.studioCtx.getCurrentUiConfig();
  const canEditSectionByConfig = (section: PublicStyleSection) =>
    canEditStyleSection(activeUiConfig, section, {
      isContentCreator: contentEditorMode,
      defaultContentEditorVisible: false,
    });

  if (!canEditSectionByConfig(PublicStyleSection.Positioning)) {
    return hidden;
  }

  if (isComponentRoot(tpl) && !showRootPositioning) {
    return {
      visible: true,
      isRootDisabled: true,
      positionEditable: false,
      transformVisible: false,
      transformEditable: false,
      readOnly: true,
    };
  }

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

  const positionEditable = canEdit && !slotFixedRoot;
  const positionReason: MessageKey | undefined = !canEdit
    ? nonEditableReason
    : slotFixedRoot
      ? "Fixed slot root does not allow style edits"
      : undefined;

  const transformVisible =
    showTransformQuickBar &&
    isTransformValidForTpl(tpl) &&
    canEditSectionByConfig(PublicStyleSection.Transform) &&
    isSectionIncluded(effectiveStyleSections, PublicStyleSection.Transform, false);

  return {
    visible: true,
    isRootDisabled: false,
    positionEditable,
    positionReason,
    transformVisible,
    transformEditable: positionEditable && transformVisible,
    transformReason: positionReason,
    readOnly: !positionEditable,
    readOnlyReason: positionReason,
  };
}

export const POSITION_STYLE_KEYS = [
  "position",
  "z-index",
  "top",
  "right",
  "bottom",
  "left",
  "align-self",
  "order",
  "justify-self",
  "transform",
] as const;

const ALIGN_SELF_OPTIONS = [
  "flex-start",
  "center",
  "flex-end",
  "stretch",
  "baseline",
] as const;

type AlignSelfOption = (typeof ALIGN_SELF_OPTIONS)[number];

const EDGE_SHORT_LABELS: Record<Side, string> = {
  left: "L",
  right: "R",
  top: "T",
  bottom: "B",
};

const EDGE_DISPLAY_ORDER: readonly Side[] = ["left", "right", "top", "bottom"];

const MODE_OPTIONS: ReadonlyArray<{
  value: PositionLayoutType;
  labelKey: MessageKey;
  cssLabel: string;
}> = [
  { value: PositionLayoutType.auto, labelKey: "Auto", cssLabel: "relative" },
  { value: PositionLayoutType.free, labelKey: "Free", cssLabel: "absolute" },
  { value: PositionLayoutType.sticky, labelKey: "Sticky", cssLabel: "sticky" },
  { value: PositionLayoutType.fixed, labelKey: "Fixed", cssLabel: "fixed" },
];

const CORNER_CLASSES: Record<Corner, string> = {
  "top-left": styles.pinCornerTL,
  "top-right": styles.pinCornerTR,
  "bottom-left": styles.pinCornerBL,
  "bottom-right": styles.pinCornerBR,
};

const EDGE_PIN_CLASSES: Record<Side, string> = {
  top: styles.pinEdgeTop,
  bottom: styles.pinEdgeBottom,
  left: styles.pinEdgeLeft,
  right: styles.pinEdgeRight,
};

function formatInsetValue(rawValue: string | undefined): string {
  const trimmed = (rawValue ?? "").trim();
  if (!trimmed || trimmed === "auto") {
    return "";
  }
  if (trimmed.endsWith("px")) {
    const n = trimmed.slice(0, -2);
    if (/^-?\d+(\.\d+)?$/.test(n)) {
      return n;
    }
  }
  return trimmed;
}

function normalizeInsetInput(
  rawInput: string,
  fallbackUnit: Unit = "px",
): string | undefined {
  const trimmed = rawInput.trim();
  if (!trimmed || trimmed.toLowerCase() === "auto") {
    return "auto";
  }
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
    return showSizeCss(createNumericSize(Number(trimmed), fallbackUnit));
  }
  const parsed = tryParseNumericSize(trimmed);
  if (parsed) {
    return showSizeCss(
      createNumericSize(parsed.num, parsed.unit || fallbackUnit),
    );
  }
  if (/^(calc|min|max|clamp|var)\(/i.test(trimmed)) {
    return trimmed;
  }
  return undefined;
}

function formatOptionalInt(
  rawValue: string | undefined,
  isExplicit: boolean,
  defaultCssValues: readonly string[],
): string {
  const trimmed = (rawValue ?? "").trim();
  if (!trimmed) {
    return "";
  }
  if (!isExplicit && defaultCssValues.includes(trimmed)) {
    return "";
  }
  if (defaultCssValues.includes(trimmed) && trimmed === "auto") {
    return "";
  }
  const num = Number(trimmed);
  return Number.isFinite(num) ? String(num) : trimmed;
}

function isZRotateTransform(t: unknown): t is RotateTransform {
  return (
    t instanceof RotateTransform &&
    t.X === "0" &&
    t.Y === "0" &&
    Number(t.Z) !== 0 &&
    !Number.isNaN(Number(t.Z))
  );
}

function parseAngleDegrees(angle: string): number {
  const trimmed = angle.trim().toLowerCase();
  if (trimmed.endsWith("turn")) {
    const n = parseFloat(trimmed);
    return Number.isFinite(n) ? n * 360 : 0;
  }
  if (trimmed.endsWith("rad")) {
    const n = parseFloat(trimmed);
    return Number.isFinite(n) ? (n * 180) / Math.PI : 0;
  }
  if (trimmed.endsWith("grad")) {
    const n = parseFloat(trimmed);
    return Number.isFinite(n) ? (n * 360) / 400 : 0;
  }
  const n = parseFloat(trimmed);
  return Number.isFinite(n) ? n : 0;
}

function read2DTransformState(rawTransform: string | undefined): {
  rotateDeg: number;
  flippedH: boolean;
  flippedV: boolean;
  parsed: CssTransforms;
} {
  const parsed = CssTransforms.fromCss(rawTransform ?? "");
  const rotateItem = parsed.transforms.find(isZRotateTransform);
  const scaleItem = parsed.transforms.find(
    (t): t is ScaleTransform => t instanceof ScaleTransform,
  );
  const rawDeg = rotateItem
    ? parseAngleDegrees(rotateItem.angle) * (Number(rotateItem.Z) < 0 ? -1 : 1)
    : 0;
  const rotateDeg = Math.round(rawDeg * 100) / 100;
  const flippedH = scaleItem ? parseFloat(scaleItem.X) < 0 : false;
  const flippedV = scaleItem ? parseFloat(scaleItem.Y) < 0 : false;
  return { rotateDeg, flippedH, flippedV, parsed };
}

function AngleSvg() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.35"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12.5 12.5H3.5L10.5 4.5" />
      <path d="M7.2 8.2a3.8 3.8 0 0 1 1.6 4.3" />
    </svg>
  );
}

function RotateCw90Svg() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.3"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="2.5" y="7" width="6" height="6" rx="1.2" />
      <path d="M8.2 3.2A4.6 4.6 0 0 1 13 7.8" />
      <path d="m11.2 6.6 1.8 1.5 1.3-1.9" />
    </svg>
  );
}

function FlipHorizontalSvg() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M8 2v12" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
      <path d="M6.2 4.3 2 8l4.2 3.7V4.3Z" fill="currentColor" />
      <path
        d="M9.8 4.3 14 8l-4.2 3.7V4.3Z"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function FlipVerticalSvg() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M2 8h12" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
      <path d="M4.3 6.2 8 2l3.7 4.2H4.3Z" fill="currentColor" />
      <path
        d="M4.3 9.8 8 14l3.7-4.2H4.3Z"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function AlignGlyph({
  option,
  crossAxis,
}: {
  option: AlignSelfOption;
  crossAxis: "horizontal" | "vertical";
}) {
  const rotateStyle =
    crossAxis === "vertical" && option !== "baseline"
      ? { transform: "rotate(90deg)" }
      : undefined;

  switch (option) {
    case "flex-start":
      return (
        <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" style={rotateStyle} aria-hidden="true">
          <path d="M2.5 2.5a.5.5 0 0 1 1 0v11a.5.5 0 0 1-1 0v-11Z" />
          <rect x="5" y="4.5" width="7.5" height="2.2" rx="0.8" />
          <rect x="5" y="9" width="4.8" height="2.2" rx="0.8" />
        </svg>
      );
    case "center":
      return (
        <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" style={rotateStyle} aria-hidden="true">
          <path d="M7.5 2.5a.5.5 0 0 1 1 0v11a.5.5 0 0 1-1 0v-11Z" />
          <rect x="3.5" y="4.5" width="9" height="2.2" rx="0.8" />
          <rect x="5" y="9" width="6" height="2.2" rx="0.8" />
        </svg>
      );
    case "flex-end":
      return (
        <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" style={rotateStyle} aria-hidden="true">
          <path d="M12.5 2.5a.5.5 0 0 1 1 0v11a.5.5 0 0 1-1 0v-11Z" />
          <rect x="3.5" y="4.5" width="7.5" height="2.2" rx="0.8" />
          <rect x="6.2" y="9" width="4.8" height="2.2" rx="0.8" />
        </svg>
      );
    case "stretch":
      return (
        <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" style={rotateStyle} aria-hidden="true">
          <path d="M2.5 2.5a.5.5 0 0 1 1 0v11a.5.5 0 0 1-1 0v-11Zm10 0a.5.5 0 0 1 1 0v11a.5.5 0 0 1-1 0v-11Z" />
          <rect x="5" y="4.5" width="6" height="2.2" rx="0.8" />
          <rect x="5" y="9" width="6" height="2.2" rx="0.8" />
        </svg>
      );
    case "baseline":
      return (
        <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
          <path d="M2.5 11.5a.5.5 0 0 1 0-1h11a.5.5 0 0 1 0 1h-11Z" />
          <rect x="4" y="4.5" width="2.5" height="5" rx="0.7" />
          <rect x="9" y="6.5" width="2.5" height="3" rx="0.7" />
        </svg>
      );
  }
}

const EMPTY_KEYS: readonly string[] = [];

export interface PositionCardProps {
  expsProvider: ExpsProvider;
  capabilities?: PositionCapabilities;
  vsh?: VariantedStylesHelper;
  readOnly?: boolean;
}

export const PositionCard = React.memo(function PositionCard(
  props: PositionCardProps,
) {
  const inspecting = React.useContext(InspectorReadOnly);
  const { t: uiT } = useI18n();
  const { expsProvider, vsh: providedVsh, readOnly = false } = props;
  const studioCtx = expsProvider.studioCtx;
  const currentVsh = useVariantedStylesHelperFromCurrentCtx(
    providedVsh ? undefined : studioCtx,
  );
  const vsh = providedVsh ?? currentVsh;

  const [menuOpen, setMenuOpen] = React.useState(false);
  const [draftKey, setDraftKey] = React.useState<string | null>(null);
  const [draftText, setDraftText] = React.useState("");
  const modeWrapRef = React.useRef<HTMLDivElement>(null);
  const scrubCleanupRef = React.useRef<(() => void) | null>(null);

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

  React.useEffect(() => {
    return () => {
      scrubCleanupRef.current?.();
    };
  }, []);

  React.useEffect(() => {
    if (!menuOpen) {
      return;
    }
    const handlePointerDown = (e: MouseEvent) => {
      if (modeWrapRef.current && !modeWrapRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [menuOpen]);

  const layoutSnapshot = useStylePanelLayoutSnapshot(
    expsProvider,
    alive ? POSITION_STYLE_KEYS : EMPTY_KEYS,
    alive ? ["display", "flex-direction"] : EMPTY_KEYS,
  );
  const cells = useStyleCells(expsProvider, alive ? POSITION_STYLE_KEYS : EMPTY_KEYS);
  const indicators = useStyleIndicators(
    expsProvider,
    alive ? POSITION_STYLE_KEYS : EMPTY_KEYS,
  );

  const cellValueMap = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const c of cells) {
      map.set(c.key, c.value);
    }
    return map;
  }, [cells]);

  const rawSides = React.useMemo(
    () => standardSides.map((s) => cellValueMap.get(s) ?? "auto"),
    [cellValueMap],
  );
  const sideTokenRows = useStyleTokenRefs(
    studioCtx,
    rawSides,
    vsh,
    "SpacingOnly",
    useShallow((state) => state.rows.map((row) => row.applied)),
  );
  const selectedSideTokens = sideTokenRows.selected;
  const sideTokenMap = React.useMemo(() => {
    const map = new Map<Side, (typeof selectedSideTokens)[number]>();
    standardSides.forEach((side, idx) => {
      map.set(side, selectedSideTokens[idx]);
    });
    return map;
  }, [selectedSideTokens]);

  const setMap = React.useMemo(() => {
    const map = new Map<string, boolean>();
    POSITION_STYLE_KEYS.forEach((key, idx) => {
      const ind = indicators[idx];
      map.set(key, isIndicatorExplicitlySet(ind));
    });
    return map;
  }, [indicators]);

  const blockedMap = React.useMemo(() => {
    const map = new Map<string, boolean>();
    POSITION_STYLE_KEYS.forEach((key, idx) => {
      const ind = indicators[idx];
      map.set(key, !!(ind && getTargetBlockingCombo([ind])));
    });
    return map;
  }, [indicators]);

  const capabilities = React.useMemo(
    () =>
      props.capabilities ??
      resolvePositionCapabilities({
        expsProvider,
        readOnly,
        showRootPositioning: layoutSnapshot.layout?.showPositioning ?? true,
      }),
    [props.capabilities, expsProvider, readOnly, layoutSnapshot.layout?.showPositioning],
  );

  if (!alive || !layoutSnapshot.active || !capabilities.visible) {
    return null;
  }

  const curPosition = layoutSnapshot.position;
  const isAuto =
    curPosition === PositionLayoutType.auto || curPosition === undefined;
  const isSticky = curPosition === PositionLayoutType.sticky;
  const isFreeOrFixed =
    curPosition === PositionLayoutType.free ||
    curPosition === PositionLayoutType.fixed;

  const parentContainerType = layoutSnapshot.parentContainerType;
  const parentIsFree = parentContainerType === "free";
  const parentIsFlex = ["flex-row", "flex-column"].includes(
    parentContainerType ?? "",
  );
  const parentIsContentLayout = parentContainerType === "content-layout";
  const parentFlexDir =
    layoutSnapshot.parentCells
      .find((cell) => cell.key === "flex-direction")
      ?.value.split("-")[0] ?? "row";
  const alignCrossAxis: "horizontal" | "vertical" =
    parentIsContentLayout || parentFlexDir === "column"
      ? "horizontal"
      : "vertical";

  const visibleModes = MODE_OPTIONS.filter(
    (opt) => !(parentIsFree && opt.value === PositionLayoutType.auto),
  );
  const activeModeMeta =
    MODE_OPTIONS.find((opt) => opt.value === curPosition) ?? MODE_OPTIONS[0];

  const isPropDisabled = (key: string, forTransform = false): boolean => {
    const baseAllowed = forTransform
      ? capabilities.transformEditable
      : capabilities.positionEditable;
    return !baseAllowed || !!blockedMap.get(key);
  };

  const propReason = (
    key: string,
    forTransform = false,
  ): string | undefined => {
    if (blockedMap.get(key)) {
      return uiT("Overridden in an active variant");
    }
    const reason = forTransform
      ? capabilities.transformReason
      : capabilities.positionReason;
    return reason ? uiT(reason) : undefined;
  };

  const handleSelectMode = (nextMode: PositionLayoutType) => {
    setMenuOpen(false);
    if (isPropDisabled("position") || nextMode === curPosition) {
      return;
    }
    changeStyle(expsProvider, () => {
      expsProvider.onPositionChange(nextMode);
    });
  };

  const alignProp = parentIsContentLayout ? "justify-self" : "align-self";
  const showAlignStrip =
    (isAuto && (parentIsFlex || parentIsContentLayout)) ||
    (isSticky && parentIsFlex);
  const activeAlignValue = cellValueMap.get(alignProp);

  const handleToggleAlign = (option: AlignSelfOption) => {
    if (isPropDisabled(alignProp)) {
      return;
    }
    const nextValue = activeAlignValue === option ? "auto" : option;
    changeStyle(expsProvider, () => {
      expsProvider.mergedExp().set(alignProp, nextValue);
    });
  };

  const startScrub = (
    e: React.MouseEvent,
    axis: "x" | "y",
    onInit: () => number,
    onStep: (totalDelta: number, startNum: number) => void,
  ) => {
    if (e.button !== 0) {
      return;
    }
    e.preventDefault();
    scrubCleanupRef.current?.();
    const startCoord = axis === "x" ? e.clientX : e.clientY;
    const startNum = onInit();
    let moved = false;
    let startedUnlogged = false;

    const handleMove = (moveEvent: MouseEvent) => {
      const coord = axis === "x" ? moveEvent.clientX : moveEvent.clientY;
      const totalDelta = Math.round(coord - startCoord);
      if (!moved && Math.abs(totalDelta) < 2) {
        return;
      }
      if (!moved) {
        moved = true;
        startedUnlogged = true;
        studioCtx.startUnlogged();
      }
      onStep(totalDelta, startNum);
    };

    const cleanup = () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
      if (startedUnlogged) {
        studioCtx.stopUnlogged();
      }
      scrubCleanupRef.current = null;
    };

    const handleUp = () => {
      cleanup();
    };

    scrubCleanupRef.current = cleanup;
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
  };

  const initSideToMeasuredOrZero = (
    side: Side,
    swapOpposite: boolean,
  ): { num: number; unit: Unit } => {
    const exp = expsProvider.mergedExp();
    const current = exp.get(side);
    if (current === "auto") {
      const oppParsed = parseCssNumericNew(exp.get(oppSide(side)));
      const unit: Unit =
        maybe(oppParsed, ({ units }) => ensureUnit(units)) || "px";
      if (swapOpposite) {
        exp.set(oppSide(side), "auto");
      }
      if (expsProvider instanceof TplExpsProvider) {
        try {
          new DimManip(
            studioCtx,
            expsProvider.forDom(),
            () => expsProvider.mergedExp(),
            side,
          ).trySetUsingMeasured(unit);
        } catch {
          exp.set(side, `0${unit}`);
        }
      }
      if (exp.get(side) === "auto") {
        exp.set(side, `0${unit}`);
      }
      const nextParsed = parseCssNumericNew(exp.get(side));
      return {
        num: nextParsed?.num ?? 0,
        unit: (nextParsed && ensureUnit(nextParsed.units)) || unit,
      };
    }
    const parsed = parseCssNumericNew(current);
    return {
      num: parsed?.num ?? 0,
      unit: (parsed && ensureUnit(parsed.units)) || "px",
    };
  };

  const commitSideValue = (side: Side, rawInput: string) => {
    const exp = expsProvider.mergedExp();
    const current = cellValueMap.get(side) ?? "auto";
    const parsed = parseCssNumericNew(current);
    const fallbackUnit: Unit =
      (parsed && ensureUnit(parsed.units)) || "px";
    const normalized = normalizeInsetInput(rawInput, fallbackUnit);
    if (!normalized) {
      return;
    }
    changeStyle(expsProvider, () => {
      exp.set(side, normalized);
    });
  };

  const toggleEdgePin = (side: Side) => {
    if (isPropDisabled(side)) {
      return;
    }
    const current = cellValueMap.get(side) ?? "auto";
    changeStyle(expsProvider, () => {
      expsProvider.mergedExp().set(side, current === "auto" ? "0" : "auto");
    });
  };

  const applyCornerPreset = (corner: Corner) => {
    if (standardSides.some((s) => isPropDisabled(s))) {
      return;
    }
    const targetSides = cornerToSides(corner);
    changeStyle(expsProvider, () => {
      const exp = expsProvider.mergedExp();
      for (const side of standardSides) {
        exp.set(side, targetSides.includes(side) ? "0" : "auto");
      }
    });
  };

  const applyCoverPreset = () => {
    if (standardSides.some((s) => isPropDisabled(s))) {
      return;
    }
    const allPinned = standardSides.every(
      (s) => (cellValueMap.get(s) ?? "auto") !== "auto",
    );
    changeStyle(expsProvider, () => {
      const exp = expsProvider.mergedExp();
      if (allPinned) {
        exp.set("top", "0");
        exp.set("left", "0");
        exp.set("right", "auto");
        exp.set("bottom", "auto");
      } else {
        for (const side of standardSides) {
          exp.set(side, "0");
        }
        exp.set("width", "auto");
        exp.set("height", "auto");
      }
    });
  };

  const commitIntegerStyle = (
    prop: "order" | "z-index",
    rawInput: string,
    minVal?: number,
  ) => {
    const trimmed = rawInput.trim();
    const resetVal = prop === "order" ? "0" : "auto";
    changeStyle(expsProvider, () => {
      const exp = expsProvider.mergedExp();
      if (!trimmed || trimmed.toLowerCase() === "auto") {
        exp.clear(prop);
        const remaining = exp.get(prop);
        if (remaining && remaining !== resetVal) {
          exp.set(prop, resetVal);
        }
        return;
      }
      const n = Number(trimmed);
      if (!Number.isFinite(n)) {
        return;
      }
      const rounded = Math.round(n);
      const finalNum = minVal !== undefined ? Math.max(minVal, rounded) : rounded;
      exp.set(prop, String(finalNum));
    });
  };

  const rawTransform = cellValueMap.get("transform");
  const transformState = read2DTransformState(rawTransform);

  const mutateTransform = (
    updater: (
      transforms: CssTransforms["transforms"],
      latest: ReturnType<typeof read2DTransformState>,
    ) => void,
  ) => {
    changeStyle(expsProvider, () => {
      const exp = expsProvider.mergedExp();
      const latest = read2DTransformState(exp.get("transform"));
      const baseTransforms = [...latest.parsed.transforms];
      updater(baseTransforms, latest);
      const next = new CssTransforms(baseTransforms, latest.parsed.perspective);
      if (baseTransforms.length === 0 && !latest.parsed.perspective) {
        exp.clear("transform");
        const remaining = exp.get("transform");
        if (remaining && remaining !== "none") {
          exp.set("transform", "none");
        }
      } else {
        exp.set("transform", next.showCss());
      }
    });
  };

  const applyRotateAngle = (nextAngleRaw: number) => {
    const rounded = Math.round(nextAngleRaw * 100) / 100;
    mutateTransform((baseTransforms) => {
      const existingIdx = baseTransforms.findIndex(isZRotateTransform);
      if (rounded === 0) {
        if (existingIdx >= 0) {
          baseTransforms.splice(existingIdx, 1);
        }
      } else {
        const nextRotate = new RotateTransform("0", "0", "1", `${rounded}deg`);
        if (existingIdx >= 0) {
          baseTransforms[existingIdx] = nextRotate;
        } else {
          baseTransforms.push(nextRotate);
        }
      }
    });
  };

  const handleRotate90Cw = () => {
    if (isPropDisabled("transform", true)) {
      return;
    }
    mutateTransform((baseTransforms, latest) => {
      const nextAngle =
        (((Math.round(latest.rotateDeg) + 90) % 360) + 360) % 360;
      const existingIdx = baseTransforms.findIndex(isZRotateTransform);
      if (nextAngle === 0) {
        if (existingIdx >= 0) {
          baseTransforms.splice(existingIdx, 1);
        }
      } else {
        const nextRotate = new RotateTransform("0", "0", "1", `${nextAngle}deg`);
        if (existingIdx >= 0) {
          baseTransforms[existingIdx] = nextRotate;
        } else {
          baseTransforms.push(nextRotate);
        }
      }
    });
  };

  const handleToggleFlip = (axis: "h" | "v") => {
    if (isPropDisabled("transform", true)) {
      return;
    }
    mutateTransform((baseTransforms) => {
      const scaleIdx = baseTransforms.findIndex(
        (t): t is ScaleTransform => t instanceof ScaleTransform,
      );
      const existing =
        scaleIdx >= 0 ? (baseTransforms[scaleIdx] as ScaleTransform) : undefined;
      const nextX =
        axis === "h"
          ? String(-(parseFloat(existing?.X ?? "1") || 1))
          : (existing?.X ?? "1");
      const nextY =
        axis === "v"
          ? String(-(parseFloat(existing?.Y ?? "1") || 1))
          : (existing?.Y ?? "1");
      const nextZ = existing?.Z ?? "1";
      const isIdentity =
        Number(nextX) === 1 && Number(nextY) === 1 && Number(nextZ) === 1;
      if (isIdentity) {
        if (scaleIdx >= 0) {
          baseTransforms.splice(scaleIdx, 1);
        }
      } else {
        const nextScale = new ScaleTransform(nextX, nextY, nextZ);
        if (scaleIdx >= 0) {
          baseTransforms[scaleIdx] = nextScale;
        } else {
          baseTransforms.push(nextScale);
        }
      }
    });
  };

  const renderIntegerCell = ({
    prop,
    prefix,
    testId,
    tooltip,
    defaultValues,
    minVal,
    fullWidth,
  }: {
    prop: "order" | "z-index";
    prefix: string;
    testId: string;
    tooltip: string;
    defaultValues: readonly string[];
    minVal?: number;
    fullWidth?: boolean;
  }) => {
    const disabled = isPropDisabled(prop);
    const reason = propReason(prop);
    const isSet = !!setMap.get(prop);
    const isDrafting = draftKey === prop;
    const displayValue = isDrafting
      ? draftText
      : formatOptionalInt(cellValueMap.get(prop), isSet, defaultValues);

    return (
      <WithContextMenu
        overlay={() => createStyleContextMenu(expsProvider, [prop])}
      >
        <Tooltip title={reason ?? tooltip}>
          <div
            className={cn(styles.cellInputWrap, {
              [styles.cellInputDisabled]: disabled,
              [styles.fullZRow]: fullWidth,
            })}
          >
            <span
              className={cn(styles.cellPrefix, {
                [styles.cellScrubHoriz]: !disabled,
              })}
              onMouseDown={
                disabled
                  ? undefined
                  : (e) => {
                      startScrub(
                        e,
                        "x",
                        () => {
                          const cur = Number(cellValueMap.get(prop));
                          return Number.isFinite(cur) ? cur : 0;
                        },
                        (delta, startNum) => {
                          const next = startNum + delta;
                          const clamped =
                            minVal !== undefined ? Math.max(minVal, next) : next;
                          spawn(
                            studioCtx.changeUnsafe(() => {
                              expsProvider
                                .mergedExp()
                                .set(prop, String(clamped));
                            }),
                          );
                        },
                      );
                    }
              }
            >
              {isSet && <span className={styles.setDot} />}
              <span>{prefix}</span>
            </span>
            <InspectorInput
              data-testid={testId}
              aria-label={tooltip}
              type="text"
              inputMode="numeric"
              className={styles.cellField}
              value={displayValue}
              placeholder={uiT("Auto")}
              disabled={disabled}
              onFocus={() => {
                setDraftKey(prop);
                setDraftText(displayValue);
              }}
              onChange={(e) => {
                setDraftText(e.target.value);
              }}
              onBlur={() => {
                if (draftKey === prop) {
                  setDraftKey(null);
                  commitIntegerStyle(prop, draftText, minVal);
                }
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.currentTarget.blur();
                } else if (e.key === "Escape") {
                  setDraftKey(null);
                  e.currentTarget.blur();
                }
              }}
            />
          </div>
        </Tooltip>
      </WithContextMenu>
    );
  };

  const renderInsetCell = (side: Side) => {
    const disabled = isPropDisabled(side);
    const reason = propReason(side);
    const isSet = !!setMap.get(side);
    const rawVal = cellValueMap.get(side) ?? "auto";
    const appliedToken = sideTokenMap.get(side);
    const isDrafting = draftKey === side;
    const formatted = formatInsetValue(rawVal);
    const displayValue = isDrafting ? draftText : formatted;
    const isVert = side === "top" || side === "bottom";
    const draggable = !disabled && isDraggableSize(rawVal);

    return (
      <WithContextMenu
        key={side}
        overlay={() => createStyleContextMenu(expsProvider, [side])}
      >
        <Tooltip title={reason ?? getLabelForStyleName(side)}>
          <div
            className={cn(styles.cellInputWrap, {
              [styles.cellInputDisabled]: disabled,
            })}
          >
            <span
              className={cn(styles.cellPrefix, {
                [styles.cellScrubHoriz]: draggable && !isVert,
                [styles.cellScrubVert]: draggable && isVert,
              })}
              onClick={
                disabled
                  ? undefined
                  : (e) => {
                      if (e.metaKey || e.ctrlKey) {
                        changeStyle(expsProvider, () => {
                          if (expsProvider.mergedExp().get(side) !== "auto") {
                            expsProvider.mergedExp().set(side, "auto");
                          } else {
                            initSideToMeasuredOrZero(side, true);
                          }
                        });
                      }
                    }
              }
              onMouseDown={
                !draggable
                  ? undefined
                  : (e) => {
                      let activeUnit = "px";
                      startScrub(
                        e,
                        isVert ? "y" : "x",
                        () => {
                          let startNum = 0;
                          spawn(
                            studioCtx.changeUnsafe(() => {
                              const init = initSideToMeasuredOrZero(
                                side,
                                e.metaKey || e.ctrlKey,
                              );
                              startNum = init.num;
                              activeUnit = init.unit;
                            }),
                          );
                          return startNum;
                        },
                        (delta, startNum) => {
                          const reverse =
                            side === "top" || side === "left" ? 1 : -1;
                          const rounded = roundDim(
                            startNum + delta * reverse,
                            activeUnit,
                          );
                          spawn(
                            studioCtx.changeUnsafe(() => {
                              expsProvider
                                .mergedExp()
                                .set(side, `${rounded}${activeUnit}`);
                            }),
                          );
                        },
                      );
                    }
              }
            >
              {isSet && <span className={styles.setDot} />}
              <span>{EDGE_SHORT_LABELS[side]}</span>
            </span>
            {appliedToken && !isDrafting ? (
              <button
                type="button"
                className={styles.tokenBadge}
                disabled={disabled}
                onClick={() => {
                  if (!disabled) {
                    setDraftKey(side);
                    setDraftText("");
                  }
                }}
              >
                {appliedToken.name}
              </button>
            ) : (
              <InspectorInput
                data-testid={`position-inset-${side}`}
                aria-label={getLabelForStyleName(side)}
                type="text"
                className={styles.cellField}
                value={displayValue}
                placeholder={uiT("Auto")}
                disabled={disabled}
                onFocus={() => {
                  setDraftKey(side);
                  setDraftText(formatted);
                }}
                onChange={(e) => {
                  setDraftText(e.target.value);
                }}
                onBlur={() => {
                  if (draftKey === side) {
                    setDraftKey(null);
                    commitSideValue(side, draftText);
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.currentTarget.blur();
                  } else if (e.key === "Escape") {
                    setDraftKey(null);
                    e.currentTarget.blur();
                  }
                }}
              />
            )}
          </div>
        </Tooltip>
      </WithContextMenu>
    );
  };

  const renderAlignStrip = () => {
    if (!showAlignStrip) {
      return null;
    }
    const disabled = isPropDisabled(alignProp);
    const reason = propReason(alignProp);
    const optionTitles: Record<AlignSelfOption, string> = {
      "flex-start": uiT("Start"),
      center: uiT("Center"),
      "flex-end": uiT("End"),
      stretch: uiT("Stretch"),
      baseline: uiT("Baseline"),
    };

    return (
      <WithContextMenu
        overlay={() => createStyleContextMenu(expsProvider, [alignProp])}
      >
        <div
          className={styles.alignStrip}
          role="group"
          aria-label={uiT("Align")}
          data-testid="position-align-strip"
          data-cross-axis={alignCrossAxis}
        >
          {ALIGN_SELF_OPTIONS.map((option) => {
            const active = activeAlignValue === option;
            return (
              <Tooltip key={option} title={reason ?? optionTitles[option]}>
                <InspectorChoice
                  type="button"
                  data-testid={`position-align-${option}`}
                  aria-label={optionTitles[option]}
                  aria-pressed={active}
                  disabled={disabled}
                  className={cn(styles.iconBtn, {
                    [styles.iconBtnActive]: active,
                  })}
                  onClick={() => handleToggleAlign(option)}
                >
                  <AlignGlyph option={option} crossAxis={alignCrossAxis} />
                </InspectorChoice>
              </Tooltip>
            );
          })}
        </div>
      </WithContextMenu>
    );
  };

  const renderPinBox = () => {
    const pinnedSides: Record<Side, boolean> = {
      top: (cellValueMap.get("top") ?? "auto") !== "auto",
      right: (cellValueMap.get("right") ?? "auto") !== "auto",
      bottom: (cellValueMap.get("bottom") ?? "auto") !== "auto",
      left: (cellValueMap.get("left") ?? "auto") !== "auto",
    };
    const allSidesPinned = standardSides.every((s) => pinnedSides[s]);
    const sideCount = standardSides.filter((s) => pinnedSides[s]).length;

    return (
      <div className={styles.pinBox} role="group" aria-label={uiT("Constraints")}>
        {isFreeOrFixed &&
          standardCorners.map((corner) => {
            const [s1, s2] = cornerToSides(corner);
            const cornerActive =
              sideCount === 2 && pinnedSides[s1] && pinnedSides[s2];
            return (
              <Tooltip
                key={corner}
                title={uiT("Push to {part1}", {
                  part1: String(getLabelForStyleName(corner)),
                })}
              >
                <InspectorChoice
                  type="button"
                  data-testid={`position-pin-${corner}`}
                  aria-label={getLabelForStyleName(corner)}
                  aria-pressed={cornerActive}
                  disabled={standardSides.some((s) => isPropDisabled(s))}
                  className={cn(styles.pinCorner, CORNER_CLASSES[corner], {
                    [styles.pinCornerActive]: cornerActive,
                  })}
                  onClick={() => applyCornerPreset(corner)}
                />
              </Tooltip>
            );
          })}

        {standardSides.map((side) => (
          <Tooltip
            key={side}
            title={propReason(side) ?? getLabelForStyleName(side)}
          >
            <InspectorChoice
              type="button"
              data-testid={`position-pin-${side}`}
              aria-label={getLabelForStyleName(side)}
              aria-pressed={pinnedSides[side]}
              disabled={isPropDisabled(side)}
              className={cn(styles.pinEdge, EDGE_PIN_CLASSES[side], {
                [styles.pinEdgeActive]: pinnedSides[side],
              })}
              onClick={() => toggleEdgePin(side)}
            />
          </Tooltip>
        ))}

        {isFreeOrFixed && (
          <Tooltip title={uiT("Cover")}>
            <InspectorChoice
              type="button"
              data-testid="position-pin-cover"
              aria-label={uiT("Cover")}
              aria-pressed={allSidesPinned}
              disabled={standardSides.some((s) => isPropDisabled(s))}
              className={cn(styles.pinCover, {
                [styles.pinCoverActive]: allSidesPinned,
              })}
              onClick={applyCoverPreset}
            />
          </Tooltip>
        )}
      </div>
    );
  };

  const parentSupportsOrder = ["flex-row", "flex-column", "content-layout"].includes(
    parentContainerType ?? "",
  );
  const showOrderInput =
    isAuto && (parentSupportsOrder || !!setMap.get("order"));
  const modeDisabled = isPropDisabled("position");

  const rotateKey = "transform-rotate";
  const rotateDisabled = isPropDisabled("transform", true);
  const rotateReason = propReason("transform", true);
  const rotateDrafting = draftKey === rotateKey;
  const rotateDisplay = rotateDrafting
    ? draftText
    : String(transformState.rotateDeg);

  return (
    <div
      className={styles.card}
      data-testid="position-card"
      data-position-mode={activeModeMeta.cssLabel}
    >
      <div className={styles.header}>
        <WithContextMenu
          overlay={() => createStyleContextMenu(expsProvider, ["position"])}
        >
          <div className={styles.titleGroup}>
            <span className={styles.title}>{uiT("Position")}</span>
            {capabilities.readOnly && !inspecting && (
              <Tooltip
                title={
                  capabilities.readOnlyReason
                    ? uiT(capabilities.readOnlyReason)
                    : undefined
                }
              >
                <span
                  className={styles.readOnlyBadge}
                  data-testid="position-readonly-badge"
                >
                  {uiT("Read-only")}
                </span>
              </Tooltip>
            )}
          </div>
        </WithContextMenu>

        <div className={styles.modeWrap} ref={modeWrapRef}>
          <Tooltip title={propReason("position") ?? uiT("Position")}>
            <button
              type="button"
              data-testid="position-mode-trigger"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              aria-label={`${uiT("Position")}: ${uiT(activeModeMeta.labelKey)}`}
              disabled={!inspecting && modeDisabled}
              className={styles.modeTrigger}
              onClick={() => {
                if (inspecting || !modeDisabled) {
                  setMenuOpen((prev) => !prev);
                }
              }}
            >
              <span>{uiT(activeModeMeta.labelKey)}</span>
              <svg
                width="10"
                height="10"
                viewBox="0 0 12 12"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={styles.modeChevron}
                aria-hidden="true"
              >
                <path d="M3 4.5 6 7.5l3-3" />
              </svg>
            </button>
          </Tooltip>
          {menuOpen && (
            <div
              className={styles.modeMenu}
              role="menu"
              data-testid="position-mode-menu"
            >
              {visibleModes.map((opt) => {
                const isSelected = opt.value === curPosition;
                return (
                  <InspectorChoice aria-pressed={isSelected}
                    key={opt.value}
                    type="button"
                    role="menuitemradio"
                    aria-checked={isSelected}
                    data-testid={`position-mode-option-${opt.cssLabel}`}
                    className={cn(styles.modeOption, {
                      [styles.modeOptionActive]: isSelected,
                    })}
                    onClick={() => handleSelectMode(opt.value)}
                  >
                    <span>{uiT(opt.labelKey)}</span>
                    <span className={styles.modeOptionCss}>{opt.cssLabel}</span>
                  </InspectorChoice>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {isAuto ? (
        <div className={styles.sectionStack}>
          {renderAlignStrip()}
          {showOrderInput ? (
            <div className={styles.twoColRow}>
              {renderIntegerCell({
                prop: "order",
                prefix: "Ord",
                testId: "position-order-input",
                tooltip: uiT("Order"),
                defaultValues: ["0"],
              })}
              {renderIntegerCell({
                prop: "z-index",
                prefix: "Z",
                testId: "position-zindex-input",
                tooltip: uiT("Z-index"),
                defaultValues: ["auto"],
              })}
            </div>
          ) : (
            renderIntegerCell({
              prop: "z-index",
              prefix: uiT("Z-index"),
              testId: "position-zindex-input",
              tooltip: uiT("Z-index"),
              defaultValues: ["auto"],
              fullWidth: true,
            })
          )}
        </div>
      ) : (
        <div className={styles.sectionStack}>
          {isSticky && renderAlignStrip()}
          <div className={styles.constraintsGrid}>
            {renderPinBox()}
            <div className={styles.insetInputsGrid}>
              {EDGE_DISPLAY_ORDER.map((side) => renderInsetCell(side))}
            </div>
          </div>
          {renderIntegerCell({
            prop: "z-index",
            prefix: uiT("Z-index"),
            testId: "position-zindex-input",
            tooltip: uiT("Z-index"),
            defaultValues: ["auto"],
            minVal: isSticky ? 1 : undefined,
            fullWidth: true,
          })}
        </div>
      )}

      {capabilities.transformVisible && (
        <WithContextMenu
          overlay={() => createStyleContextMenu(expsProvider, ["transform"])}
        >
          <div
            className={styles.transformDivider}
            data-testid="position-transform-quickbar"
          >
            <Tooltip title={rotateReason ?? uiT("Rotate")}>
              <div
                className={cn(styles.cellInputWrap, {
                  [styles.cellInputDisabled]: rotateDisabled,
                })}
              >
                <span
                  className={cn(styles.cellPrefix, {
                    [styles.cellScrubHoriz]: !rotateDisabled,
                  })}
                  onMouseDown={
                    rotateDisabled
                      ? undefined
                      : (e) => {
                          startScrub(
                            e,
                            "x",
                            () => transformState.rotateDeg,
                            (delta, startNum) => {
                              applyRotateAngle(startNum + delta);
                            },
                          );
                        }
                  }
                >
                  <AngleSvg />
                </span>
                <InspectorInput
                  data-testid="position-rotate-input"
                  aria-label={uiT("Rotate")}
                  type="text"
                  inputMode="decimal"
                  className={cn(styles.cellField, styles.rotateField)}
                  value={rotateDisplay}
                  disabled={rotateDisabled}
                  onFocus={() => {
                    setDraftKey(rotateKey);
                    setDraftText(String(transformState.rotateDeg));
                  }}
                  onChange={(e) => {
                    setDraftText(e.target.value);
                  }}
                  onBlur={() => {
                    if (draftKey === rotateKey) {
                      setDraftKey(null);
                      const next = Number(draftText.trim() || "0");
                      if (Number.isFinite(next)) {
                        applyRotateAngle(next);
                      }
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.currentTarget.blur();
                    } else if (e.key === "Escape") {
                      setDraftKey(null);
                      e.currentTarget.blur();
                    }
                  }}
                />
                <span className={styles.unitSuffix}>°</span>
              </div>
            </Tooltip>

            <div className={styles.transformActionGroup}>
              <Tooltip title={rotateReason ?? uiT("Rotate 90° clockwise")}>
                <InspectorEdit><button
                  type="button"
                  data-testid="position-rotate-90"
                  aria-label={uiT("Rotate 90° clockwise")}
                  disabled={rotateDisabled}
                  className={styles.iconBtn}
                  onClick={handleRotate90Cw}
                >
                  <RotateCw90Svg />
                </button></InspectorEdit>
              </Tooltip>
              <Tooltip title={rotateReason ?? uiT("Flip horizontal")}>
                <InspectorChoice
                  type="button"
                  data-testid="position-flip-h"
                  aria-label={uiT("Flip horizontal")}
                  aria-pressed={transformState.flippedH}
                  disabled={rotateDisabled}
                  className={cn(styles.iconBtn, {
                    [styles.iconBtnActive]: transformState.flippedH,
                  })}
                  onClick={() => handleToggleFlip("h")}
                >
                  <FlipHorizontalSvg />
                </InspectorChoice>
              </Tooltip>
              <Tooltip title={rotateReason ?? uiT("Flip vertical")}>
                <InspectorChoice
                  type="button"
                  data-testid="position-flip-v"
                  aria-label={uiT("Flip vertical")}
                  aria-pressed={transformState.flippedV}
                  disabled={rotateDisabled}
                  className={cn(styles.iconBtn, {
                    [styles.iconBtnActive]: transformState.flippedV,
                  })}
                  onClick={() => handleToggleFlip("v")}
                >
                  <FlipVerticalSvg />
                </InspectorChoice>
              </Tooltip>
            </div>
          </div>
        </WithContextMenu>
      )}
    </div>
  );
});
