import { StyleOverrideControl } from "@/wab/client/components/style-controls/StyleOverrideMenu";
import { useInspectorSelection } from "@/wab/client/studio-ctx/inspector-state";
import {
  LabeledStyleColorItem,
  LabeledStyleDimItem,
  shouldBeDisabled,
} from "@/wab/client/components/sidebar/sidebar-helpers";
import styles from "@/wab/client/components/style-controls/BorderControls.module.sass";
import strokeStyles from "@/wab/client/components/style-controls/BorderStrokeControls.module.scss";
import paintStyles from "@/wab/client/components/style-controls/PaintRows.module.scss";
import StyleToggleButton from "@/wab/client/components/style-controls/StyleToggleButton";
import { useStyleTokenRefs } from "@/wab/client/studio-ctx/style-token-ref-inputs";
import { useClientTokenValue } from "@/wab/client/components/widgets/ColorPicker/client-token-resolver";
import { useStudioEscape } from "@/wab/client/hooks/useStudioEscape";
import { TriggerTarget } from "@/wab/client/components/widgets/TriggerAnchor";
import HelpIcon from "@/wab/client/plasmic/plasmic_kit/PlasmicIcon__Help";
import {
  changeStyle,
  ExpsProvider,
  StylePanelSection,
  TplExpsProvider,
} from "@/wab/client/components/style-controls/StyleComponent";
import { useStyleCells, useStyleIndicators } from "@/wab/client/studio-ctx/style-inputs-react";
import { IconLinkButton, ListBox, ListBoxItem } from "@/wab/client/components/widgets";
import { DimTokenSpinnerRef } from "@/wab/client/components/widgets/DimTokenSelector";
import { Icon } from "@/wab/client/components/widgets/Icon";
import { IconButton } from "@/wab/client/components/widgets/IconButton";
import { useAutoFocus } from "@/wab/client/hooks/useAutoFocus";
import { useI18n } from "@/wab/client/i18n";
import BorderRadiusAllIcon from "@/wab/client/plasmic/plasmic_kit/PlasmicIcon__BorderRadiusAll";
import BorderRadiusSideIcon from "@/wab/client/plasmic/plasmic_kit/PlasmicIcon__BorderRadiusSide";
import { arrayMoveIndex } from "@/wab/shared/collections";
import MinusIcon from "@/wab/client/plasmic/plasmic_kit/PlasmicIcon__Minus";
import PlusIcon from "@/wab/client/plasmic/plasmic_kit/PlasmicIcon__Plus";
import { useStudioCtx } from "@/wab/client/contexts/StudioContexts";
import { useVariantedStylesHelperFromCurrentCtx } from "@/wab/client/studio-ctx/varianted-style-context";
import { VariantedStylesHelper } from "@/wab/shared/VariantedStylesHelper";
import { assert, ensure, spawn, unanimousVal } from "@/wab/shared/common";
import { parseCssShorthand, showCssShorthand } from "@/wab/shared/css";
import { LENGTH_UNITS, LENGTH_PERCENTAGE_UNITS } from "@/wab/shared/css/types";
import {
  Corner,
  Side,
  standardCorners,
  standardSides,
} from "@/wab/shared/geom";
import { isKnownTplTag } from "@/wab/shared/model/classes";
import { isTplAttachedToSite } from "@/wab/shared/core/sites";
import type { StyleCell } from "@/wab/client/studio-ctx/style-inputs";
import cn from "classnames";
import { Popover, Tooltip } from "antd";
import * as React from "react";
import { useEffect, useRef } from "react";
import { FiSlash } from "react-icons/fi";

const borderLineStyles: ReadonlyArray<string> = ["color", "style", "width"];
const borderRadiusStyles: ReadonlyArray<string> = ["radius"];

export const borderStyleProps = borderLineStyles.flatMap((prop) =>
  standardSides.map((side) => `border-${side}-${prop}`),
);

export const borderRadiusStyleProps = standardCorners.map(
  (corner) => `border-${corner}-radius`,
);

const noDefaultBorder = { getSnapshot: () => false, subscribe: (_listener: () => void) => () => undefined };

/** One primitive field from the provider's captured View/model world. It is a
 * read lease, not a second border preference or a widget disposal fallback. */
function useHasDefaultBorder(expsProvider: ExpsProvider) {
  const source = React.useMemo(() => {
    if (!(expsProvider instanceof TplExpsProvider) || !isKnownTplTag(expsProvider.tpl)) { return noDefaultBorder; }
    const { viewCtx, tpl, studioCtx } = expsProvider;
    const native = expsProvider.getNativeStyleSource();
    assert(native.kind === "tpl", "Tpl border provider must own a tpl style source");
    if (native.inputs.isDisposed || viewCtx.disposeSignal.aborted || native.source.site !== studioCtx.site) { return noDefaultBorder; }
    assert(isTplAttachedToSite(native.source.site, tpl), "Border element belongs to another model world");
    const models = studioCtx.modelSnapshots, field = models.field(tpl, "tag");
    let cached = false;
    const isClosed = () => native.inputs.isDisposed || viewCtx.disposeSignal.aborted || studioCtx.modelSnapshots !== models;
    const getSnapshot = () => {
      if (!isClosed()) { cached = ["button", "textarea", "input"].includes(field.getState()); }
      return cached;
    };
    const subscribe = (listener: () => void) => {
      if (isClosed()) { return () => undefined; }
      const stopField = field.subscribe(listener);
      let stopped = false;
      const stop = () => {
        if (stopped) { return; } stopped = true; stopField();
        viewCtx.disposeSignal.removeEventListener("abort", stop);
      };
      viewCtx.disposeSignal.addEventListener("abort", stop, { once: true });
      return stop;
    };
    return { getSnapshot, subscribe };
  }, [expsProvider]);
  return React.useSyncExternalStore(source.subscribe, source.getSnapshot, source.getSnapshot);
}

export function BorderPanelSection(props: {
  expsProvider: ExpsProvider;
  vsh?: VariantedStylesHelper;
}) {
  const studioCtx = useStudioCtx();
  const hasDefaultBorder = useHasDefaultBorder(props.expsProvider);
  const currentVsh = useVariantedStylesHelperFromCurrentCtx(props.vsh ? undefined : studioCtx);
  return <BorderStrokeSection key={borderProviderKey(props.expsProvider)}
    expsProvider={props.expsProvider} vsh={props.vsh ?? currentVsh} hasDefaultBorder={hasDefaultBorder} />;
}

function borderProviderKey(provider: ExpsProvider) {
  return JSON.stringify(provider instanceof TplExpsProvider
    ? [provider.tpl.uuid, ...provider.targetVariantCombo.map((variant) => variant.uuid)]
    : provider.targetRs().uid);
}

export function BorderRadiusSection(props: {
  expsProvider: ExpsProvider;
  vsh?: VariantedStylesHelper;
}) {
  const { t: uiT } = useI18n();
  const { expsProvider } = props;
  const studioCtx = useStudioCtx();
  const inputRef = useRef<DimTokenSpinnerRef>(null);
  const selection = useInspectorSelection(studioCtx);

  const borderRadiusCells = useStyleCells(expsProvider, borderRadiusStyleProps);
  const [open, setOpen] = React.useState(false);
  useAutoFocus(open && inputRef);

  const hasBorderRadiusProps = borderRadiusCells.some((cell) => cell.has);
  const hasBorderRadiusTargetProps = borderRadiusCells.some(
    (cell) => cell.targetHas,
  );

  const currentVsh = useVariantedStylesHelperFromCurrentCtx(props.vsh ? undefined : studioCtx);
  const vsh = props.vsh ?? currentVsh;

  const clickOpenCloseButton = async () => {
    if (open || hasBorderRadiusTargetProps) {
      await studioCtx.changeUnsafe(() => {
        const exp = expsProvider.mergedExp();
        for (const prop of borderRadiusStyleProps) {
          if (exp.has(prop)) {
            exp.clear(prop);
          }
        }
      });
      setOpen(false);
    } else {
      setOpen(true);
    }
  };

  useEffect(() => {
    setOpen(false);
  }, [selection?.selectable]);

  const showHeaderControls =
    hasBorderRadiusTargetProps || !hasBorderRadiusProps;

  return (
    <StylePanelSection
      key={String(open || hasBorderRadiusProps)}
      title={uiT("Corner radius")}
      expsProvider={expsProvider}
      styleProps={borderRadiusStyleProps}
      headerMenuOnRightClickOnly
      controls={
        <>
        <StyleOverrideControl expsProvider={expsProvider} label={uiT("Corner radius")}
          styleProps={borderRadiusStyleProps}
          noneValues={Object.fromEntries(borderRadiusStyleProps.map((prop) => [prop, "0px"]))}
          onChange={() => setOpen(false)} />
        {showHeaderControls && (
          <IconLinkButton onClick={clickOpenCloseButton}>
            <Icon
              icon={open || hasBorderRadiusTargetProps ? MinusIcon : PlusIcon}
            />
          </IconLinkButton>
        )}
        </>
      }
    >
      {(open || hasBorderRadiusProps) && (
        <BorderRadiusControlsWrapper
          inputRef={inputRef}
          expsProvider={expsProvider}
          vsh={vsh}
        />
      )}
    </StylePanelSection>
  );
}

function getInitialBorderPositions<Position extends Side | Corner>(
  cells: readonly StyleCell[],
  borderStyles: ReadonlyArray<string>,
  standardPositions: readonly Position[],
): Position[] {
  const selectedPositions = standardPositions.filter((position) => borderStyles.some((style) =>
    cells.some((cell) => cell.key === `border-${position}-${style}` && cell.has),
  ));
  return selectedPositions.length !== standardPositions.length ? selectedPositions : [];
}

function BorderRadiusControlsWrapper(props: {
  expsProvider: ExpsProvider;
  inputRef?: React.Ref<DimTokenSpinnerRef>;
  vsh: VariantedStylesHelper;
}) {
  const cells = useStyleCells(props.expsProvider, borderRadiusStyleProps);
  return <BorderRadiusControls {...props} key={borderProviderKey(props.expsProvider)}
    initialBorderPositions={getInitialBorderPositions(cells, borderRadiusStyles, standardCorners)} />;
}

type StrokeGroup = { id: number; sides: Side[] };
type StrokeValues = { color: string; width: string; style: string };

/** Groups and their order are panel state; the four CSS sides remain the model. */
function reconcileStrokeGroups(previous: StrokeGroup[], values: Map<Side, StrokeValues>) {
  let nextId = Math.max(0, ...previous.map((group) => group.id)) + 1;
  const assigned = new Set<Side>();
  const groups: StrokeGroup[] = [];
  const append = (sides: readonly Side[], id?: number) => {
    const buckets = new Map<string, Side[]>();
    for (const side of sides) {
      const value = values.get(side);
      if (!value || assigned.has(side)) { continue; }
      assigned.add(side);
      const signature = JSON.stringify(value);
      const bucket = buckets.get(signature) ?? [];
      bucket.push(side);
      buckets.set(signature, bucket);
    }
    [...buckets.values()].forEach((groupSides, index) => {
      groups.push({ id: index === 0 && id !== undefined ? id : nextId++, sides: groupSides });
    });
  };
  previous.forEach((group) => append(group.sides, group.id));
  append(standardSides);
  return groups;
}

function BorderStrokeSection({ expsProvider, vsh, hasDefaultBorder }: {
  expsProvider: ExpsProvider;
  vsh: VariantedStylesHelper;
  hasDefaultBorder: boolean;
}) {
  const { t } = useI18n();
  const cells = useStyleCells(expsProvider, borderStyleProps);
  const indicators = useStyleIndicators(expsProvider, borderStyleProps);
  const { isDisabled } = shouldBeDisabled({ props: {}, indicators, label: t("Stroke") });
  const values = new Map<Side, StrokeValues>();
  for (const side of standardSides) {
    const sideCells = borderLineStyles.map((prop) => cells.find((cell) => cell.key === `border-${side}-${prop}`));
    const style = sideCells[1];
    if ((!hasDefaultBorder && !sideCells.some((cell) => cell?.has)) || style?.raw === "hidden") { continue; }
    if (style?.raw === "none") {
      if (style.has) { values.set(side, { color: "#000000", style: "none", width: "1px" }); }
      continue;
    }
    values.set(side, { color: sideCells[0]?.value || "currentColor", style: style?.value || "solid", width: sideCells[2]?.value || "medium" });
  }
  const signature = JSON.stringify([...values]);
  const [presentation, setPresentation] = React.useState(() => ({ signature, groups: reconcileStrokeGroups([], values) }));
  let groups = presentation.groups;
  if (presentation.signature !== signature) {
    groups = reconcileStrokeGroups(groups, values);
    setPresentation({ signature, groups });
  }
  const freeSides = standardSides.filter((side) => !values.has(side));
  const canAdd = freeSides.length > 0;
  const change = (fn: () => void) => {
    if (!isDisabled) { changeStyle(expsProvider, fn); }
  };
  const removeSide = (side: Side) => {
    const exp = expsProvider.maybeTargetExp();
    borderLineStyles.forEach((prop) => exp?.clear(`border-${side}-${prop}`));
  };
  const add = () => change(() => {
    const sides = freeSides.slice(0, 1);
    const exp = expsProvider.targetExp();
    sides.forEach((side) => {
      exp.set(`border-${side}-style`, "solid");
      exp.set(`border-${side}-width`, "1px");
      exp.set(`border-${side}-color`, "#000000");
    });
  });
  return <StylePanelSection title={t("Stroke")} expsProvider={expsProvider}
    styleProps={borderStyleProps} headerMenuOnRightClickOnly controls={<>
      <IconButton size="small" aria-label={t("Add stroke")} tooltip={t(canAdd ? "Add stroke" : "All border sides are assigned")}
        disabled={isDisabled || !canAdd} onClick={add}><Icon icon={PlusIcon} /></IconButton>
    </>}>
    {groups.length > 0 && <ListBox onReorder={isDisabled ? undefined : (from, to) =>
      setPresentation({ signature, groups: arrayMoveIndex(groups, from, to) })}>
      {groups.map((group, index) => {
        const value = ensure(values.get(group.sides[0]), "Stroke group must own a configured side");
        return <ListBoxItem key={group.id} index={index} className={paintStyles.fillItem}
          isDragDisabled={isDisabled || groups.length < 2} disabled={isDisabled}
          removeLabel={t("Remove stroke")} onRemove={() => change(() => group.sides.forEach(removeSide))}
          clickable={false} truncate={false} mainContent={
            <StrokeRow expsProvider={expsProvider} vsh={vsh} sides={group.sides} value={value} disabled={!!isDisabled}
              occupied={standardSides.filter((side) => values.has(side) && !group.sides.includes(side))}
              onSidesChange={(sides) => change(() => {
                if (!sides.length || sides.some((side) => values.has(side) && !group.sides.includes(side))) { return; }
                const exp = expsProvider.targetExp();
                group.sides.filter((side) => !sides.includes(side)).forEach(removeSide);
                sides.filter((side) => !group.sides.includes(side)).forEach((side) => {
                  if (value.style === "none") {
                    removeSide(side);
                    exp.set(`border-${side}-style`, "none");
                  } else {
                    borderLineStyles.forEach((prop) => exp.set(`border-${side}-${prop}`, value[prop as keyof StrokeValues]));
                  }
                });
                setPresentation({ signature, groups: groups.map((row) => row.id === group.id ? { ...row, sides } : row) });
              })}
              onChange={(prop, next) => change(() => {
                const exp = expsProvider.targetExp();
                group.sides.forEach((side) => {
                  if (prop === "style" && next === "none") {
                    removeSide(side);
                  } else if (prop === "style" && value.style === "none") {
                    exp.set(`border-${side}-color`, value.color);
                    exp.set(`border-${side}-width`, value.width);
                  }
                  if (next === undefined) { exp.clear(`border-${side}-${prop}`); }
                  else { exp.set(`border-${side}-${prop}`, next); }
                });
              })} />
          } />;
      })}
    </ListBox>}
  </StylePanelSection>;
}

function StrokePreview({ sides, lineStyle = "solid", color }: {
  sides: readonly Side[]; lineStyle?: string; color?: string;
}) {
  const border = `${lineStyle === "double" ? 3 : 2}px ${lineStyle} currentColor`;
  return <span className={strokeStyles.preview} aria-hidden="true"><span style={{
    color, borderTop: sides.includes("top") ? border : undefined,
    borderRight: sides.includes("right") ? border : undefined,
    borderBottom: sides.includes("bottom") ? border : undefined,
    borderLeft: sides.includes("left") ? border : undefined,
  }} /></span>;
}

function StrokeRow({ expsProvider, vsh, sides, value, occupied, disabled, onSidesChange, onChange }: {
  expsProvider: ExpsProvider; vsh: VariantedStylesHelper; sides: Side[]; value: StrokeValues;
  occupied: Side[]; disabled: boolean;
  onSidesChange: (sides: Side[]) => void;
  onChange: (prop: keyof StrokeValues, value: string | undefined) => void;
}) {
  const { t } = useI18n();
  const [open, setOpen] = React.useState(false);
  const trigger = useRef<HTMLButtonElement>(null), popup = useRef<HTMLDivElement>(null);
  const { selected, lifetime } = useStyleTokenRefs(expsProvider.studioCtx, [value.color], vsh, "Color", (snapshot) => snapshot.rows[0]);
  const resolved = selected?.resolved;
  const clientColor = useClientTokenValue(resolved?.value, resolved, lifetime);
  const color = selected?.applied ? clientColor : value.color;
  useStudioEscape(popup, open, () => { setOpen(false); trigger.current?.focus(); });
  const sideLabels = { top: t("Top border"), right: t("Right border"), bottom: t("Bottom border"), left: t("Left border") };
  const isNone = value.style === "none";
  const lineStyles = { none: t("None"), solid: t("Solid line"), dashed: t("Dashed"), dotted: t("Dotted"), double: t("Double") };
  const label = `${sides.length === 4 ? t("All borders") : sides.map((side) => sideLabels[side]).join(", ")} · ${lineStyles[value.style as keyof typeof lineStyles] ?? value.style}`;
  return <div className={strokeStyles.row} data-test-id="stroke-row" data-stroke-sides={sides.join(" ")}>
    <Popover trigger="click" open={open && !disabled} onOpenChange={setOpen} placement="leftTop" arrow={false} destroyOnHidden
      content={<div className={strokeStyles.popover} ref={popup} role="group" aria-label={t("Stroke settings")}>
        <div className={strokeStyles.heading}>{t("Direction")}
          <IconButton size="small" className={strokeStyles.help} tooltip={t("Assigned sides cannot be selected. You can select multiple available sides.")} aria-label={t("Border direction help")}>
            <Icon icon={HelpIcon} />
          </IconButton>
        </div>
        <div className={strokeStyles.directions} role="group" aria-label={t("Stroke sides")}>
          {[undefined, ...standardSides].map((side) => {
            const active = side ? sides.includes(side) : sides.length === 4;
            const unavailable = disabled || (side ? occupied.includes(side) : occupied.length > 0);
            const text = side ? sideLabels[side] : t("All borders");
            return <Tooltip key={side ?? "all"} title={unavailable ? t("This direction is assigned to another stroke") : text}>
              <button type="button" aria-label={text} aria-pressed={active} disabled={unavailable}
                aria-disabled={unavailable || (active && sides.length === 1)}
                onClick={() => {
                  if (!side) { onSidesChange([...standardSides]); }
                  else if (!active) { onSidesChange(standardSides.filter((s) => s === side || sides.includes(s))); }
                  else if (sides.length > 1) { onSidesChange(sides.filter((s) => s !== side)); }
                }}><StrokePreview sides={side ? [side] : standardSides} /></button>
            </Tooltip>;
          })}
        </div>
        <div className={strokeStyles.lineSection}>
          <div className={strokeStyles.heading}>{t("Line style")}</div>
          <div className={strokeStyles.lineStyles} role="group" aria-label={t("Line style")}>
            {Object.entries(lineStyles).map(([style, text]) => <StyleToggleButton key={style}
              className={strokeStyles.lineButton} value={style} tooltip={text} isDisabled={disabled}
              valueSetState={value.style === style ? "isSet" : "isUnset"} onClick={() => onChange("style", style)}>
              {style === "none" ? <FiSlash aria-hidden="true" /> : <span className={strokeStyles.line} style={{ borderTopStyle: style as React.CSSProperties["borderTopStyle"], borderTopWidth: style === "double" ? 3 : 2 }} />}
            </StyleToggleButton>)}
          </div>
        </div>
      </div>}>
      <Tooltip title={open ? null : label}><TriggerTarget><button type="button" className={cn(strokeStyles.settings, isNone && strokeStyles.none)} ref={trigger} disabled={disabled}
        aria-label={label} aria-expanded={open} data-test-id="stroke-settings">
        <StrokePreview sides={sides} lineStyle={isNone ? "solid" : value.style} color={isNone ? undefined : color} />
        {isNone && <span>{t("None")}</span>}
      </button></TriggerTarget></Tooltip>
    </Popover>
    {!isNone && <>
    <LabeledStyleColorItem styleName={sides.map((side) => `border-${side}-color`)} displayStyleName={t("Color")}
      noMenuButton hideIndicator vsh={vsh} className={strokeStyles.color}
      colorOpts={{ "aria-label": t("Stroke color"), popupTitle: t("Stroke color"), floatingPicker: true,
        color: value.color, onChange: (next) => onChange("color", next) }} />
    <LabeledStyleDimItem styleName={sides.map((side) => `border-${side}-width`)} displayStyleName={t("Stroke width")}
      noMenuButton hideIndicator vsh={vsh} tokenType="Spacing" aria-label={t("Stroke width")} className={strokeStyles.width}
      dimOpts={{ "data-test-id": "stroke-width", value: value.width, onChange: (next) => onChange("width", next),
        min: 0, allowedUnits: LENGTH_UNITS, allowFunctions: true, hideArrow: false,
        extraOptions: [{ value: "thin", label: t("Thin") }, { value: "medium", label: t("Medium") }, { value: "thick", label: t("Thick") }],
      }} />
    </>}
  </div>;
}

function BorderRadiusControls(props: {
  expsProvider: ExpsProvider;
  initialBorderPositions: Corner[];
  inputRef?: React.Ref<DimTokenSpinnerRef>;
  vsh: VariantedStylesHelper;
}) {
  const { t: uiT } = useI18n();
  const { expsProvider, initialBorderPositions } = props;
  const studioCtx = expsProvider.studioCtx;
  const cells = useStyleCells(expsProvider, borderRadiusStyleProps);
  const [selectedCorners, setSelectedCorners] = React.useState<Corner[]>(
    initialBorderPositions,
  );
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const hasSetPropRef = React.useRef(false);

  const isAll = selectedCorners.length === 0;

  const effectiveCorners = () => (isAll ? standardCorners : selectedCorners);

  const getCornerRadius = (corner: Corner) => {
    return cells.find((cell) => cell.key === `border-${corner}-radius`)?.value ?? "";
  };

  const getSelectedCornerRadius = () => {
    if (isAll) {
      return showCssShorthand(standardCorners.map((s) => getCornerRadius(s)));
    } else {
      return unanimousVal(effectiveCorners().map((s) => getCornerRadius(s)));
    }
  };

  const toggleCorner = (corner: Corner) => {
    if (selectedCorners.includes(corner)) {
      setSelectedCorners((prevSelectedCorners) =>
        prevSelectedCorners.filter((s) => s !== corner),
      );
    } else if (hasSetPropRef.current) {
      setSelectedCorners([corner]);
    } else {
      setSelectedCorners((prevSelectedCorners) => [
        ...prevSelectedCorners,
        corner,
      ]);
    }
    hasSetPropRef.current = false;
  };

  const changeRadius = async (value: string) => {
    hasSetPropRef.current = true;
    return studioCtx.changeUnsafe(() => {
      const exp = expsProvider.mergedExp();
      if (isAll) {
        const vals = parseCssShorthand(value);
        standardCorners.forEach((corner, i) =>
          exp.set(`border-${corner}-radius`, vals[i]),
        );
      } else {
        effectiveCorners().forEach((corner) =>
          exp.set(`border-${corner}-radius`, value),
        );
      }
    });
  };

  const clearRadius = async () => {
    hasSetPropRef.current = true;
    return studioCtx.changeUnsafe(() => {
      const exp = expsProvider.mergedExp();
      effectiveCorners().forEach((corner) =>
        exp.clear(`border-${corner}-radius`),
      );
    });
  };

  return (
    <div className="flex flex-vcenter" ref={containerRef}>
      <div
        className="grid grid-cols-3 label-col"
        style={{
          flexShrink: 0,
          marginLeft: -10,
          gridTemplateRows: "15px 15px 15px",
        }}
      >
        <IconButton
          isActive={selectedCorners.includes("top-left")}
          onClick={() => toggleCorner("top-left")}
          tooltip={uiT("Top-left corner")}
        >
          <Icon icon={BorderRadiusSideIcon} />
        </IconButton>
        <IconButton
          className="col-start-3"
          isActive={selectedCorners.includes("top-right")}
          onClick={() => toggleCorner("top-right")}
          tooltip={uiT("Top-right corner")}
        >
          <Icon
            icon={BorderRadiusSideIcon}
            style={{ transform: "rotate(90deg)" }}
          />
        </IconButton>
        <IconButton
          className="col-start-2"
          isActive={selectedCorners.length === 0}
          onClick={() => setSelectedCorners([])}
          tooltip={uiT("All corners")}
        >
          <Icon icon={BorderRadiusAllIcon} />
        </IconButton>
        <IconButton
          className="col-start-1"
          isActive={selectedCorners.includes("bottom-left")}
          onClick={() => toggleCorner("bottom-left")}
          tooltip={uiT("Bottom-left corner")}
        >
          <Icon
            icon={BorderRadiusSideIcon}
            style={{ transform: "rotate(-90deg)" }}
          />
        </IconButton>
        <IconButton
          className="col-start-3"
          isActive={selectedCorners.includes("bottom-right")}
          onClick={() => toggleCorner("bottom-right")}
          tooltip={uiT("Bottom-right corner")}
        >
          <Icon
            icon={BorderRadiusSideIcon}
            style={{ transform: "rotate(180deg)" }}
          />
        </IconButton>
      </div>
      <div className={cn("ml-lg", "flex-fill", styles.inputContainer)}>
        <LabeledStyleDimItem
          label={uiT("Radius")}
          styleName={effectiveCorners().map((s) => `border-${s}-radius`)}
          labelSize="small"
          displayStyleName="border-radius"
          tokenType={"Spacing"}
          dimOpts={{
            ref: props.inputRef,
            value: getSelectedCornerRadius() || "--",
            onChange: (val) =>
              val === undefined
                ? spawn(clearRadius())
                : spawn(changeRadius(val)),
            shorthand: isAll,
            dragScale: "1",
            min: 0,
            allowedUnits: LENGTH_PERCENTAGE_UNITS,
            allowFunctions: true,
          }}
        />
      </div>
    </div>
  );
}
