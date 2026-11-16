import { LayoutSpacingControls } from "@/wab/client/components/style-controls/LayoutSpacingControls";
import { WithContextMenu } from "@/wab/client/components/ContextMenu";
import { isTplCodeComponentStyleable } from "@/wab/client/code-components/code-components";
import styles from "@/wab/client/components/style-controls/LayoutCard.module.scss";
import {
  ExpsProvider,
  TplExpsProvider,
  changeStyle,
  createStyleContextMenu,
  getLabelForStyleName,
} from "@/wab/client/components/style-controls/StyleComponent";
import { DimManip } from "@/wab/client/DimManip";
import { useI18n } from "@/wab/client/i18n";
import type { MessageKey } from "@/wab/client/i18n/locales";
import { useGridCssInputs } from "@/wab/client/studio-ctx/grid-css-inputs";
import { useInspectorDom } from "@/wab/client/studio-ctx/inspector-state";
import { useStyleCells, useStyleIndicators } from "@/wab/client/studio-ctx/style-inputs-react";
import { useStylePanelLayoutSnapshot } from "@/wab/client/studio-ctx/style-panel-layout-inputs";
import { useStyleTokenRefs } from "@/wab/client/studio-ctx/style-token-ref-inputs";
import { useVariantedStylesHelperFromCurrentCtx } from "@/wab/client/studio-ctx/varianted-style-context";
import { PublicStyleSection } from "@/wab/shared/ApiSchema";
import { getSlotSelectionContainingTpl } from "@/wab/shared/SlotUtils";
import { VariantedStylesHelper } from "@/wab/shared/VariantedStylesHelper";
import { isPageComponent } from "@/wab/shared/core/components";
import { isSelectableLocked } from "@/wab/shared/core/selection";
import {
  CONTENT_LAYOUT_FULL_BLEED,
  CONTENT_LAYOUT_WIDE,
} from "@/wab/shared/core/style-props";
import { isMarginValidForTpl, isPaddingValidForTpl, isSizeValidForTpl } from "@/wab/shared/core/style-props-tpl";
import {
  isComponentRoot,
  isTplCodeComponent,
  isTplColumn,
  isTplComponent,
  isTplContainer,
  isTplSlot,
  isTplTag,
  resolvesToCodeComponent,
} from "@/wab/shared/core/tpls";
import { parseCssNumericNew } from "@/wab/shared/css";
import {
  Unit,
  createNumericSize,
  ensureUnit,
  showSizeCss,
  tryParseNumericSize,
} from "@/wab/shared/css-size";
import { parseDataUrl, SVG_MEDIA_TYPE } from "@/wab/shared/data-urls";
import {
  getTargetBlockingCombo,
  isIndicatorExplicitlySet,
} from "@/wab/shared/defined-indicator";
import {
  GRID_DEFAULT_TEMPLATE,
  isFlexibleSize,
  isTrackTemplate,
  parseGridTemplateCss,
} from "@/wab/shared/grid-utils";
import {
  ContainerLayoutType,
  convertSelfContainerType,
  getContainerLayoutType,
  getContainerTypeName,
} from "@/wab/shared/layoututils";
import { canEditStyleSection, UiConfig } from "@/wab/shared/ui-config-utils";
import { Menu, Tooltip } from "antd";
import cn from "classnames";
import * as React from "react";
import { useShallow } from "zustand/react/shallow";

export interface LayoutCapabilities {
  visible: boolean;
  sizeVisible: boolean;
  paddingVisible: boolean;
  marginVisible: boolean;
  widthEditable: boolean;
  heightEditable: boolean;
  widthReason?: MessageKey;
  heightReason?: MessageKey;
  constraintsEditable: boolean;
  constraintsReason?: MessageKey;
  flexChildVisible: boolean;
  flexChildEditable: boolean;
  containerVisible: boolean;
  containerEditable: boolean;
  containerReason?: MessageKey;
  allowConvert: boolean;
  allowGridSwitch: boolean;
  isCodeComponentTpl: boolean;
  readOnly: boolean;
  readOnlyReason?: MessageKey;
}

export interface ResolveLayoutCapabilitiesParams {
  expsProvider: ExpsProvider;
  missingPositionClass?: boolean;
  contentEditorMode?: boolean;
  uiConfig?: UiConfig;
  enabledStyleSections?: readonly (PublicStyleSection | string)[] | boolean;
  readOnly?: boolean;
  locked?: boolean;
  ignoreSelectionEditCheck?: boolean;
  allowConvert?: boolean;
  parentContainerType?: string;
}

function isSectionIncluded(
  enabledStyleSections:
    | readonly (PublicStyleSection | string)[]
    | boolean
    | undefined,
  section: PublicStyleSection,
): boolean {
  if (enabledStyleSections === false) {
    return false;
  }
  if (Array.isArray(enabledStyleSections)) {
    return (
      enabledStyleSections as readonly (PublicStyleSection | string)[]
    ).includes(section);
  }
  return true;
}

export function resolveLayoutCapabilities({
  expsProvider,
  missingPositionClass = false,
  contentEditorMode = false,
  uiConfig,
  enabledStyleSections,
  readOnly = false,
  locked,
  ignoreSelectionEditCheck = false,
  allowConvert = true,
  parentContainerType,
}: ResolveLayoutCapabilitiesParams): LayoutCapabilities {
  const hidden: LayoutCapabilities = {
    visible: false,
    sizeVisible: false,
    paddingVisible: false,
    marginVisible: false,
    widthEditable: false,
    heightEditable: false,
    constraintsEditable: false,
    flexChildVisible: false,
    flexChildEditable: false,
    containerVisible: false,
    containerEditable: false,
    allowConvert: false,
    allowGridSwitch: false,
    isCodeComponentTpl: false,
    readOnly: true,
  };

  const studioCanEdit =
    (expsProvider.studioCtx.canEditProject?.() ?? true) &&
    (expsProvider.studioCtx.canEditBranch?.() ?? true);

  if (!(expsProvider instanceof TplExpsProvider)) {
    if (enabledStyleSections === false) {
      return hidden;
    }
    const sizeAllowed = isSectionIncluded(
      enabledStyleSections,
      PublicStyleSection.Sizing,
    );
    const layoutAllowed = isSectionIncluded(
      enabledStyleSections,
      PublicStyleSection.Layout,
    );
    const spacingAllowed = isSectionIncluded(enabledStyleSections, PublicStyleSection.Spacing);
    if (!sizeAllowed && !layoutAllowed && !spacingAllowed) {
      return hidden;
    }
    const effectiveEditable = !readOnly && studioCanEdit;
    const lockReason: MessageKey | undefined = effectiveEditable
      ? undefined
      : "Read-only mode";

    return {
      visible: true,
      sizeVisible: sizeAllowed,
      paddingVisible: spacingAllowed,
      marginVisible: spacingAllowed,
      widthEditable: effectiveEditable && sizeAllowed,
      heightEditable: effectiveEditable && sizeAllowed,
      widthReason: effectiveEditable ? undefined : lockReason,
      heightReason: effectiveEditable ? undefined : lockReason,
      constraintsEditable: effectiveEditable && sizeAllowed,
      constraintsReason: effectiveEditable ? undefined : lockReason,
      flexChildVisible: sizeAllowed,
      flexChildEditable: effectiveEditable && sizeAllowed,
      containerVisible: layoutAllowed,
      containerEditable: effectiveEditable && layoutAllowed,
      containerReason: effectiveEditable ? undefined : lockReason,
      allowConvert,
      allowGridSwitch: true,
      isCodeComponentTpl: false,
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

  const activeUiConfig = uiConfig ?? viewCtx.studioCtx.getCurrentUiConfig();
  const canEditSectionByConfig = (section: PublicStyleSection) =>
    canEditStyleSection(activeUiConfig, section, {
      isContentCreator: contentEditorMode,
      defaultContentEditorVisible: false,
    });

  const isPageRoot =
    isComponentRoot(tpl) && isPageComponent(viewCtx.currentComponent());

  const sizeAllowed =
    !isPageRoot &&
    isSizeValidForTpl(tpl) &&
    canEditSectionByConfig(PublicStyleSection.Sizing) &&
    isSectionIncluded(effectiveStyleSections, PublicStyleSection.Sizing);

  const isContainerOrCodeComp =
    isTplContainer(tpl) || isTplCodeComponent(tpl);
  const containerAllowed =
    isContainerOrCodeComp &&
    canEditSectionByConfig(PublicStyleSection.Layout) &&
    isSectionIncluded(effectiveStyleSections, PublicStyleSection.Layout);

  const spacingAllowed = canEditSectionByConfig(PublicStyleSection.Spacing);
  const paddingVisible = spacingAllowed && isPaddingValidForTpl(tpl, ccRegistry);
  const marginVisible = spacingAllowed && isMarginValidForTpl(tpl);

  if (!sizeAllowed && !containerAllowed && !paddingVisible && !marginVisible) {
    return hidden;
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
      .get(slot.getTpl().component.name)?.meta.props[
      slot.slotParam.variable.name
    ];
  const slotFixedRoot =
    !!slotProp &&
    typeof slotProp === "object" &&
    slotProp.type === "slot" &&
    !!slotProp.fixedRoot;

  const editable = canEdit && !slotFixedRoot;
  const editReason: MessageKey | undefined = !canEdit
    ? nonEditableReason
    : slotFixedRoot
      ? "Fixed slot root does not allow style edits"
      : undefined;

  const isColumn = isTplColumn(tpl);
  const flexChildVisible =
    sizeAllowed &&
    !isColumn &&
    (parentContainerType === ContainerLayoutType.flexRow ||
      parentContainerType === ContainerLayoutType.flexColumn);

  const codeCompTpl = isTplCodeComponent(tpl);
  return {
    visible: true,
    sizeVisible: sizeAllowed,
    paddingVisible,
    marginVisible,
    widthEditable: editable && sizeAllowed,
    heightEditable: editable && sizeAllowed,
    widthReason: editReason ?? (sizeAllowed ? undefined : "Sizing editing is disabled"),
    heightReason: editReason ?? (sizeAllowed ? undefined : "Sizing editing is disabled"),
    constraintsEditable: editable && sizeAllowed && !isColumn,
    constraintsReason: editReason ?? (sizeAllowed ? undefined : "Sizing editing is disabled"),
    flexChildVisible,
    flexChildEditable: editable && flexChildVisible,
    containerVisible: containerAllowed,
    containerEditable: editable && containerAllowed,
    containerReason: editReason ?? (containerAllowed ? undefined : "Layout editing is disabled"),
    allowConvert,
    allowGridSwitch: codeCompTpl,
    isCodeComponentTpl: codeCompTpl,
    readOnly: !editable,
    readOnlyReason: editReason,
  };
}

export const LAYOUT_STYLE_KEYS = [
  "width",
  "height",
  "min-width",
  "max-width",
  "min-height",
  "max-height",
  "aspect-ratio",
  "flex-grow",
  "flex-shrink",
  "flex-basis",
  "display",
  "flex-direction",
  "justify-content",
  "align-items",
  "align-content",
  "flex-wrap",
  "row-gap",
  "column-gap",
  "justify-items",
  "grid-template-columns",
  "grid-row-gap",
  "grid-column-gap",
  "grid-auto-rows",
] as const;

type SizeAxis = "width" | "height";
type ConstraintProp = "min-width" | "min-height" | "max-width" | "max-height";
type MatrixAlignH = "flex-start" | "center" | "flex-end";
type MatrixAlignV = "flex-start" | "center" | "flex-end";

const CONSTRAINT_FIELDS: ReadonlyArray<{
  prop: ConstraintProp;
  labelKey: MessageKey;
  tooltipKey: MessageKey;
  clearVal: "auto" | "none";
}> = [
  { prop: "min-width", labelKey: "MinW", tooltipKey: "Min Width", clearVal: "auto" },
  { prop: "min-height", labelKey: "MinH", tooltipKey: "Min Height", clearVal: "auto" },
  { prop: "max-width", labelKey: "MaxW", tooltipKey: "Max Width", clearVal: "none" },
  { prop: "max-height", labelKey: "MaxH", tooltipKey: "Max Height", clearVal: "none" },
];

const MATRIX_COORDS: ReadonlyArray<{ h: MatrixAlignH; v: MatrixAlignV }> = [
  { v: "flex-start", h: "flex-start" },
  { v: "flex-start", h: "center" },
  { v: "flex-start", h: "flex-end" },
  { v: "center", h: "flex-start" },
  { v: "center", h: "center" },
  { v: "center", h: "flex-end" },
  { v: "flex-end", h: "flex-start" },
  { v: "flex-end", h: "center" },
  { v: "flex-end", h: "flex-end" },
];

const EMPTY_KEYS: readonly string[] = [];

function normalizeDimInput(
  raw: string,
  fallbackUnit: Unit = "px",
): string | undefined {
  const trimmed = raw.trim();
  if (!trimmed) {
    return undefined;
  }
  const lower = trimmed.toLowerCase();
  if (lower === "auto" || lower === "none") {
    return lower;
  }
  if (/^[+-]?(?:\d+\.?\d*|\.\d+)$/.test(trimmed)) {
    return showSizeCss(
      createNumericSize(Math.max(0, Number(trimmed)), fallbackUnit),
    );
  }
  const parsed = tryParseNumericSize(trimmed);
  if (parsed) {
    return showSizeCss(createNumericSize(Math.max(0, parsed.num), parsed.unit));
  }
  return trimmed;
}

function formatCompactDim(raw: string): string {
  const parsed = parseCssNumericNew(raw);
  if (parsed && parsed.units === "px") {
    return `${Math.round(parsed.num * 100) / 100}`;
  }
  return raw;
}

function getSpecialSizeBadge(
  val: string,
  t: (k: MessageKey) => string,
  isDeepContentLayoutChild: boolean,
  prop: SizeAxis,
): string | undefined {
  if (val === "wrap") {
    return t("Hug");
  }
  if (val === "stretch") {
    return prop === "width" && isDeepContentLayoutChild ? t("Standard width") : t("Fill");
  }
  if (val === CONTENT_LAYOUT_WIDE) {
    return t("Wide");
  }
  if (val === CONTENT_LAYOUT_FULL_BLEED) {
    return t("Full bleed");
  }
  if (val === "default") {
    return t("Default");
  }
  return undefined;
}

function FreeFlowIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.25" aria-hidden="true">
      <rect x="2.2" y="2.2" width="11.6" height="11.6" rx="2" strokeDasharray="2.2 1.8" />
      <rect x="5" y="5" width="4.2" height="4.2" rx="0.8" />
    </svg>
  );
}

function ColFlowIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.45" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M8 2.5v11M4.5 9.5 8 13l3.5-3.5" />
    </svg>
  );
}

function RowFlowIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.45" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2.5 8h11M9.5 4.5 13 8l-3.5 3.5" />
    </svg>
  );
}

function GridFlowIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.25" aria-hidden="true">
      <rect x="2.5" y="2.5" width="4.5" height="4.5" rx="1" />
      <rect x="9" y="2.5" width="4.5" height="4.5" rx="1" />
      <rect x="2.5" y="9" width="4.5" height="4.5" rx="1" />
      <rect x="9" y="9" width="4.5" height="4.5" rx="1" />
    </svg>
  );
}

function ChevronDownSvg() {
  return (
    <svg width="9" height="9" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <path d="m3 4.5 3 3 3-3" />
    </svg>
  );
}

function AspectLockSvg({ linked }: { linked: boolean }) {
  if (linked) {
    return (
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M6.6 9.4 4.8 11.2a2.1 2.1 0 0 1-3-3l1.8-1.8a2.1 2.1 0 0 1 3 .2M9.4 6.6l1.8-1.8a2.1 2.1 0 0 1 3 3l-1.8 1.8a2.1 2.1 0 0 1-3-.2" />
        <path d="m6.1 9.9 3.8-3.8" />
      </svg>
    );
  }
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6.3 9.7 4.9 11.1a2.1 2.1 0 0 1-3-3l1.4-1.4a2.1 2.1 0 0 1 3 0M9.7 6.3l1.4-1.4a2.1 2.1 0 0 1 3 3l-1.4 1.4a2.1 2.1 0 0 1-3 0" />
      <path d="M6.4 9.6 9.6 6.4" opacity="0.35" strokeDasharray="1.4 1.8" />
    </svg>
  );
}

function ColGapSvg() {
  return (
    <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" aria-hidden="true">
      <path d="M3.5 3v10M12.5 3v10M8 5v6" />
    </svg>
  );
}

function RowGapSvg() {
  return (
    <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" aria-hidden="true">
      <path d="M3 3.5h10M3 12.5h10M5 8h6" />
    </svg>
  );
}

function SpaceBetweenSvg() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" aria-hidden="true">
      <path d="M2.5 3v10M13.5 3v10" />
      <rect x="4.6" y="5.5" width="2.2" height="5" rx="0.6" fill="currentColor" stroke="none" />
      <rect x="9.2" y="5.5" width="2.2" height="5" rx="0.6" fill="currentColor" stroke="none" />
    </svg>
  );
}

function WrapSvg() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 4.5h8.5a2 2 0 0 1 0 4H5.8" />
      <path d="m7.5 6.8-2 1.7 2 1.7" />
      <path d="M3 12h4.5" />
    </svg>
  );
}

function WrapReverseSvg() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 11.5h8.5a2 2 0 0 0 0-4H5.8" />
      <path d="m7.5 5.8-2 1.7 2 1.7" />
      <path d="M3 4h4.5" />
    </svg>
  );
}

function ReverseItemsSvg({ isRow }: { isRow: boolean }) {
  if (isRow) {
    return (
      <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12.5 5.5H3.5M6 3 3.5 5.5 6 8M3.5 10.5h9M10 8l2.5 2.5L10 13" />
      </svg>
    );
  }
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5.5 3.5v9M3 10l2.5 2.5L8 10M10.5 12.5v-9M8 6l2.5-2.5L13 6" />
    </svg>
  );
}

function MatrixActiveBars({ isRow }: { isRow: boolean }) {
  if (isRow) {
    return (
      <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
        <rect x="4" y="3.5" width="2.2" height="9" rx="0.8" />
        <rect x="7" y="4.8" width="2.2" height="6.4" rx="0.8" />
        <rect x="10" y="3.5" width="2.2" height="9" rx="0.8" />
      </svg>
    );
  }
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <rect x="3.5" y="4" width="9" height="2.2" rx="0.8" />
      <rect x="4.8" y="7" width="6.4" height="2.2" rx="0.8" />
      <rect x="3.5" y="10" width="9" height="2.2" rx="0.8" />
    </svg>
  );
}

export interface LayoutCardProps {
  expsProvider: ExpsProvider;
  capabilities?: LayoutCapabilities;
  vsh?: VariantedStylesHelper;
  readOnly?: boolean;
  allowConvert?: boolean;
}

export const LayoutCard = React.memo(function LayoutCard(props: LayoutCardProps) {
  const { t: uiT } = useI18n();
  const {
    expsProvider,
    vsh: providedVsh,
    readOnly = false,
    allowConvert = true,
  } = props;
  const studioCtx = expsProvider.studioCtx;
  const currentVsh = useVariantedStylesHelperFromCurrentCtx(
    providedVsh ? undefined : studioCtx,
  );
  const vsh = providedVsh ?? currentVsh;

  const [openResizeAxis, setOpenResizeAxis] = React.useState<SizeAxis | null>(null);
  const [aspectLocked, setAspectLocked] = React.useState(false);
  const [flashAxis, setFlashAxis] = React.useState<SizeAxis | null>(null);
  const aspectRatioRef = React.useRef<number | null>(null);
  const [draftValues, setDraftValues] = React.useState<Record<string, string>>({});
  const scrubCleanupRef = React.useRef<(() => void) | null>(null);
  const whRowRef = React.useRef<HTMLDivElement>(null);

  const inspectorDom = useInspectorDom(
    expsProvider instanceof TplExpsProvider ? expsProvider.viewCtx : undefined,
  );
  const resolvedDom = inspectorDom ?? expsProvider.forDom();

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
    if (!openResizeAxis) {
      return;
    }
    const handlePointerDown = (e: MouseEvent) => {
      if (whRowRef.current && !whRowRef.current.contains(e.target as Node)) {
        setOpenResizeAxis(null);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpenResizeAxis(null);
      }
    };
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [openResizeAxis]);

  const layoutSnapshot = useStylePanelLayoutSnapshot(
    expsProvider,
    alive ? LAYOUT_STYLE_KEYS : EMPTY_KEYS,
    alive ? ["display", "flex-direction"] : EMPTY_KEYS,
  );
  const cells = useStyleCells(expsProvider, alive ? LAYOUT_STYLE_KEYS : EMPTY_KEYS);
  const indicators = useStyleIndicators(
    expsProvider,
    alive ? LAYOUT_STYLE_KEYS : EMPTY_KEYS,
  );

  const cellMap = React.useMemo(() => {
    const map = new Map<string, (typeof cells)[number]>();
    for (const c of cells) {
      map.set(c.key, c);
    }
    return map;
  }, [cells]);

  const displayCell = cellMap.get("display");
  const templateCell = cellMap.get("grid-template-columns");
  const gridCss = useGridCssInputs(
    expsProvider,
    {
      display: displayCell?.value,
      hasTemplate: templateCell?.has ?? false,
      template: templateCell?.value,
    },
    lifetime,
  );
  const gridSpec = React.useMemo(
    () => (gridCss.active ? parseGridTemplateCss(gridCss.value) : undefined),
    [gridCss],
  );

  const spacingProps = React.useMemo(
    () =>
      [
        "width",
        "height",
        "min-width",
        "min-height",
        "max-width",
        "max-height",
        "flex-basis",
        "column-gap",
        "row-gap",
        "grid-auto-rows",
        "grid-row-gap",
        "grid-column-gap",
      ] as const,
    [],
  );
  const rawSpacingValues = React.useMemo(
    () => spacingProps.map((k) => cellMap.get(k)?.value ?? ""),
    [spacingProps, cellMap],
  );
  const { selected: selectedTokenRefs } = useStyleTokenRefs(
    studioCtx,
    rawSpacingValues,
    vsh,
    "SpacingOnly",
    useShallow((state) => state.rows.map((row) => row.applied)),
  );
  const tokenMap = React.useMemo(() => {
    const map = new Map<string, (typeof selectedTokenRefs)[number]>();
    spacingProps.forEach((key, idx) => {
      map.set(key, selectedTokenRefs[idx]);
    });
    return map;
  }, [spacingProps, selectedTokenRefs]);

  const setMap = React.useMemo(() => {
    const map = new Map<string, boolean>();
    LAYOUT_STYLE_KEYS.forEach((key, idx) => {
      map.set(key, isIndicatorExplicitlySet(indicators[idx]));
    });
    return map;
  }, [indicators]);

  const blockedMap = React.useMemo(() => {
    const map = new Map<string, boolean>();
    LAYOUT_STYLE_KEYS.forEach((key, idx) => {
      const ind = indicators[idx];
      map.set(key, !!(ind && getTargetBlockingCombo([ind])));
    });
    return map;
  }, [indicators]);

  const capabilities = React.useMemo(
    () =>
      props.capabilities ??
      resolveLayoutCapabilities({
        expsProvider,
        readOnly,
        allowConvert,
        parentContainerType: layoutSnapshot.parentContainerType,
      }),
    [
      props.capabilities,
      expsProvider,
      readOnly,
      allowConvert,
      layoutSnapshot.parentContainerType,
    ],
  );

  if (!alive || !layoutSnapshot.active || !capabilities.visible) {
    return null;
  }

  const tpl =
    expsProvider instanceof TplExpsProvider ? expsProvider.tpl : undefined;
  const component =
    expsProvider instanceof TplExpsProvider
      ? expsProvider.viewCtx.currentComponent()
      : undefined;
  const metadata = layoutSnapshot.layout;
  const isRoot = metadata?.isRoot ?? false;
  const isPageRoot = isRoot && !!component && isPageComponent(component);
  const isDeepContentLayoutChild =
    !!metadata && (metadata.parentIsContentLayout || metadata.isRoot);
  const canSetSpecialSizes = !!tpl;

  const isAxisDisabled = (axis: SizeAxis) =>
    !(axis === "width" ? capabilities.widthEditable : capabilities.heightEditable) ||
    !!blockedMap.get(axis) ||
    (metadata
      ? !(axis === "width" ? metadata.canResizeWidth : metadata.canResizeHeight)
      : false);

  const isPropBlocked = (key: string) => !!blockedMap.get(key);

  const triggerFlash = (axis: SizeAxis) => {
    setFlashAxis(axis);
    window.setTimeout(() => {
      setFlashAxis((prev) => (prev === axis ? null : prev));
    }, 360);
  };

  const widthRaw = cellMap.get("width")?.value ?? "auto";
  const heightRaw = cellMap.get("height")?.value ?? "auto";

  const readNumericSize = (axis: SizeAxis): { num: number; unit: Unit } | undefined => {
    const raw = axis === "width" ? widthRaw : heightRaw;
    const parsed = parseCssNumericNew(raw);
    if (!parsed) {
      return undefined;
    }
    return { num: parsed.num, unit: ensureUnit(parsed.units) || "px" };
  };

  const commitAxisSize = (
    axis: SizeAxis,
    rawInput: string,
    syncAspect: boolean,
  ) => {
    if (isAxisDisabled(axis)) {
      return;
    }
    const existing = readNumericSize(axis);
    const normalized = normalizeDimInput(rawInput, existing?.unit ?? "px");
    if (!normalized) {
      return;
    }
    const otherAxis: SizeAxis = axis === "width" ? "height" : "width";
    const parsedNext = parseCssNumericNew(normalized);
    const shouldSyncOther =
      syncAspect &&
      aspectLocked &&
      aspectRatioRef.current &&
      parsedNext &&
      !isAxisDisabled(otherAxis) &&
      !!readNumericSize(otherAxis);

    changeStyle(expsProvider, () => {
      const exp = expsProvider.targetExp();
      exp.set(axis, normalized);
      if (isDeepContentLayoutChild && axis === "width" && normalized === "wrap") {
        exp.set("justify-self", "flex-start");
      }
      if (shouldSyncOther && parsedNext && aspectRatioRef.current) {
        const otherSize = readNumericSize(otherAxis);
        const computedNum = Math.max(
          1,
          Math.round(
            axis === "width"
              ? parsedNext.num / aspectRatioRef.current
              : parsedNext.num * aspectRatioRef.current,
          ),
        );
        exp.set(
          otherAxis,
          showSizeCss(
            createNumericSize(
              computedNum,
              otherSize?.unit ?? ensureUnit(parsedNext.units),
            ),
          ),
        );
      }
    });
    if (shouldSyncOther) {
      triggerFlash(otherAxis);
    }
  };

  const handleToggleAspectLock = () => {
    if (isAxisDisabled("width") || isAxisDisabled("height")) {
      return;
    }
    if (aspectLocked) {
      setAspectLocked(false);
      aspectRatioRef.current = null;
      return;
    }
    const wNum = readNumericSize("width")?.num;
    const hNum = readNumericSize("height")?.num;
    if (wNum && hNum && hNum > 0) {
      aspectRatioRef.current = wNum / hNum;
    } else if (resolvedDom) {
      const el =
        Array.isArray(resolvedDom)
          ? (resolvedDom[0] as HTMLElement | undefined)
          : ("get" in resolvedDom
              ? (resolvedDom.get(0) as HTMLElement | undefined)
              : (resolvedDom as HTMLElement | undefined));
      const rect = el?.getBoundingClientRect();
      if (rect && rect.width > 0 && rect.height > 0) {
        aspectRatioRef.current = rect.width / rect.height;
      } else {
        aspectRatioRef.current = 1;
      }
    } else {
      aspectRatioRef.current = 1;
    }
    setAspectLocked(true);
  };

  const selectResizeMode = (
    axis: SizeAxis,
    mode: "fixed" | "wrap" | "stretch" | typeof CONTENT_LAYOUT_WIDE | typeof CONTENT_LAYOUT_FULL_BLEED | "default",
  ) => {
    setOpenResizeAxis(null);
    if (isAxisDisabled(axis)) {
      return;
    }
    if (mode === "fixed") {
      if (readNumericSize(axis)) {
        return;
      }
      changeStyle(expsProvider, () => {
        const exp = expsProvider.targetExp();
        let nextVal: string | undefined;
        if (expsProvider instanceof TplExpsProvider) {
          try {
            new DimManip(
              studioCtx,
              resolvedDom,
              () => expsProvider.mergedExp(),
              axis,
            ).trySetUsingMeasured("px");
            nextVal = exp.get(axis);
          } catch {
            nextVal = undefined;
          }
        }
        if (!nextVal || !parseCssNumericNew(nextVal)) {
          exp.set(axis, axis === "width" ? "100px" : "60px");
        }
      });
      return;
    }
    if (mode === "wrap" || mode === "stretch" || mode === CONTENT_LAYOUT_WIDE || mode === CONTENT_LAYOUT_FULL_BLEED) {
      setAspectLocked(false);
      aspectRatioRef.current = null;
    }
    changeStyle(expsProvider, () => {
      const exp = expsProvider.targetExp();
      exp.set(axis, mode);
      if (isDeepContentLayoutChild && axis === "width" && mode === "wrap") {
        exp.set("justify-self", "flex-start");
      }
    });
  };

  const startScrub = (
    e: React.MouseEvent,
    axis: "x" | "y",
    getInitial: () => number,
    onStep: (totalDelta: number, startNum: number) => void,
  ) => {
    if (e.button !== 0) {
      return;
    }
    e.preventDefault();
    scrubCleanupRef.current?.();
    const startCoord = axis === "x" ? e.clientX : e.clientY;
    const startNum = getInitial();
    let moved = false;
    let unlogged = false;

    const handleMove = (mv: MouseEvent) => {
      const coord = axis === "x" ? mv.clientX : mv.clientY;
      const delta = Math.round(coord - startCoord);
      if (!moved && Math.abs(delta) < 2) {
        return;
      }
      if (!moved) {
        moved = true;
        unlogged = true;
        studioCtx.startUnlogged();
      }
      onStep(delta, startNum);
    };

    const cleanup = () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
      if (unlogged) {
        studioCtx.stopUnlogged();
      }
      scrubCleanupRef.current = null;
    };

    const handleUp = () => cleanup();
    scrubCleanupRef.current = cleanup;
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
  };

  const handleScrubAxis = (axis: SizeAxis, e: React.MouseEvent) => {
    if (isAxisDisabled(axis) || tokenMap.get(axis)) {
      return;
    }
    startScrub(
      e,
      axis === "width" ? "x" : "y",
      () => {
        const cur = readNumericSize(axis);
        if (cur) {
          return cur.num;
        }
        return axis === "width" ? 100 : 60;
      },
      (delta, startNum) => {
        const cur = readNumericSize(axis);
        const unit = cur?.unit ?? "px";
        const nextNum = Math.max(0, startNum + delta);
        commitAxisSize(axis, `${nextNum}${unit}`, true);
      },
    );
  };

  const commitDimProp = (
    prop: string,
    rawInput: string,
    opts?: { min?: number; clearValues?: readonly string[]; unitless?: boolean },
  ) => {
    const trimmed = rawInput.trim();
    const min = opts?.min ?? 0;
    const clearValues = opts?.clearValues ?? ["auto", "none"];
    changeStyle(expsProvider, () => {
      const exp = expsProvider.mergedExp();
      if (!trimmed || clearValues.includes(trimmed.toLowerCase())) {
        exp.clear(prop);
        return;
      }
      if (opts?.unitless) {
        const num = Number(trimmed);
        if (!Number.isFinite(num)) {
          return;
        }
        exp.set(prop, String(Math.max(min, num)));
        return;
      }
      const existing = parseCssNumericNew(cellMap.get(prop)?.value ?? "");
      const unit: Unit = (existing && ensureUnit(existing.units)) || "px";
      const normalized = normalizeDimInput(trimmed, unit);
      if (!normalized) {
        exp.clear(prop);
        return;
      }
      const parsed = tryParseNumericSize(normalized);
      if (parsed && parsed.num < min) {
        exp.set(prop, showSizeCss(createNumericSize(min, parsed.unit)));
      } else {
        exp.set(prop, normalized);
      }
    });
  };

  const handleScrubDimProp = (
    prop: string,
    e: React.MouseEvent,
    min = 0,
  ) => {
    if (!capabilities.constraintsEditable || isPropBlocked(prop) || tokenMap.get(prop)) {
      return;
    }
    const existingRaw = cellMap.get(prop)?.value ?? "";
    const parsed = parseCssNumericNew(existingRaw);
    const unit: Unit = (parsed && ensureUnit(parsed.units)) || "px";
    startScrub(
      e,
      "x",
      () => parsed?.num ?? 0,
      (delta, startNum) => {
        const next = Math.max(min, startNum + delta);
        changeStyle(expsProvider, () => {
          expsProvider
            .mergedExp()
            .set(prop, showSizeCss(createNumericSize(next, unit)));
        });
      },
    );
  };

  const renderContextMenu = (prop: string) => () =>
    createStyleContextMenu(expsProvider, [prop], {
      displayStyleName: getLabelForStyleName(prop),
    });

  // Container state
  const hasDisplay = !!displayCell?.has;
  const displayVal = displayCell?.value ?? "";
  const flexDirVal = cellMap.get("flex-direction")?.value ?? "";
  const containerType = getContainerLayoutType(displayVal, flexDirVal);

  const isFlexContainer =
    containerType === ContainerLayoutType.flexRow ||
    containerType === ContainerLayoutType.flexColumn;
  const isRowDir = containerType === ContainerLayoutType.flexRow;
  const isReverse = flexDirVal.endsWith("-reverse");
  const flexWrapVal = cellMap.get("flex-wrap")?.value ?? "nowrap";
  const isWrap = flexWrapVal === "wrap" || flexWrapVal === "wrap-reverse";
  const isWrapReverse = flexWrapVal === "wrap-reverse";

  const justifyContent = cellMap.get("justify-content")?.value ?? "flex-start";
  const alignItems = cellMap.get("align-items")?.value ?? "flex-start";
  const alignContent = cellMap.get("align-content")?.value ?? "flex-start";

  const isSpaceBetween = justifyContent === "space-between";
  const isDistributed =
    justifyContent === "space-between" ||
    justifyContent === "space-around" ||
    justifyContent === "space-evenly";

  const handleContainerTypeChange = (nextType: ContainerLayoutType) => {
    if (!capabilities.containerEditable) {
      return;
    }
    changeStyle(expsProvider, () => {
      if (expsProvider instanceof TplExpsProvider) {
        expsProvider.onContainerTypeChange(nextType);
      } else {
        convertSelfContainerType(expsProvider.mergedExp(), nextType);
      }
    });
  };

  const renderHeaderMenu = () => (
    <Menu>
      {capabilities.allowConvert && expsProvider instanceof TplExpsProvider && (
        <Menu.SubMenu key="convert" title={uiT("Convert to...")}>
          {(containerType === ContainerLayoutType.contentLayout ||
          containerType === ContainerLayoutType.grid
            ? [
                ContainerLayoutType.flexRow,
                ContainerLayoutType.flexColumn,
                ContainerLayoutType.free,
                ContainerLayoutType.grid,
                ContainerLayoutType.contentLayout,
              ]
            : [ContainerLayoutType.grid, ContainerLayoutType.contentLayout]
          )
            .filter((type) => type !== containerType)
            .map((type) => (
              <Menu.Item
                key={type}
                onClick={() => handleContainerTypeChange(type)}
              >
                {getContainerTypeName(type)}
              </Menu.Item>
            ))}
        </Menu.SubMenu>
      )}
    </Menu>
  );

  const handleMatrixCellClick = (
    visualH: MatrixAlignH,
    visualV: MatrixAlignV,
  ) => {
    if (!capabilities.containerEditable) {
      return;
    }
    const flipMain = isReverse;
    const flipCross = isWrapReverse;

    if (isRowDir) {
      const targetMain: MatrixAlignH = flipMain
        ? visualH === "flex-start"
          ? "flex-end"
          : visualH === "flex-end"
            ? "flex-start"
            : "center"
        : visualH;
      const targetCross: MatrixAlignV = flipCross
        ? visualV === "flex-start"
          ? "flex-end"
          : visualV === "flex-end"
            ? "flex-start"
            : "center"
        : visualV;
      changeStyle(expsProvider, () => {
        const exp = expsProvider.mergedExp();
        if (!isDistributed) {
          exp.set("justify-content", targetMain);
        }
        if (isWrap) {
          exp.set("align-content", targetCross);
        } else {
          exp.set("align-items", targetCross);
        }
      });
    } else {
      const targetMain: MatrixAlignV = flipMain
        ? visualV === "flex-start"
          ? "flex-end"
          : visualV === "flex-end"
            ? "flex-start"
            : "center"
        : visualV;
      const targetCross: MatrixAlignH = flipCross
        ? visualH === "flex-start"
          ? "flex-end"
          : visualH === "flex-end"
            ? "flex-start"
            : "center"
        : visualH;
      changeStyle(expsProvider, () => {
        const exp = expsProvider.mergedExp();
        if (!isDistributed) {
          exp.set("justify-content", targetMain);
        }
        if (isWrap) {
          exp.set("align-content", targetCross);
        } else {
          exp.set("align-items", targetCross);
        }
      });
    }
  };

  const activeCrossRaw = isWrap ? alignContent : alignItems;
  const activeVisualH: MatrixAlignH = (() => {
    const raw = isRowDir ? (isDistributed ? "flex-start" : justifyContent) : activeCrossRaw;
    const mapped =
      raw === "flex-end" ? "flex-end" : raw === "center" ? "center" : "flex-start";
    const flip = isRowDir ? isReverse : isWrapReverse;
    if (!flip) {
      return mapped;
    }
    return mapped === "flex-start"
      ? "flex-end"
      : mapped === "flex-end"
        ? "flex-start"
        : "center";
  })();
  const activeVisualV: MatrixAlignV = (() => {
    const raw = isRowDir ? activeCrossRaw : isDistributed ? "flex-start" : justifyContent;
    const mapped =
      raw === "flex-end" ? "flex-end" : raw === "center" ? "center" : "flex-start";
    const flip = isRowDir ? isWrapReverse : isReverse;
    if (!flip) {
      return mapped;
    }
    return mapped === "flex-start"
      ? "flex-end"
      : mapped === "flex-end"
        ? "flex-start"
        : "center";
  })();

  const handleToggleSpaceBetween = () => {
    if (!capabilities.containerEditable || isPropBlocked("justify-content")) {
      return;
    }
    changeStyle(expsProvider, () => {
      expsProvider
        .mergedExp()
        .set("justify-content", isSpaceBetween ? "flex-start" : "space-between");
    });
  };

  const handleToggleWrap = () => {
    if (!capabilities.containerEditable || isPropBlocked("flex-wrap")) {
      return;
    }
    changeStyle(expsProvider, () => {
      const exp = expsProvider.mergedExp();
      if (isWrap) {
        exp.set("flex-wrap", "nowrap");
        exp.set("align-content", alignItems || "unset");
      } else {
        exp.set("flex-wrap", "wrap");
        exp.clear("align-content");
        exp.set("align-items", alignContent || "unset");
      }
    });
  };

  const handleToggleWrapReverse = () => {
    if (!capabilities.containerEditable || isPropBlocked("flex-wrap")) {
      return;
    }
    changeStyle(expsProvider, () => {
      const exp = expsProvider.mergedExp();
      if (!isWrap || !isWrapReverse) {
        exp.set("flex-wrap", "wrap-reverse");
      } else {
        exp.set("flex-wrap", "wrap");
      }
    });
  };

  const handleToggleReverseItems = () => {
    if (!capabilities.containerEditable || isPropBlocked("flex-direction")) {
      return;
    }
    const baseDir = isRowDir ? "row" : "column";
    changeStyle(expsProvider, () => {
      expsProvider
        .mergedExp()
        .set("flex-direction", isReverse ? baseDir : `${baseDir}-reverse`);
    });
  };

  // SVG warning check matching SizeSection
  const uri = metadata?.imageDataUri;
  const isSvg =
    !!uri &&
    (uri.search(/\.svg/) !== -1 ||
      parseDataUrl(uri)?.mediaType === SVG_MEDIA_TYPE);
  const showSvgAlert =
    isSvg && (widthRaw === "wrap" || widthRaw === "auto");

  const aspectCssRaw = cellMap.get("aspect-ratio")?.value ?? "auto";
  const hasExplicitAspectCss = setMap.get("aspect-ratio") && aspectCssRaw !== "auto";

  const renderSizeAxisPill = (axis: SizeAxis) => {
    const raw = axis === "width" ? widthRaw : heightRaw;
    const isWidth = axis === "width";
    const disabled = isAxisDisabled(axis);
    const tokenRef = tokenMap.get(axis);
    const specialBadge = getSpecialSizeBadge(
      raw,
      uiT,
      isDeepContentLayoutChild,
      axis,
    );
    const isDrafting = axis in draftValues;
    const axisDisplayVal = isDrafting
      ? draftValues[axis]
      : specialBadge
        ? ""
        : formatCompactDim(raw);

    const canAutoSize = metadata
      ? isWidth
        ? metadata.canAutoSizeWidth
        : metadata.canAutoSizeHeight
      : true;

    return (
      <WithContextMenu overlay={renderContextMenu(axis)}>
        <div
          className={cn(
            styles.whPill,
            flashAxis === axis && styles.whPillSyncFlash,
            disabled && styles.cellInputDisabled,
          )}
          data-testid={`layout-size-${axis}`}
        >
          <span
            className={cn(
              styles.cellPrefix,
              !disabled && !tokenRef && (isWidth ? styles.cellScrubHoriz : styles.cellScrubVert),
            )}
            onMouseDown={(e) => handleScrubAxis(axis, e)}
            title={uiT(isWidth ? "Width" : "Height")}
          >
            {isWidth ? "W" : "H"}
            {setMap.get(axis) && <span className={styles.setDot} />}
          </span>

          {tokenRef ? (
            <button
              type="button"
              className={styles.tokenBadge}
              disabled={disabled}
              title={tokenRef.name}
              onClick={() => {
                if (!disabled) {
                  setOpenResizeAxis((prev) => (prev === axis ? null : axis));
                }
              }}
            >
              {tokenRef.name}
            </button>
          ) : (
            <input
              aria-label={uiT(isWidth ? "Width" : "Height")}
              type="text"
              className={cn(
                styles.cellField,
                styles.cellFieldRight,
                specialBadge && !isDrafting && styles.cellFieldHidden,
              )}
              disabled={disabled}
              value={axisDisplayVal}
              placeholder={specialBadge ?? "auto"}
              onFocus={() => {
                setDraftValues((prev) => ({
                  ...prev,
                  [axis]: specialBadge ? "" : raw,
                }));
              }}
              onChange={(e) => {
                const next = e.target.value;
                setDraftValues((prev) => ({ ...prev, [axis]: next }));
              }}
              onBlur={() => {
                const draft = draftValues[axis];
                setDraftValues((prev) => {
                  const copy = { ...prev };
                  delete copy[axis];
                  return copy;
                });
                if (draft !== undefined && draft.trim() !== "") {
                  commitAxisSize(axis, draft, true);
                }
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.currentTarget.blur();
                } else if (e.key === "Escape") {
                  setDraftValues((prev) => {
                    const copy = { ...prev };
                    delete copy[axis];
                    return copy;
                  });
                  e.currentTarget.blur();
                }
              }}
            />
          )}

          {specialBadge && !isDrafting && !tokenRef && (
            <span
              className={cn(
                styles.resizeBadge,
                raw === "default" && styles.resizeBadgeMuted,
              )}
              title={specialBadge}
              onClick={(e) => {
                if (!disabled) {
                  e.stopPropagation();
                  setOpenResizeAxis((prev) => (prev === axis ? null : axis));
                }
              }}
            >
              {specialBadge}
            </span>
          )}

          <button
            type="button"
            aria-label={`${uiT(isWidth ? "Width" : "Height")} mode`}
            aria-expanded={openResizeAxis === axis}
            disabled={disabled}
            className={styles.resizeTrigger}
            onClick={(e) => {
              e.stopPropagation();
              setOpenResizeAxis((prev) => (prev === axis ? null : axis));
            }}
          >
            <ChevronDownSvg />
          </button>

          {openResizeAxis === axis && (
            <div
              className={cn(
                styles.resizeMenu,
                isWidth ? styles.resizeMenuLeft : styles.resizeMenuRight,
              )}
              role="menu"
            >
              <div className={styles.menuHeader}>
                {uiT(isWidth ? "Width" : "Height")}
              </div>
              <button
                type="button"
                role="menuitem"
                className={cn(
                  styles.menuOption,
                  !specialBadge && styles.menuOptionActive,
                )}
                onClick={() => selectResizeMode(axis, "fixed")}
              >
                <span className={styles.menuOptionMain}>
                  <span>{uiT("Fixed size")}</span>
                </span>
                <span className={styles.menuOptionCss}>px</span>
              </button>
              {canSetSpecialSizes && (
                <>
                  <button
                    type="button"
                    role="menuitem"
                    disabled={!canAutoSize || raw === "wrap"}
                    className={cn(
                      styles.menuOption,
                      raw === "wrap" && styles.menuOptionActive,
                    )}
                    onClick={() => selectResizeMode(axis, "wrap")}
                  >
                    <span className={styles.menuOptionMain}>
                      <span>{uiT("Hug content")}</span>
                    </span>
                    <span className={styles.menuOptionCss}>auto</span>
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    disabled={raw === "stretch"}
                    className={cn(
                      styles.menuOption,
                      raw === "stretch" && styles.menuOptionActive,
                    )}
                    onClick={() => selectResizeMode(axis, "stretch")}
                  >
                    <span className={styles.menuOptionMain}>
                      <span>
                        {isWidth && isDeepContentLayoutChild && !isRoot
                          ? uiT("Standard width")
                          : uiT("Fill container")}
                      </span>
                    </span>
                    <span className={styles.menuOptionCss}>100%</span>
                  </button>
                  {isWidth && isDeepContentLayoutChild && !isRoot && (
                    <>
                      <button
                        type="button"
                        role="menuitem"
                        disabled={!canAutoSize || raw === CONTENT_LAYOUT_WIDE}
                        className={cn(
                          styles.menuOption,
                          raw === CONTENT_LAYOUT_WIDE && styles.menuOptionActive,
                        )}
                        onClick={() =>
                          selectResizeMode(axis, CONTENT_LAYOUT_WIDE)
                        }
                      >
                        <span className={styles.menuOptionMain}>
                          <span>{uiT("Wide")}</span>
                        </span>
                        <span className={styles.menuOptionCss}>wide</span>
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        disabled={!canAutoSize || raw === CONTENT_LAYOUT_FULL_BLEED}
                        className={cn(
                          styles.menuOption,
                          raw === CONTENT_LAYOUT_FULL_BLEED &&
                            styles.menuOptionActive,
                        )}
                        onClick={() =>
                          selectResizeMode(axis, CONTENT_LAYOUT_FULL_BLEED)
                        }
                      >
                        <span className={styles.menuOptionMain}>
                          <span>{uiT("Full bleed")}</span>
                        </span>
                        <span className={styles.menuOptionCss}>100vw</span>
                      </button>
                    </>
                  )}
                  {tpl && isTplComponent(tpl) && (
                    <button
                      type="button"
                      role="menuitem"
                      className={cn(
                        styles.menuOption,
                        raw === "default" && styles.menuOptionActive,
                      )}
                      onClick={() => selectResizeMode(axis, "default")}
                    >
                      <span className={styles.menuOptionMain}>
                        <span>{uiT("Default")}</span>
                      </span>
                      <span className={styles.menuOptionCss}>default</span>
                    </button>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </WithContextMenu>
    );
  };

  const renderDimInputCell = (opts: {
    prop: string;
    label: string;
    tooltip: string;
    placeholder: string;
    disabled: boolean;
    compact?: boolean;
    muted?: boolean;
    min?: number;
    clearValues?: readonly string[];
    prefixIcon?: React.ReactNode;
    alignRight?: boolean;
    unitless?: boolean;
    hideSetDot?: boolean;
  }) => {
    const {
      prop,
      label,
      tooltip,
      placeholder,
      disabled,
      compact = false,
      muted = false,
      min = 0,
      clearValues = ["auto", "none"],
      prefixIcon,
      alignRight = true,
      unitless = false,
      hideSetDot = false,
    } = opts;
    const cell = cellMap.get(prop);
    const raw = cell?.value ?? "";
    const isSet = !!setMap.get(prop);
    const tokenRef = tokenMap.get(prop);
    const isUnsetValue =
      !isSet ||
      !raw ||
      raw === "auto" ||
      raw === "none" ||
      (clearValues.includes("0px") && raw === "0px");
    const shownVal =
      prop in draftValues
        ? draftValues[prop]
        : isUnsetValue &&
            (prop.startsWith("min-") ||
              prop.startsWith("max-") ||
              unitless ||
              prop === "flex-basis")
          ? ""
          : raw === "auto" || raw === "none"
            ? ""
            : formatCompactDim(raw);

    return (
      <WithContextMenu overlay={renderContextMenu(prop)}>
        <div
          className={cn(
            styles.cellInputWrap,
            compact && styles.cellInputCompact,
            disabled && styles.cellInputDisabled,
            muted && styles.cellInputMuted,
          )}
          title={tooltip}
        >
          <span
            className={cn(
              styles.cellPrefix,
              !disabled && !tokenRef && styles.cellScrubHoriz,
            )}
            onMouseDown={(e) => handleScrubDimProp(prop, e, min)}
          >
            {prefixIcon ?? label}
            {!hideSetDot && isSet && !isUnsetValue && (
              <span className={styles.setDot} />
            )}
          </span>

          {tokenRef ? (
            <button
              type="button"
              className={styles.tokenBadge}
              disabled={disabled}
              title={tokenRef.name}
              onClick={() => {
                if (!disabled) {
                  setDraftValues((prev) => ({ ...prev, [prop]: raw }));
                }
              }}
            >
              {tokenRef.name}
            </button>
          ) : (
            <input
              aria-label={tooltip}
              type="text"
              disabled={disabled}
              value={shownVal}
              placeholder={placeholder}
              className={cn(
                styles.cellField,
                alignRight && styles.cellFieldRight,
              )}
              onFocus={() => {
                setDraftValues((prev) => ({
                  ...prev,
                  [prop]: isUnsetValue ? "" : raw,
                }));
              }}
              onChange={(e) => {
                const next = e.target.value;
                setDraftValues((prev) => ({ ...prev, [prop]: next }));
              }}
              onBlur={() => {
                const draft = draftValues[prop];
                setDraftValues((prev) => {
                  const copy = { ...prev };
                  delete copy[prop];
                  return copy;
                });
                if (draft !== undefined) {
                  commitDimProp(prop, draft, { min, clearValues, unitless });
                }
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.currentTarget.blur();
                } else if (e.key === "Escape") {
                  setDraftValues((prev) => {
                    const copy = { ...prev };
                    delete copy[prop];
                    return copy;
                  });
                  e.currentTarget.blur();
                }
              }}
            />
          )}
        </div>
      </WithContextMenu>
    );
  };

  const renderGridControls = () => {
    if (!gridSpec) {
      return null;
    }
    const templateColumns = gridSpec.gridTemplateColumns || GRID_DEFAULT_TEMPLATE;
    const isFlexible = isFlexibleSize(templateColumns);
    const gridDisabled =
      !capabilities.containerEditable || isPropBlocked("grid-template-columns");

    return (
      <div className={styles.gridControlsBlock} data-testid="layout-grid-controls">
        <div className={styles.gridTypeSwitch}>
          <button
            type="button"
            disabled={gridDisabled}
            className={cn(
              styles.gridTypeBtn,
              !isFlexible && styles.gridTypeBtnActive,
            )}
            title={uiT("Fixed number of columns per row")}
            onClick={() => {
              changeStyle(expsProvider, () => {
                expsProvider
                  .mergedExp()
                  .set("grid-template-columns", "repeat(2, minmax(0, 1fr))");
              });
            }}
          >
            {uiT("Fixed columns")}
          </button>
          <button
            type="button"
            disabled={gridDisabled}
            className={cn(
              styles.gridTypeBtn,
              isFlexible && styles.gridTypeBtnActive,
            )}
            title={uiT(
              "Flexibly fill as many columns as possible per row, as long as each column is larger than some minimum size",
            )}
            onClick={() => {
              changeStyle(expsProvider, () => {
                expsProvider
                  .mergedExp()
                  .set(
                    "grid-template-columns",
                    "repeat(auto-fill, minmax(200px, 1fr))",
                  );
              });
            }}
          >
            {uiT("Fill columns")}
          </button>
        </div>

        <div className={styles.twoColGrid}>
          {isFlexibleSize(templateColumns) ? (
            <div className={styles.cellInputWrap}>
              <span className={styles.cellPrefix}>{uiT("Min Width")}</span>
              <input
                aria-label={uiT("Min Width")}
                type="text"
                disabled={gridDisabled}
                className={cn(styles.cellField, styles.cellFieldRight)}
                value={
                  "grid-minw" in draftValues
                    ? draftValues["grid-minw"]
                    : `${templateColumns.size.num}${templateColumns.size.unit}`
                }
                onFocus={(e) => {
                  setDraftValues((prev) => ({
                    ...prev,
                    "grid-minw": e.currentTarget.value,
                  }));
                }}
                onChange={(e) => {
                  const val = e.target.value;
                  setDraftValues((prev) => ({ ...prev, "grid-minw": val }));
                }}
                onBlur={() => {
                  const raw = draftValues["grid-minw"];
                  setDraftValues((prev) => {
                    const copy = { ...prev };
                    delete copy["grid-minw"];
                    return copy;
                  });
                  if (raw !== undefined) {
                    const normalized = normalizeDimInput(raw, "px") ?? "200px";
                    changeStyle(expsProvider, () => {
                      expsProvider
                        .mergedExp()
                        .set(
                          "grid-template-columns",
                          `repeat(auto-fill, minmax(${normalized}, 1fr))`,
                        );
                    });
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.currentTarget.blur();
                  }
                }}
              />
            </div>
          ) : (
            <div className={styles.cellInputWrap}>
              <span className={styles.cellPrefix}>{uiT("Grid columns")}</span>
              <input
                aria-label={uiT("Grid columns")}
                type="number"
                min={1}
                disabled={gridDisabled}
                className={cn(styles.cellField, styles.cellFieldRight)}
                value={
                  "grid-cols" in draftValues
                    ? draftValues["grid-cols"]
                    : `${
                        isTrackTemplate(templateColumns)
                          ? templateColumns.length
                          : templateColumns.num
                      }`
                }
                onFocus={(e) => {
                  setDraftValues((prev) => ({
                    ...prev,
                    "grid-cols": e.currentTarget.value,
                  }));
                }}
                onChange={(e) => {
                  const val = e.target.value;
                  setDraftValues((prev) => ({ ...prev, "grid-cols": val }));
                  const parsed = parseInt(val, 10);
                  if (Number.isFinite(parsed) && parsed >= 1) {
                    changeStyle(expsProvider, () => {
                      expsProvider
                        .mergedExp()
                        .set(
                          "grid-template-columns",
                          `repeat(${parsed}, minmax(0, 1fr))`,
                        );
                    });
                  }
                }}
                onBlur={() => {
                  const raw = draftValues["grid-cols"];
                  setDraftValues((prev) => {
                    const copy = { ...prev };
                    delete copy["grid-cols"];
                    return copy;
                  });
                  if (raw !== undefined) {
                    const count = Math.max(1, parseInt(raw, 10) || 1);
                    changeStyle(expsProvider, () => {
                      expsProvider
                        .mergedExp()
                        .set(
                          "grid-template-columns",
                          `repeat(${count}, minmax(0, 1fr))`,
                        );
                    });
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.currentTarget.blur();
                  } else if (e.key === "Escape") {
                    setDraftValues((prev) => {
                      const copy = { ...prev };
                      delete copy["grid-cols"];
                      return copy;
                    });
                    e.currentTarget.blur();
                  }
                }}
              />
            </div>
          )}

          {renderDimInputCell({
            prop: "grid-auto-rows",
            label: uiT("Row Height"),
            tooltip: uiT("Row Height"),
            placeholder: "auto",
            disabled: !capabilities.containerEditable || isPropBlocked("grid-auto-rows"),
            min: 1,
          })}
        </div>

        <div className={styles.twoColGrid}>
          {renderDimInputCell({
            prop: "grid-column-gap",
            label: uiT("Col Gap"),
            tooltip: uiT("Col Gap"),
            placeholder: "0",
            disabled: !capabilities.containerEditable || isPropBlocked("grid-column-gap"),
            clearValues: ["auto", "none"],
          })}
          {renderDimInputCell({
            prop: "grid-row-gap",
            label: uiT("Row Gap"),
            tooltip: uiT("Row Gap"),
            placeholder: "0",
            disabled: !capabilities.containerEditable || isPropBlocked("grid-row-gap"),
            clearValues: ["auto", "none"],
          })}
        </div>
      </div>
    );
  };

  const renderJustifyDistMenu = () => (
    <Menu>
      {(
        [
          ["flex-start", uiT("None")],
          ["space-between", uiT("Between")],
          ["space-around", uiT("Around")],
          ["space-evenly", uiT("Evenly")],
        ] as const
      ).map(([val, label]) => (
        <Menu.Item
          key={val}
          onClick={() => {
            if (!capabilities.containerEditable) {
              return;
            }
            changeStyle(expsProvider, () => {
              expsProvider.mergedExp().set("justify-content", val);
            });
          }}
        >
          {label}
        </Menu.Item>
      ))}
    </Menu>
  );

  const renderCrossAlignMenu = () => (
    <Menu>
      {(
        [
          ["flex-start", uiT("Default")],
          ["stretch", uiT("Stretch")],
          ["baseline", uiT("Baseline")],
        ] as const
      ).map(([val, label]) => (
        <Menu.Item
          key={val}
          onClick={() => {
            if (!capabilities.containerEditable) {
              return;
            }
            changeStyle(expsProvider, () => {
              expsProvider
                .mergedExp()
                .set(isWrap ? "align-content" : "align-items", val);
            });
          }}
        >
          {label}
        </Menu.Item>
      ))}
    </Menu>
  );

  return (
    <div
      className={styles.card}
      data-testid="layout-card"
      aria-label={uiT("Layout")}
    >
      {/* Header: Title + Flow Bar */}
      <WithContextMenu overlay={renderHeaderMenu}>
        <div className={styles.header}>
          <div className={styles.titleGroup}>
            <span className={styles.title}>{uiT("Layout")}</span>
            {capabilities.readOnly && (
              <span
                className={styles.readOnlyBadge}
                title={
                  capabilities.readOnlyReason
                    ? uiT(capabilities.readOnlyReason)
                    : undefined
                }
              >
                {uiT("Read-only")}
              </span>
            )}
          </div>

          {capabilities.containerVisible &&
            capabilities.allowConvert &&
            (containerType === ContainerLayoutType.contentLayout ? (
              <span className={styles.docBadge}>{uiT("Document layout")}</span>
            ) : containerType !== ContainerLayoutType.grid ||
              capabilities.allowGridSwitch ? (
              <div className={styles.flowBar} role="group" aria-label={uiT("Layout")}>
                <Tooltip title={uiT("Free")}>
                  <button
                    type="button"
                    data-test-id="layout-free"
                    aria-label={uiT("Free")}
                    aria-pressed={hasDisplay && containerType === ContainerLayoutType.free}
                    disabled={!capabilities.containerEditable}
                    className={cn(
                      styles.flowBtn,
                      hasDisplay &&
                        containerType === ContainerLayoutType.free &&
                        styles.flowBtnActive,
                    )}
                    onClick={() => handleContainerTypeChange(ContainerLayoutType.free)}
                  >
                    <FreeFlowIcon />
                  </button>
                </Tooltip>
                <Tooltip title={uiT("Vertical")}>
                  <button
                    type="button"
                    data-test-id="layout-vstack"
                    aria-label={uiT("Vertical")}
                    aria-pressed={
                      hasDisplay && containerType === ContainerLayoutType.flexColumn
                    }
                    disabled={!capabilities.containerEditable}
                    className={cn(
                      styles.flowBtn,
                      hasDisplay &&
                        containerType === ContainerLayoutType.flexColumn &&
                        styles.flowBtnActive,
                    )}
                    onClick={() =>
                      handleContainerTypeChange(ContainerLayoutType.flexColumn)
                    }
                  >
                    <ColFlowIcon />
                  </button>
                </Tooltip>
                <Tooltip title={uiT("Horizontal")}>
                  <button
                    type="button"
                    data-test-id="layout-hstack"
                    aria-label={uiT("Horizontal")}
                    aria-pressed={
                      hasDisplay && containerType === ContainerLayoutType.flexRow
                    }
                    disabled={!capabilities.containerEditable}
                    className={cn(
                      styles.flowBtn,
                      hasDisplay &&
                        containerType === ContainerLayoutType.flexRow &&
                        styles.flowBtnActive,
                    )}
                    onClick={() =>
                      handleContainerTypeChange(ContainerLayoutType.flexRow)
                    }
                  >
                    <RowFlowIcon />
                  </button>
                </Tooltip>
                {capabilities.allowGridSwitch && (
                  <Tooltip title={uiT("Grid")}>
                    <button
                      type="button"
                      data-test-id="layout-grid"
                      aria-label={uiT("Grid")}
                      aria-pressed={
                        hasDisplay && containerType === ContainerLayoutType.grid
                      }
                      disabled={!capabilities.containerEditable}
                      className={cn(
                        styles.flowBtn,
                        hasDisplay &&
                          containerType === ContainerLayoutType.grid &&
                          styles.flowBtnActive,
                      )}
                      onClick={() =>
                        handleContainerTypeChange(ContainerLayoutType.grid)
                      }
                    >
                      <GridFlowIcon />
                    </button>
                  </Tooltip>
                )}
              </div>
            ) : null)}
        </div>
      </WithContextMenu>

      {showSvgAlert && (
        <div className={styles.svgAlert} role="status">
          {uiT(
            "SVGs have no default size, so setting width to hug or auto will cause it to stretch to fill the parent container.",
          )}
        </div>
      )}

      {/* Size + 2x2 Min/Max Constraints + Optional Flex Child */}
      {capabilities.sizeVisible && (
        <div className={styles.sizeStack}>
          {/* W + animated connection + H + proportion lock */}
          <div ref={whRowRef} className={styles.whDimRow}>
            {renderSizeAxisPill("width")}

            <div className={styles.couplerSlot} aria-hidden="true">
              <svg
                viewBox="0 0 8 28"
                className={cn(
                  styles.coupler,
                  aspectLocked && styles.couplerLinked,
                )}
              >
                <path d="M0 4C0 9 2 10 4 10S8 9 8 4V24C8 19 6 18 4 18S0 19 0 24Z" />
              </svg>
            </div>

            {renderSizeAxisPill("height")}
            <div aria-hidden="true" />

            <WithContextMenu overlay={renderContextMenu("aspect-ratio")}>
              <Tooltip
                title={
                  hasExplicitAspectCss
                    ? `${uiT("Constrain proportions")} (${uiT("Aspect Ratio")}: ${aspectCssRaw})`
                    : uiT("Constrain proportions")
                }
              >
                <button
                  type="button"
                  aria-label={uiT("Constrain proportions")}
                  aria-pressed={aspectLocked}
                  disabled={isAxisDisabled("width") || isAxisDisabled("height")}
                  className={cn(
                    styles.lockBtn,
                    aspectLocked && styles.lockBtnActive,
                  )}
                  onClick={handleToggleAspectLock}
                >
                  <AspectLockSvg linked={aspectLocked} />
                  {hasExplicitAspectCss && (
                    <span className={styles.lockAspectDot} />
                  )}
                </button>
              </Tooltip>
            </WithContextMenu>
          </div>

          {/* Symmetrical 2x2 Min/Max Constraints */}
          {!isPageRoot && (
            <div className={styles.twoColGrid} data-testid="layout-constraints-grid">
              {CONSTRAINT_FIELDS.map((field) =>
                renderDimInputCell({
                  prop: field.prop,
                  label: uiT(field.labelKey),
                  tooltip: uiT(field.tooltipKey),
                  placeholder: uiT("None"),
                  disabled:
                    !capabilities.constraintsEditable ||
                    isPropBlocked(field.prop),
                  clearValues: [field.clearVal, "auto", "none"],
                }),
              )}
            </div>
          )}

          {/* Flex Child Sizing (shown only for Flex children or standalone mixins) */}
          {capabilities.flexChildVisible && (
            <div className={styles.flexChildRow} data-testid="layout-flex-child-row">
              {renderDimInputCell({
                prop: "flex-grow",
                label: uiT("Grow"),
                tooltip: uiT("Grow to fill available space"),
                placeholder: "0",
                disabled:
                  !capabilities.flexChildEditable || isPropBlocked("flex-grow"),
                compact: true,
                unitless: true,
                clearValues: [],
              })}
              {renderDimInputCell({
                prop: "flex-shrink",
                label: uiT("Shrink"),
                tooltip: uiT("Shrink if not enough space"),
                placeholder: "1",
                disabled:
                  !capabilities.flexChildEditable || isPropBlocked("flex-shrink"),
                compact: true,
                unitless: true,
                clearValues: [],
              })}
              {renderDimInputCell({
                prop: "flex-basis",
                label: uiT("Basis"),
                tooltip: uiT("Flex basis"),
                placeholder: "auto",
                disabled:
                  !capabilities.flexChildEditable || isPropBlocked("flex-basis"),
                compact: true,
                clearValues: ["auto"],
              })}
            </div>
          )}
        </div>
      )}

      {/* Container Controls */}
      {capabilities.containerVisible && hasDisplay && (
        <div className={styles.containerDivider}>
          {containerType === ContainerLayoutType.free && (
            <div className={styles.freeHint}>
              {uiT("Children can be freely positioned.")}
            </div>
          )}

          {isFlexContainer && (
            <div
              className={styles.flexControlsBlock}
              data-testid="layout-flex-controls"
            >
              {/* Left 3x3 Alignment Matrix */}
              <WithContextMenu overlay={renderCrossAlignMenu}>
                <div
                  className={styles.alignMatrix}
                  role="grid"
                  aria-label={uiT("Layout")}
                >
                  {MATRIX_COORDS.map((coord) => {
                    const isActive =
                      coord.h === activeVisualH && coord.v === activeVisualV;
                    return (
                      <button
                        key={`${coord.v}-${coord.h}`}
                        type="button"
                        disabled={!capabilities.containerEditable}
                        aria-pressed={isActive}
                        aria-label={`Align ${coord.v} ${coord.h}`}
                        className={cn(
                          styles.matrixCell,
                          isActive && styles.matrixCellActive,
                        )}
                        onClick={() => handleMatrixCellClick(coord.h, coord.v)}
                      >
                        {isActive ? (
                          <MatrixActiveBars isRow={isRowDir} />
                        ) : (
                          <span className={styles.matrixDot} />
                        )}
                      </button>
                    );
                  })}
                </div>
              </WithContextMenu>

              {/* Right 3 Equal-Height Rows */}
              <div className={styles.rightStack}>
                {/* Row 1: Fixed ColGap + RowGap */}
                <div className={styles.gapRow}>
                  {renderDimInputCell({
                    prop: "column-gap",
                    label: "CG",
                    tooltip:
                      !isWrap && !isRowDir
                        ? `${uiT("Column gap")} (${uiT("Allow wrapping")})`
                        : uiT("Column gap"),
                    placeholder: "0",
                    disabled:
                      !capabilities.containerEditable ||
                      isPropBlocked("column-gap"),
                    compact: true,
                    muted: !isWrap && !isRowDir,
                    clearValues: ["auto", "none"],
                    prefixIcon: <ColGapSvg />,
                    alignRight: false,
                    hideSetDot: true,
                  })}
                  {renderDimInputCell({
                    prop: "row-gap",
                    label: "RG",
                    tooltip:
                      !isWrap && isRowDir
                        ? `${uiT("Row gap")} (${uiT("Allow wrapping")})`
                        : uiT("Row gap"),
                    placeholder: "0",
                    disabled:
                      !capabilities.containerEditable || isPropBlocked("row-gap"),
                    compact: true,
                    muted: !isWrap && isRowDir,
                    clearValues: ["auto", "none"],
                    prefixIcon: <RowGapSvg />,
                    alignRight: false,
                    hideSetDot: true,
                  })}
                </div>

                {/* Row 2: Space Between toggle (+ context menu for Around / Evenly) */}
                <WithContextMenu overlay={renderJustifyDistMenu}>
                  <div className={styles.betweenWrap}>
                    <Tooltip title={uiT("Space between")}>
                      <button
                        type="button"
                        aria-pressed={isDistributed}
                        disabled={
                          !capabilities.containerEditable ||
                          isPropBlocked("justify-content")
                        }
                        className={cn(
                          styles.betweenBtn,
                          isDistributed && styles.betweenBtnActive,
                        )}
                        onClick={handleToggleSpaceBetween}
                      >
                        <span className={styles.betweenMain}>
                          <SpaceBetweenSvg />
                          <span className={styles.betweenLabel}>
                            {justifyContent === "space-around"
                              ? uiT("Around")
                              : justifyContent === "space-evenly"
                                ? uiT("Evenly")
                                : uiT("Between")}
                          </span>
                        </span>
                        <span className={styles.betweenState}>
                          {isDistributed ? uiT("On") : uiT("Off")}
                        </span>
                      </button>
                    </Tooltip>
                  </div>
                </WithContextMenu>

                {/* Row 3: Fixed 3 equal icon-only buttons */}
                <div className={styles.actionRow}>
                  <Tooltip title={uiT("Allow wrapping")}>
                    <button
                      type="button"
                      aria-label={uiT("Wrap")}
                      aria-pressed={isWrap}
                      disabled={
                        !capabilities.containerEditable ||
                        isPropBlocked("flex-wrap")
                      }
                      className={cn(
                        styles.iconBtn,
                        isWrap && styles.iconBtnActive,
                      )}
                      onClick={handleToggleWrap}
                    >
                      <WrapSvg />
                    </button>
                  </Tooltip>
                  <Tooltip title={uiT("Wrap reverse")}>
                    <button
                      type="button"
                      aria-label={uiT("Wrap reverse")}
                      aria-pressed={isWrapReverse}
                      disabled={
                        !capabilities.containerEditable ||
                        isPropBlocked("flex-wrap")
                      }
                      className={cn(
                        styles.iconBtn,
                        !isWrap && !isWrapReverse && styles.iconBtnMuted,
                        isWrapReverse && styles.iconBtnActive,
                      )}
                      onClick={handleToggleWrapReverse}
                    >
                      <WrapReverseSvg />
                    </button>
                  </Tooltip>
                  <Tooltip title={uiT("Reverse items")}>
                    <button
                      type="button"
                      aria-label={uiT("Reverse items")}
                      aria-pressed={isReverse}
                      disabled={
                        !capabilities.containerEditable ||
                        isPropBlocked("flex-direction")
                      }
                      className={cn(
                        styles.iconBtn,
                        isReverse && styles.iconBtnActive,
                      )}
                      onClick={handleToggleReverseItems}
                    >
                      <ReverseItemsSvg isRow={isRowDir} />
                    </button>
                  </Tooltip>
                </div>
              </div>
            </div>
          )}

          {containerType === ContainerLayoutType.grid && renderGridControls()}

          {containerType === ContainerLayoutType.contentLayout && (
            <div
              className={styles.twoColGrid}
              data-testid="layout-content-controls"
            >
              {renderDimInputCell({
                prop: "grid-row-gap",
                label: uiT("Gap"),
                tooltip: uiT("Gap"),
                placeholder: "0",
                disabled:
                  !capabilities.containerEditable ||
                  isPropBlocked("grid-row-gap"),
                clearValues: ["auto", "none"],
              })}
              <div className={styles.cellInputWrap}>
                <span className={styles.cellPrefix}>{uiT("Align")}</span>
                <span className={styles.betweenState}>
                  {cellMap.get("justify-items")?.value ?? "stretch"}
                </span>
              </div>
            </div>
          )}
        </div>
      )}
      {(capabilities.paddingVisible || capabilities.marginVisible) && (
        <LayoutSpacingControls
          expsProvider={expsProvider}
          vsh={vsh}
          paddingVisible={capabilities.paddingVisible}
          marginVisible={capabilities.marginVisible}
          readOnly={capabilities.readOnly}
        />
      )}
    </div>
  );
});
