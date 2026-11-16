import { isTplCodeComponentStyleable } from "@/wab/client/code-components/code-components";
import { WithContextMenu } from "@/wab/client/components/ContextMenu";
import type { VisibilityController } from "@/wab/client/components/sidebar-tabs/VisibilitySection";
import styles from "@/wab/client/components/style-controls/AppearanceCard.module.scss";
import {
  ExpsProvider,
  TplExpsProvider,
  changeStyle,
  createStyleContextMenu,
} from "@/wab/client/components/style-controls/StyleComponent";
import { useI18n } from "@/wab/client/i18n";
import type { MessageKey } from "@/wab/client/i18n/locales";
import {
  useStyleCells,
  useStyleIndicators,
} from "@/wab/client/studio-ctx/style-inputs-react";
import { useStyleTokenRefs } from "@/wab/client/studio-ctx/style-token-ref-inputs";
import { useVariantedStylesHelperFromCurrentCtx } from "@/wab/client/studio-ctx/varianted-style-context";
import { PublicStyleSection } from "@/wab/shared/ApiSchema";
import { VariantedStylesHelper } from "@/wab/shared/VariantedStylesHelper";
import { isSelectableLocked } from "@/wab/shared/core/selection";
import { isOverflowValidForTpl } from "@/wab/shared/core/style-props-tpl";
import {
  isTplCodeComponent,
  isTplComponent,
  isTplSlot,
  isTplTag,
} from "@/wab/shared/core/tpls";
import {
  getCssInitial,
  parseCssNumericNew,
  parseCssShorthand,
  showCssShorthand,
} from "@/wab/shared/css";
import {
  Unit,
  createNumericSize,
  ensureUnit,
  showSizeCss,
  tryParseNumericSize,
} from "@/wab/shared/css-size";
import {
  getTargetBlockingCombo,
  isIndicatorExplicitlySet,
} from "@/wab/shared/defined-indicator";
import { Corner, standardCorners } from "@/wab/shared/geom";
import { canEditStyleSection, UiConfig } from "@/wab/shared/ui-config-utils";
import { TplVisibility, getVisibilityLabel } from "@/wab/shared/visibility-utils";
import { Scrollbar } from "@shiguang2/components/esm/scrollbar";
import { Dropdown, Menu, Tooltip } from "antd";
import cn from "classnames";
import * as React from "react";
import { useShallow } from "zustand/react/shallow";

export interface AppearanceCapabilities {
  visible: boolean;
  visibilityVisible: boolean;
  visibilityEditable: boolean;
  visibilityReason?: MessageKey;
  opacityVisible: boolean;
  opacityEditable: boolean;
  opacityReason?: MessageKey;
  radiusVisible: boolean;
  radiusEditable: boolean;
  radiusReason?: MessageKey;
  overflowVisible: boolean;
  overflowEditable: boolean;
  overflowReason?: MessageKey;
  blendVisible: boolean;
  blendEditable: boolean;
  blendReason?: MessageKey;
  readOnly: boolean;
  readOnlyReason?: MessageKey;
}

export interface ResolveAppearanceCapabilitiesParams {
  expsProvider: ExpsProvider;
  canToggleVisibility?: boolean;
  missingPositionClass?: boolean;
  contentEditorMode?: boolean;
  uiConfig?: UiConfig;
  enabledStyleSections?: readonly (PublicStyleSection | string)[] | boolean;
  readOnly?: boolean;
  locked?: boolean;
  ignoreSelectionEditCheck?: boolean;
}

const APPEARANCE_CORNER_PROPS = standardCorners.map(
  (corner) => `border-${corner}-radius` as const,
);

export const APPEARANCE_STYLE_KEYS = [
  "opacity",
  ...APPEARANCE_CORNER_PROPS,
  "overflow",
  "overflow-x",
  "overflow-y",
  "mix-blend-mode",
] as const;

const MIX_BLEND_MODE_GROUPS: readonly {
  labelKey: MessageKey;
  items: readonly { value: string; labelKey: MessageKey }[];
}[] = [
  {
    labelKey: "Basic",
    items: [{ value: "normal", labelKey: "Normal" }],
  },
  {
    labelKey: "Darken",
    items: [
      { value: "darken", labelKey: "Darken" },
      { value: "multiply", labelKey: "Multiply" },
      { value: "color-burn", labelKey: "Color burn" },
    ],
  },
  {
    labelKey: "Lighten",
    items: [
      { value: "lighten", labelKey: "Lighten" },
      { value: "screen", labelKey: "Screen" },
      { value: "color-dodge", labelKey: "Color dodge" },
    ],
  },
  {
    labelKey: "Contrast",
    items: [
      { value: "overlay", labelKey: "Blend overlay" },
      { value: "soft-light", labelKey: "Soft light" },
      { value: "hard-light", labelKey: "Hard light" },
    ],
  },
  {
    labelKey: "Inversion",
    items: [
      { value: "difference", labelKey: "Difference" },
      { value: "exclusion", labelKey: "Exclusion" },
    ],
  },
  {
    labelKey: "Color",
    items: [
      { value: "hue", labelKey: "Hue" },
      { value: "saturation", labelKey: "Saturation" },
      { value: "color", labelKey: "Color" },
      { value: "luminosity", labelKey: "Luminosity" },
    ],
  },
];

const MIX_BLEND_MODE_LABEL_MAP = new Map<string, MessageKey>(
  MIX_BLEND_MODE_GROUPS.flatMap((group) =>
    group.items.map((item) => [item.value, item.labelKey] as const),
  ),
);

const CORNER_PREFIX_LABELS: Record<Corner, MessageKey> = {
  "top-left": "Top-left corner",
  "top-right": "Top-right corner",
  "bottom-left": "Bottom-left corner",
  "bottom-right": "Bottom-right corner",
};

function isSectionIncluded(
  enabledStyleSections:
    | readonly (PublicStyleSection | string)[]
    | boolean
    | undefined,
  section: PublicStyleSection,
  uiConfig: UiConfig | undefined,
  contentEditorMode = false,
): boolean {
  if (enabledStyleSections === false) {
    return false;
  }
  if (Array.isArray(enabledStyleSections) && !enabledStyleSections.includes(section)) {
    return false;
  }
  if (uiConfig) {
    return canEditStyleSection(uiConfig, section, {
      isContentCreator: contentEditorMode,
      defaultContentEditorVisible: false,
    });
  }
  return !contentEditorMode;
}

export function resolveAppearanceCapabilities(
  params: ResolveAppearanceCapabilitiesParams,
): AppearanceCapabilities {
  const {
    expsProvider,
    canToggleVisibility = false,
    missingPositionClass = false,
    contentEditorMode = false,
    uiConfig,
    enabledStyleSections,
    readOnly = false,
    locked,
    ignoreSelectionEditCheck = false,
  } = params;

  const studioCtx = expsProvider.studioCtx;
  const effectiveUiConfig = uiConfig ?? studioCtx.getCurrentUiConfig();
  const isTpl = expsProvider instanceof TplExpsProvider;
  const tpl = isTpl ? expsProvider.tpl : undefined;
  const viewCtx = isTpl ? expsProvider.viewCtx : undefined;

  const isCodeComp = tpl ? isTplCodeComponent(tpl) : false;
  const codeCompStyleable =
    !tpl ||
    !isTplCodeComponent(tpl) ||
    isTplCodeComponentStyleable(studioCtx.codeComponentsRegistry, tpl);
  const codeCompMeta =
    viewCtx && tpl && isTplCodeComponent(tpl)
      ? viewCtx.getTplCodeComponentMeta(tpl)
      : undefined;
  const ccStyleSections = codeCompMeta?.styleSections;

  const rawSectionEnabled = (section: PublicStyleSection): boolean => {
    if (!codeCompStyleable) {
      return false;
    }
    if (
      Array.isArray(ccStyleSections) &&
      !(ccStyleSections as readonly (PublicStyleSection | string)[]).includes(
        section,
      )
    ) {
      return false;
    }
    return isSectionIncluded(
      enabledStyleSections,
      section,
      effectiveUiConfig,
      contentEditorMode,
    );
  };

  const visibilityEnabled = rawSectionEnabled(PublicStyleSection.Visibility);
  const borderEnabled = rawSectionEnabled(PublicStyleSection.Border);
  const overflowEnabled = rawSectionEnabled(PublicStyleSection.Overflow);
  const effectsEnabled = rawSectionEnabled(PublicStyleSection.Effects);

  const isTag = tpl ? isTplTag(tpl) : true;
  const isComp = tpl ? isTplComponent(tpl) : false;
  const isSlot = tpl ? isTplSlot(tpl) : false;
  const isTagOrCodeComponent = isTag || (isComp && isCodeComp && codeCompStyleable);
  const canStyleOpacity = !isSlot && (isTag || isComp) && codeCompStyleable;
  const canOverflow = tpl ? isOverflowValidForTpl(tpl) : true;

  const visibilityVisible = isTpl && canToggleVisibility && visibilityEnabled;
  const opacityVisible = canStyleOpacity && visibilityEnabled;
  const radiusVisible = isTagOrCodeComponent && borderEnabled;
  const overflowVisible = canOverflow && overflowEnabled;
  const blendVisible = isTagOrCodeComponent && effectsEnabled;

  const focusedSelectable = viewCtx?.focusedSelectable?.();
  const inferredLocked =
    viewCtx &&
    focusedSelectable &&
    "tpl" in focusedSelectable &&
    focusedSelectable.tpl === tpl &&
    viewCtx.valState
      ? isSelectableLocked(focusedSelectable, viewCtx.valState())
      : false;
  const selectableLocked = locked ?? (!ignoreSelectionEditCheck && inferredLocked);

  const studioCanEdit =
    (studioCtx.canEditProject?.() ?? true) &&
    (studioCtx.canEditBranch?.() ?? true);
  const providerEditable = ignoreSelectionEditCheck
    ? true
    : isTpl
      ? expsProvider.canEdit()
      : true;

  let readOnlyReason: MessageKey | undefined;
  if (readOnly || !studioCanEdit) {
    readOnlyReason = "Read-only mode";
  } else if (selectableLocked) {
    readOnlyReason = "Element is locked";
  } else if (missingPositionClass || !providerEditable) {
    readOnlyReason = "Appearance controls are read-only";
  }

  const editable =
    !readOnly &&
    studioCanEdit &&
    !selectableLocked &&
    !missingPositionClass &&
    providerEditable;

  const visible =
    visibilityVisible ||
    opacityVisible ||
    radiusVisible ||
    overflowVisible ||
    blendVisible;

  return {
    visible,
    visibilityVisible,
    visibilityEditable: editable && visibilityVisible,
    visibilityReason: !editable ? readOnlyReason : undefined,
    opacityVisible,
    opacityEditable: editable && opacityVisible,
    opacityReason: !editable ? readOnlyReason : undefined,
    radiusVisible,
    radiusEditable: editable && radiusVisible,
    radiusReason: !editable ? readOnlyReason : undefined,
    overflowVisible,
    overflowEditable: editable && overflowVisible,
    overflowReason: !editable ? readOnlyReason : undefined,
    blendVisible,
    blendEditable: editable && blendVisible,
    blendReason: !editable ? readOnlyReason : undefined,
    readOnly: !editable,
    readOnlyReason,
  };
}

function EyeOpenSvg() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M1.5 8s2.5-4.5 6.5-4.5S14.5 8 14.5 8s-2.5 4.5-6.5 4.5S1.5 8 1.5 8Z" />
      <circle cx="8" cy="8" r="2" />
    </svg>
  );
}

function EyeOffSvg() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M2 2l12 12" />
      <path d="M6.5 6.6a2 2 0 0 0 2.9 2.9" />
      <path d="M10.8 11.4A6.7 6.7 0 0 1 8 12.5C4 12.5 1.5 8 1.5 8a11 11 0 0 1 2.7-3.3" />
      <path d="M7.2 3.6A7.3 7.3 0 0 1 8 3.5c4 0 6.5 4.5 6.5 4.5a11.2 11.2 0 0 1-1.9 2.6" />
    </svg>
  );
}

function BlendDropSvg() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M8 2.2C8 2.2 3.5 7 3.5 10a4.5 4.5 0 0 0 9 0C12.5 7 8 2.2 8 2.2Z" />
    </svg>
  );
}

function OpacitySvg() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
    >
      <rect x="2.5" y="2.5" width="11" height="11" rx="2" />
      <path d="M8 2.5v11" />
      <path d="M8 5l3-2.5M8 8l5.5-4.5M8 11l5.5-4.5M9.5 13.5L13.5 10" strokeWidth="1" opacity="0.7" />
    </svg>
  );
}

function CornerArcSvg() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
    >
      <path d="M3 13V7a4 4 0 0 1 4-4h6" />
    </svg>
  );
}

function IndividualCornersSvg() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
    >
      <path d="M2.5 6V3.5a1 1 0 0 1 1-1H6M10 2.5h2.5a1 1 0 0 1 1 1V6M13.5 10v2.5a1 1 0 0 1-1 1H10M6 13.5H3.5a1 1 0 0 1-1-1V10" />
    </svg>
  );
}

function CornerMarkSvg({ corner }: { corner: Corner }) {
  const rotation: Record<Corner, string> = {
    "top-left": "rotate(0deg)",
    "top-right": "rotate(90deg)",
    "bottom-right": "rotate(180deg)",
    "bottom-left": "rotate(-90deg)",
  };
  return (
    <svg
      width="11"
      height="11"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      style={{ transform: rotation[corner] }}
    >
      <path d="M4 12V7a3 3 0 0 1 3-3h5" />
    </svg>
  );
}

function ChevronDownSvg() {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4.5 6.5L8 10l3.5-3.5" />
    </svg>
  );
}

function formatCompactDim(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) {
    return "";
  }
  const parsed = parseCssNumericNew(trimmed);
  if (!parsed) {
    return trimmed;
  }
  if (parsed.units === "px" || !parsed.units) {
    return `${parsed.num}`;
  }
  return `${parsed.num}${parsed.units}`;
}

function formatOpacityPct(raw: string): string {
  const parsed = parseFloat(raw);
  if (!Number.isFinite(parsed)) {
    return "100";
  }
  return String(Math.min(100, Math.max(0, Math.round(parsed * 100))));
}

function normalizeDimInput(
  rawInput: string,
  defaultUnit: Unit = "px",
  min = 0,
): string | undefined {
  const trimmed = rawInput.trim();
  if (!trimmed) {
    return undefined;
  }
  const numeric = tryParseNumericSize(trimmed);
  if (numeric) {
    const clamped = Math.max(min, numeric.num);
    return showSizeCss(createNumericSize(clamped, numeric.unit));
  }
  const bare = parseCssNumericNew(trimmed);
  if (bare) {
    const clamped = Math.max(min, bare.num);
    const unit = ensureUnit(bare.units || defaultUnit);
    return showSizeCss(createNumericSize(clamped, unit));
  }
  return trimmed;
}

export interface AppearanceCardProps {
  expsProvider: ExpsProvider;
  visibilityController?: VisibilityController;
  capabilities?: AppearanceCapabilities;
  vsh?: VariantedStylesHelper;
  missingPositionClass?: boolean;
  contentEditorMode?: boolean;
  enabledStyleSections?: readonly (PublicStyleSection | string)[] | boolean;
  readOnly?: boolean;
  ignoreSelectionEditCheck?: boolean;
}

export const AppearanceCard = React.memo(function AppearanceCard(
  props: AppearanceCardProps,
) {
  const { expsProvider, visibilityController } = props;
  const { t: uiT } = useI18n();
  const studioCtx = expsProvider.studioCtx;
  const fallbackVsh = useVariantedStylesHelperFromCurrentCtx(
    props.vsh ? undefined : studioCtx,
  );
  const vsh = props.vsh ?? fallbackVsh;

  const cells = useStyleCells(expsProvider, APPEARANCE_STYLE_KEYS);
  const indicators = useStyleIndicators(expsProvider, APPEARANCE_STYLE_KEYS);

  const cellMap = React.useMemo(() => {
    const map = new Map<string, (typeof cells)[number]>();
    APPEARANCE_STYLE_KEYS.forEach((key, idx) => {
      map.set(key, cells[idx]);
    });
    return map;
  }, [cells]);

  const setMap = React.useMemo(() => {
    const map = new Map<string, boolean>();
    APPEARANCE_STYLE_KEYS.forEach((key, idx) => {
      map.set(key, isIndicatorExplicitlySet(indicators[idx]));
    });
    return map;
  }, [indicators]);

  const blockedMap = React.useMemo(() => {
    const map = new Map<string, boolean>();
    APPEARANCE_STYLE_KEYS.forEach((key, idx) => {
      const ind = indicators[idx];
      map.set(key, !!(ind && getTargetBlockingCombo([ind])));
    });
    return map;
  }, [indicators]);

  const capabilities = React.useMemo(
    () =>
      props.capabilities ??
      resolveAppearanceCapabilities({
        expsProvider,
        canToggleVisibility: !!visibilityController,
        missingPositionClass: props.missingPositionClass,
        contentEditorMode: props.contentEditorMode,
        enabledStyleSections: props.enabledStyleSections,
        readOnly: props.readOnly,
        ignoreSelectionEditCheck: props.ignoreSelectionEditCheck,
      }),
    [
      props.capabilities,
      expsProvider,
      visibilityController,
      props.missingPositionClass,
      props.contentEditorMode,
      props.enabledStyleSections,
      props.readOnly,
      props.ignoreSelectionEditCheck,
    ],
  );

  const opacityRaw = cellMap.get("opacity")?.value ?? "";
  const cornerRaws = React.useMemo(
    () => APPEARANCE_CORNER_PROPS.map((prop) => cellMap.get(prop)?.value ?? ""),
    [cellMap],
  );

  const { selected: opacityTokenRefs } = useStyleTokenRefs(
    studioCtx,
    [opacityRaw],
    vsh,
    "allHead",
    useShallow((state) => state.rows.map((row) => row.applied)),
  );
  const { selected: cornerTokenRefs } = useStyleTokenRefs(
    studioCtx,
    cornerRaws,
    vsh,
    "SpacingOnly",
    useShallow((state) => state.rows.map((row) => row.applied)),
  );

  const cornerTokenMap = React.useMemo(() => {
    const map = new Map<string, (typeof cornerTokenRefs)[number]>();
    APPEARANCE_CORNER_PROPS.forEach((prop, idx) => {
      map.set(prop, cornerTokenRefs[idx]);
    });
    return map;
  }, [cornerTokenRefs]);

  const hasMixedCorners = React.useMemo(
    () => cornerRaws.some((val) => val !== cornerRaws[0]),
    [cornerRaws],
  );
  const selectionKey =
    expsProvider instanceof TplExpsProvider
      ? expsProvider.tpl.uuid
      : expsProvider.targetRs().uid;

  const [cornersExpanded, setCornersExpanded] = React.useState(hasMixedCorners);
  const [blendOpen, setBlendOpen] = React.useState(false);
  React.useEffect(() => {
    setCornersExpanded(hasMixedCorners);
  }, [selectionKey, hasMixedCorners]);

  const [draftValues, setDraftValues] = React.useState<Record<string, string>>(
    {},
  );
  const scrubRef = React.useRef<{ cleanup: () => void } | null>(null);
  React.useEffect(() => {
    return () => {
      scrubRef.current?.cleanup();
      scrubRef.current = null;
    };
  }, []);

  if (!capabilities.visible) {
    return null;
  }

  const isPropBlocked = (prop: string) => !!blockedMap.get(prop);

  const renderContextMenu = (prop: string | string[]) => {
    const propsList = Array.isArray(prop) ? prop : [prop];
    return () =>
      createStyleContextMenu(expsProvider, propsList, {
        displayStyleName: propsList[0],
      });
  };

  // --- Opacity ---
  const opacityTokenRef = opacityTokenRefs[0];
  const opacitySet = !!setMap.get("opacity");
  const opacityDisabled = !capabilities.opacityEditable || isPropBlocked("opacity");
  const opacityPctText =
    "opacity" in draftValues
      ? draftValues.opacity
      : opacitySet && opacityRaw
        ? formatOpacityPct(opacityRaw)
        : "";

  const commitOpacityPct = (rawInput: string) => {
    if (opacityDisabled) {
      return;
    }
    const trimmed = rawInput.trim().replace(/%$/, "");
    changeStyle(expsProvider, () => {
      const exp = expsProvider.mergedExp();
      if (!trimmed) {
        exp.clear("opacity");
        return;
      }
      const parsed = Number(trimmed);
      if (Number.isFinite(parsed)) {
        const clampedPct = Math.min(100, Math.max(0, Math.round(parsed)));
        exp.set("opacity", String(clampedPct / 100));
      } else {
        exp.set("opacity", trimmed);
      }
    });
  };

  const handleScrubOpacity = (e: React.MouseEvent<HTMLSpanElement>) => {
    if (opacityDisabled || opacityTokenRef || e.button !== 0) {
      return;
    }
    e.preventDefault();
    scrubRef.current?.cleanup();

    const startX = e.clientX;
    const basePct = opacitySet && opacityRaw ? Number(formatOpacityPct(opacityRaw)) : 100;
    const initialPct = Number.isFinite(basePct) ? basePct : 100;

    const handleMove = (moveEvt: MouseEvent) => {
      const delta = Math.round((moveEvt.clientX - startX) / 2);
      const next = Math.min(100, Math.max(0, initialPct + delta));
      changeStyle(expsProvider, () => {
        expsProvider.mergedExp().set("opacity", String(next / 100));
      });
    };
    const cleanup = () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", cleanup);
      scrubRef.current = null;
    };
    scrubRef.current = { cleanup };
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", cleanup, { once: true });
  };

  // --- Corner Radius ---
  const radiusDisabled =
    !capabilities.radiusEditable ||
    APPEARANCE_CORNER_PROPS.some((p) => isPropBlocked(p));
  const anyCornerSet = APPEARANCE_CORNER_PROPS.some((p) => !!setMap.get(p));
  const unifiedTokenRef = !hasMixedCorners ? cornerTokenRefs[0] : undefined;
  const unifiedShorthand = showCssShorthand(cornerRaws);
  const isUnifiedUnset =
    !hasMixedCorners &&
    (!anyCornerSet || !cornerRaws[0] || cornerRaws[0] === "0px");
  const shownUnifiedRadius =
    "radius-all" in draftValues
      ? draftValues["radius-all"]
      : hasMixedCorners
        ? ""
        : isUnifiedUnset
          ? ""
          : formatCompactDim(unifiedShorthand || cornerRaws[0]);

  const commitCornerProp = (prop: string, rawInput: string) => {
    if (radiusDisabled || isPropBlocked(prop)) {
      return;
    }
    const trimmed = rawInput.trim();
    changeStyle(expsProvider, () => {
      const exp = expsProvider.mergedExp();
      if (!trimmed) {
        exp.clear(prop);
        return;
      }
      const normalized = normalizeDimInput(trimmed, "px", 0);
      if (normalized) {
        exp.set(prop, normalized);
      } else {
        exp.clear(prop);
      }
    });
  };

  const commitUnifiedRadius = (rawInput: string) => {
    if (radiusDisabled) {
      return;
    }
    const trimmed = rawInput.trim();
    changeStyle(expsProvider, () => {
      const exp = expsProvider.mergedExp();
      if (!trimmed) {
        APPEARANCE_CORNER_PROPS.forEach((p) => exp.clear(p));
        return;
      }
      if (trimmed.includes(" ")) {
        const vals = parseCssShorthand(trimmed);
        standardCorners.forEach((corner, idx) => {
          const normalized = normalizeDimInput(vals[idx] ?? "", "px", 0);
          if (normalized) {
            exp.set(`border-${corner}-radius`, normalized);
          }
        });
        return;
      }
      const normalized = normalizeDimInput(trimmed, "px", 0);
      if (normalized) {
        APPEARANCE_CORNER_PROPS.forEach((p) => exp.set(p, normalized));
      } else {
        APPEARANCE_CORNER_PROPS.forEach((p) => exp.clear(p));
      }
    });
  };

  const handleScrubCorner = (
    propsToScrub: readonly string[],
    e: React.MouseEvent<HTMLSpanElement>,
  ) => {
    if (radiusDisabled || e.button !== 0) {
      return;
    }
    if (propsToScrub.some((p) => !!cornerTokenMap.get(p))) {
      return;
    }
    e.preventDefault();
    scrubRef.current?.cleanup();

    const startX = e.clientX;
    const rawFirst = cellMap.get(propsToScrub[0])?.value ?? "";
    const parsed = tryParseNumericSize(rawFirst);
    const baseNum = parsed?.num ?? 0;
    const unit = parsed?.unit ?? ("px" as Unit);

    const handleMove = (moveEvt: MouseEvent) => {
      const delta = Math.round((moveEvt.clientX - startX) / 2);
      const next = Math.max(0, baseNum + delta);
      const formatted = showSizeCss(createNumericSize(next, unit));
      changeStyle(expsProvider, () => {
        const exp = expsProvider.mergedExp();
        propsToScrub.forEach((p) => exp.set(p, formatted));
      });
    };
    const cleanup = () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", cleanup);
      scrubRef.current = null;
    };
    scrubRef.current = { cleanup };
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", cleanup, { once: true });
  };

  // --- Overflow / Clip content ---
  const overflowCell = cellMap.get("overflow");
  const overflowXCell = cellMap.get("overflow-x");
  const overflowYCell = cellMap.get("overflow-y");
  const overflowDefault = getCssInitial("overflow", undefined);
  const currentOverflow = overflowCell?.raw ?? overflowDefault;
  const isOverflowSplit = !!overflowXCell?.has || !!overflowYCell?.has;
  const currentOverflowX = overflowXCell?.raw ?? currentOverflow;
  const currentOverflowY = overflowYCell?.raw ?? currentOverflow;
  const overflowDisabled =
    !capabilities.overflowEditable ||
    isPropBlocked("overflow") ||
    isPropBlocked("overflow-x") ||
    isPropBlocked("overflow-y");

  const isOverflowModeActive = (mode: "visible" | "hidden" | "auto") => {
    if (isOverflowSplit) {
      return false;
    }
    if (mode === "auto") {
      return currentOverflow === "auto" || currentOverflow === "scroll";
    }
    return currentOverflow === mode;
  };

  const setUniformOverflow = (val: string) => {
    if (overflowDisabled) {
      return;
    }
    changeStyle(expsProvider, () => {
      const exp = expsProvider.mergedExp();
      exp.clear("overflow-x");
      exp.clear("overflow-y");
      exp.set("overflow", val);
    });
  };

  const splitOverflowAxes = () => {
    if (overflowDisabled) {
      return;
    }
    changeStyle(expsProvider, () => {
      const exp = expsProvider.mergedExp();
      exp.set("overflow-x", currentOverflowX || overflowDefault);
      exp.set("overflow-y", currentOverflowY || overflowDefault);
      exp.clear("overflow");
    });
  };

  const setSplitOverflowAxis = (axis: "overflow-x" | "overflow-y", val: string) => {
    if (overflowDisabled) {
      return;
    }
    changeStyle(expsProvider, () => {
      const exp = expsProvider.mergedExp();
      exp.clear("overflow");
      exp.set(axis, val);
    });
  };

  const formatOverflowModeLabel = (val: string) => {
    if (val === "hidden") {
      return uiT("Hidden");
    }
    if (val === "auto" || val === "scroll") {
      return uiT("Scroll");
    }
    return uiT("Visible");
  };

  const renderOverflowAxisMenu = (axis: "overflow-x" | "overflow-y") => (
    <Menu>
      {(
        [
          ["visible", uiT("Visible")],
          ["hidden", uiT("Hidden")],
          ["auto", uiT("Scroll")],
        ] as const
      ).map(([val, label]) => (
        <Menu.Item key={val} onClick={() => setSplitOverflowAxis(axis, val)}>
          {label}
        </Menu.Item>
      ))}
    </Menu>
  );

  // --- Blend mode ---
  const blendRaw = cellMap.get("mix-blend-mode")?.value ?? "normal";
  const blendSet = !!setMap.get("mix-blend-mode") && blendRaw !== "normal";
  const blendDisabled =
    !capabilities.blendEditable || isPropBlocked("mix-blend-mode");
  const blendLabelKey = MIX_BLEND_MODE_LABEL_MAP.get(blendRaw);
  const blendLabel = blendLabelKey ? uiT(blendLabelKey) : blendRaw;

  const renderBlendMenu = () => (
    <div className={cn("ant-dropdown-menu", styles.blendDropdown)}>
      <div className={styles.blendDropdownHeader}>
        <div className={styles.blendDropdownTitle}>{uiT("Blend mode")}</div>
        <div className={styles.blendDropdownDesc}>
          {uiT("How should the colors blend with the elements behind it?")}
        </div>
      </div>
      <Scrollbar
        scrollX={false}
        defer={false}
        className={styles.blendMenuScroll}
      >
        <Menu
          selectable={false}
          className={styles.blendMenu}
          style={{ maxHeight: "none", overflow: "visible" }}
        >
          {MIX_BLEND_MODE_GROUPS.map((group, groupIdx) => (
            <React.Fragment key={group.labelKey}>
              {groupIdx > 0 && <Menu.Divider />}
              <Menu.ItemGroup title={uiT(group.labelKey)}>
                {group.items.map(({ value, labelKey }) => {
                  const selected = blendRaw === value;
                  return (
                    <Menu.Item
                      key={value}
                      className={selected ? styles.blendMenuItemActive : undefined}
                      onClick={() => {
                        setBlendOpen(false);
                        if (blendDisabled) {
                          return;
                        }
                        changeStyle(expsProvider, () => {
                          const exp = expsProvider.mergedExp();
                          if (value === "normal") {
                            exp.clear("mix-blend-mode");
                          } else {
                            exp.set("mix-blend-mode", value);
                          }
                        });
                      }}
                    >
                      <div className={styles.blendMenuItemRow}>
                        <span>{uiT(labelKey)}</span>
                        {selected && (
                          <span className={styles.blendMenuCheck}>✓</span>
                        )}
                      </div>
                    </Menu.Item>
                  );
                })}
              </Menu.ItemGroup>
            </React.Fragment>
          ))}
        </Menu>
      </Scrollbar>
    </div>
  );

  const primaryRowClass = cn(
    styles.primaryRow,
    capabilities.opacityVisible && !capabilities.radiusVisible && styles.primaryRowSingle,
    !capabilities.opacityVisible && capabilities.radiusVisible && styles.primaryRowTwo,
  );

  const visHidden =
    visibilityController &&
    visibilityController.currentVisibility !== TplVisibility.Visible;
  const visIsDynamic =
    visibilityController &&
    visibilityController.currentVisibility === TplVisibility.CustomExpr;

  const visDisabledTooltip =
    typeof visibilityController?.disabledTooltip === "function"
      ? visibilityController.disabledTooltip()
      : visibilityController?.disabledTooltip;

  return (
    <div
      className={styles.card}
      data-testid="appearance-card"
      aria-label={uiT("Appearance")}
    >
      <div className={styles.header}>
        <div className={styles.titleGroup}>
          <span className={styles.title}>{uiT("Appearance")}</span>
          {capabilities.readOnly && (
            <Tooltip
              title={
                capabilities.readOnlyReason
                  ? uiT(capabilities.readOnlyReason)
                  : undefined
              }
            >
              <span className={styles.readOnlyBadge}>{uiT("Read-only")}</span>
            </Tooltip>
          )}
        </div>

        <div className={styles.headerActions}>
          {capabilities.visibilityVisible && visibilityController && (
            <div
              className={cn(
                styles.visSplitGroup,
                visHidden &&
                  (visIsDynamic
                    ? styles.visSplitGroupWarn
                    : styles.visSplitGroupActive),
              )}
            >
              <WithContextMenu overlay={visibilityController.buildMenu}>
                <Tooltip
                  title={
                    visDisabledTooltip ??
                    `${uiT("Toggle visibility")} (${uiT(
                      getVisibilityLabel(visibilityController.currentVisibility),
                    )})`
                  }
                >
                  <button
                    type="button"
                    data-test-id="visibility-quick-toggle"
                    aria-label={uiT("Toggle visibility")}
                    aria-pressed={!!visHidden}
                    disabled={
                      !capabilities.visibilityEditable ||
                      visibilityController.isDisabled ||
                      visibilityController.hasPrivateStyleVariant
                    }
                    className={cn(
                      styles.iconBtn,
                      styles.visSplitToggle,
                      visHidden &&
                        (visIsDynamic
                          ? styles.iconBtnWarn
                          : styles.iconBtnActive),
                    )}
                    onClick={visibilityController.toggleQuickVisibility}
                  >
                    {visHidden ? <EyeOffSvg /> : <EyeOpenSvg />}
                    {visibilityController.targetHasVisibility && (
                      <span className={styles.headerDot} />
                    )}
                  </button>
                </Tooltip>
              </WithContextMenu>
              <Dropdown
                trigger={["click"]}
                popupRender={visibilityController.buildMenu}
                disabled={
                  !capabilities.visibilityEditable ||
                  visibilityController.isDisabled ||
                  visibilityController.hasPrivateStyleVariant
                }
              >
                <Tooltip title={uiT("Visibility options")}>
                  <button
                    type="button"
                    data-test-id="visibility-menu-btn"
                    aria-label={uiT("Visibility options")}
                    disabled={
                      !capabilities.visibilityEditable ||
                      visibilityController.isDisabled ||
                      visibilityController.hasPrivateStyleVariant
                    }
                    className={cn(
                      styles.iconBtn,
                      styles.visSplitChevron,
                      visHidden &&
                        (visIsDynamic
                          ? styles.iconBtnWarn
                          : styles.iconBtnActive),
                    )}
                  >
                    <ChevronDownSvg />
                  </button>
                </Tooltip>
              </Dropdown>
            </div>
          )}

          {capabilities.blendVisible && (
            <WithContextMenu overlay={renderContextMenu("mix-blend-mode")}>
              <Dropdown
                trigger={["click"]}
                open={blendOpen}
                onOpenChange={setBlendOpen}
                popupRender={renderBlendMenu}
                disabled={blendDisabled}
              >
                <Tooltip title={`${uiT("Blend mode")}: ${blendLabel}`}>
                  <button
                    type="button"
                    aria-label={uiT("Blend mode")}
                    aria-pressed={blendSet}
                    disabled={blendDisabled}
                    className={cn(
                      styles.iconBtn,
                      blendSet && styles.iconBtnActive,
                    )}
                  >
                    <BlendDropSvg />
                    {blendSet && <span className={styles.headerDot} />}
                  </button>
                </Tooltip>
              </Dropdown>
            </WithContextMenu>
          )}
        </div>
      </div>

      {(capabilities.opacityVisible || capabilities.radiusVisible) && (
        <div className={primaryRowClass}>
          {capabilities.opacityVisible && (
            <WithContextMenu overlay={renderContextMenu("opacity")}>
              <div
                className={cn(
                  styles.cellInputWrap,
                  opacityDisabled && styles.cellInputDisabled,
                )}
                title={uiT("Opacity")}
              >
                <span
                  className={cn(
                    styles.cellPrefix,
                    !opacityDisabled && !opacityTokenRef && styles.cellScrubHoriz,
                  )}
                  onMouseDown={handleScrubOpacity}
                >
                  <OpacitySvg />
                  {opacitySet && <span className={styles.setDot} />}
                </span>

                {opacityTokenRef ? (
                  <button
                    type="button"
                    className={styles.tokenBadge}
                    disabled={opacityDisabled}
                    title={opacityTokenRef.name}
                    onClick={() => {
                      if (!opacityDisabled) {
                        setDraftValues((prev) => ({
                          ...prev,
                          opacity: formatOpacityPct(opacityRaw),
                        }));
                      }
                    }}
                  >
                    {opacityTokenRef.name}
                  </button>
                ) : (
                  <>
                    <input
                      data-plasmic-prop="opacity"
                      aria-label={uiT("Opacity")}
                      type="text"
                      disabled={opacityDisabled}
                      value={opacityPctText}
                      placeholder="100"
                      className={styles.cellField}
                      onFocus={() => {
                        setDraftValues((prev) => ({
                          ...prev,
                          opacity:
                            opacitySet && opacityRaw
                              ? formatOpacityPct(opacityRaw)
                              : "",
                        }));
                      }}
                      onChange={(e) => {
                        const next = e.target.value;
                        setDraftValues((prev) => ({ ...prev, opacity: next }));
                      }}
                      onBlur={() => {
                        const draft = draftValues.opacity;
                        setDraftValues((prev) => {
                          const copy = { ...prev };
                          delete copy.opacity;
                          return copy;
                        });
                        if (draft !== undefined) {
                          commitOpacityPct(draft);
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.currentTarget.blur();
                        } else if (e.key === "Escape") {
                          setDraftValues((prev) => {
                            const copy = { ...prev };
                            delete copy.opacity;
                            return copy;
                          });
                          e.currentTarget.blur();
                        }
                      }}
                    />
                    <span className={styles.cellSuffix}>%</span>
                  </>
                )}
              </div>
            </WithContextMenu>
          )}

          {capabilities.radiusVisible && (
            <>
              <WithContextMenu
                overlay={renderContextMenu([...APPEARANCE_CORNER_PROPS])}
              >
                <div
                  className={cn(
                    styles.cellInputWrap,
                    radiusDisabled && styles.cellInputDisabled,
                  )}
                  title={uiT("Corner radius")}
                >
                  <span
                    className={cn(
                      styles.cellPrefix,
                      !radiusDisabled &&
                        !unifiedTokenRef &&
                        styles.cellScrubHoriz,
                    )}
                    onMouseDown={(e) =>
                      handleScrubCorner(APPEARANCE_CORNER_PROPS, e)
                    }
                  >
                    <CornerArcSvg />
                    {anyCornerSet && <span className={styles.setDot} />}
                  </span>

                  {unifiedTokenRef ? (
                    <button
                      type="button"
                      className={styles.tokenBadge}
                      disabled={radiusDisabled}
                      title={unifiedTokenRef.name}
                      onClick={() => {
                        if (!radiusDisabled) {
                          setDraftValues((prev) => ({
                            ...prev,
                            "radius-all": cornerRaws[0],
                          }));
                        }
                      }}
                    >
                      {unifiedTokenRef.name}
                    </button>
                  ) : (
                    <input
                      data-testid="appearance-radius-input"
                      aria-label={uiT("Corner radius")}
                      type="text"
                      disabled={radiusDisabled}
                      value={shownUnifiedRadius}
                      placeholder={hasMixedCorners ? uiT("Mixed") : "0"}
                      className={styles.cellField}
                      onFocus={() => {
                        setDraftValues((prev) => ({
                          ...prev,
                          "radius-all":
                            hasMixedCorners || isUnifiedUnset
                              ? ""
                              : unifiedShorthand || cornerRaws[0],
                        }));
                      }}
                      onChange={(e) => {
                        const next = e.target.value;
                        setDraftValues((prev) => ({
                          ...prev,
                          "radius-all": next,
                        }));
                      }}
                      onBlur={() => {
                        const draft = draftValues["radius-all"];
                        setDraftValues((prev) => {
                          const copy = { ...prev };
                          delete copy["radius-all"];
                          return copy;
                        });
                        if (draft !== undefined) {
                          commitUnifiedRadius(draft);
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.currentTarget.blur();
                        } else if (e.key === "Escape") {
                          setDraftValues((prev) => {
                            const copy = { ...prev };
                            delete copy["radius-all"];
                            return copy;
                          });
                          e.currentTarget.blur();
                        }
                      }}
                    />
                  )}
                </div>
              </WithContextMenu>

              <Tooltip title={uiT("Individual corners")}>
                <button
                  type="button"
                  data-testid="appearance-corners-toggle"
                  aria-label={uiT("Individual corners")}
                  aria-pressed={cornersExpanded}
                  disabled={radiusDisabled}
                  className={cn(
                    styles.iconBtn,
                    styles.iconBtnPill,
                    (cornersExpanded || hasMixedCorners) && styles.iconBtnActive,
                  )}
                  onClick={() => setCornersExpanded((prev) => !prev)}
                >
                  <IndividualCornersSvg />
                </button>
              </Tooltip>
            </>
          )}
        </div>
      )}

      {capabilities.radiusVisible && cornersExpanded && (
        <div
          className={styles.cornersGrid}
          data-testid="appearance-corners-grid"
        >
          {standardCorners.map((corner) => {
            const prop = `border-${corner}-radius`;
            const raw = cellMap.get(prop)?.value ?? "";
            const isSet = !!setMap.get(prop);
            const isUnset = !isSet || !raw || raw === "0px";
            const tokenRef = cornerTokenMap.get(prop);
            const cellDisabled = radiusDisabled || isPropBlocked(prop);
            const shownCorner =
              prop in draftValues
                ? draftValues[prop]
                : isUnset
                  ? ""
                  : formatCompactDim(raw);

            return (
              <WithContextMenu key={corner} overlay={renderContextMenu(prop)}>
                <div
                  className={cn(
                    styles.cellInputWrap,
                    cellDisabled && styles.cellInputDisabled,
                  )}
                  title={uiT(CORNER_PREFIX_LABELS[corner])}
                >
                  <span
                    className={cn(
                      styles.cellPrefix,
                      !cellDisabled && !tokenRef && styles.cellScrubHoriz,
                    )}
                    onMouseDown={(e) => handleScrubCorner([prop], e)}
                  >
                    <CornerMarkSvg corner={corner} />
                    {isSet && !isUnset && <span className={styles.setDot} />}
                  </span>

                  {tokenRef ? (
                    <button
                      type="button"
                      className={styles.tokenBadge}
                      disabled={cellDisabled}
                      title={tokenRef.name}
                      onClick={() => {
                        if (!cellDisabled) {
                          setDraftValues((prev) => ({
                            ...prev,
                            [prop]: raw,
                          }));
                        }
                      }}
                    >
                      {tokenRef.name}
                    </button>
                  ) : (
                    <input
                      aria-label={uiT(CORNER_PREFIX_LABELS[corner])}
                      type="text"
                      disabled={cellDisabled}
                      value={shownCorner}
                      placeholder="0"
                      className={styles.cellField}
                      onFocus={() => {
                        setDraftValues((prev) => ({
                          ...prev,
                          [prop]: isUnset ? "" : raw,
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
                          commitCornerProp(prop, draft);
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
          })}
        </div>
      )}

      {capabilities.overflowVisible && (
        <>
          <div className={styles.overflowRow}>
            <WithContextMenu
              overlay={renderContextMenu(["overflow", "overflow-x", "overflow-y"])}
            >
              <span className={styles.overflowLabel} title={uiT("Overflow")}>
                {uiT("Overflow")}
              </span>
            </WithContextMenu>

            <div
              role="group"
              aria-label={uiT("Overflow")}
              className={cn(
                styles.overflowSeg,
                isOverflowSplit && styles.overflowSegDimmed,
              )}
            >
              {(
                [
                  ["visible", uiT("Visible")],
                  ["hidden", uiT("Hidden")],
                  ["auto", uiT("Scroll")],
                ] as const
              ).map(([mode, label]) => {
                const active = isOverflowModeActive(mode);
                return (
                  <button
                    key={mode}
                    type="button"
                    aria-pressed={active}
                    disabled={overflowDisabled}
                    title={label}
                    className={cn(
                      styles.overflowSegBtn,
                      active && styles.overflowSegBtnActive,
                    )}
                    onClick={() => setUniformOverflow(mode)}
                  >
                    {label}
                  </button>
                );
              })}
            </div>

            <Tooltip title={uiT("Split overflow for X and Y")}>
              <button
                type="button"
                data-testid="appearance-overflow-split-btn"
                aria-label={uiT("Split overflow for X and Y")}
                aria-pressed={isOverflowSplit}
                disabled={overflowDisabled}
                className={cn(
                  styles.iconBtn,
                  styles.iconBtnPill,
                  styles.overflowSplitBtn,
                  isOverflowSplit && styles.iconBtnActive,
                )}
                onClick={() =>
                  isOverflowSplit
                    ? setUniformOverflow(currentOverflowX)
                    : splitOverflowAxes()
                }
              >
                XY
              </button>
            </Tooltip>
          </div>

          {isOverflowSplit && (
            <div
              className={styles.overflowSplitGrid}
              data-testid="appearance-overflow-split"
            >
              {(
                [
                  ["X", "overflow-x", currentOverflowX],
                  ["Y", "overflow-y", currentOverflowY],
                ] as const
              ).map(([axisLabel, prop, val]) => (
                <div key={prop} className={styles.overflowSplitCell}>
                  <span className={styles.splitAxisLabel}>{axisLabel}</span>
                  <Dropdown
                    trigger={["click"]}
                    popupRender={() => renderOverflowAxisMenu(prop)}
                    disabled={overflowDisabled}
                  >
                    <button
                      type="button"
                      aria-label={`${uiT("Overflow")} ${axisLabel}`}
                      disabled={overflowDisabled}
                      className={styles.splitModeBtn}
                    >
                      {formatOverflowModeLabel(val)}
                    </button>
                  </Dropdown>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {capabilities.visibilityVisible && visibilityController?.conditionRows && (
        <div className={styles.conditionSection}>
          {visibilityController.conditionRows}
        </div>
      )}
    </div>
  );
});
