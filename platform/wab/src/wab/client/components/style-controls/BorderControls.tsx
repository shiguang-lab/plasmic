import { useInspectorSelection } from "@/wab/client/studio-ctx/inspector-state";
import {
  LabeledStyleColorItemRow,
  LabeledStyleDimItem,
  LabeledStyleDimItemRow,
} from "@/wab/client/components/sidebar/sidebar-helpers";
import styles from "@/wab/client/components/style-controls/BorderControls.module.sass";
import { LabeledLineStyleToggleButtonGroupItemRow } from "@/wab/client/components/style-controls/LineStyleControls";
import {
  ExpsProvider,
  StylePanelSection,
  TplExpsProvider,
} from "@/wab/client/components/style-controls/StyleComponent";
import { useStyleCells } from "@/wab/client/studio-ctx/style-inputs-react";
import { IconLinkButton } from "@/wab/client/components/widgets";
import { DimTokenSpinnerRef } from "@/wab/client/components/widgets/DimTokenSelector";
import { Icon } from "@/wab/client/components/widgets/Icon";
import { IconButton } from "@/wab/client/components/widgets/IconButton";
import { useAutoFocus } from "@/wab/client/hooks/useAutoFocus";
import { useI18n } from "@/wab/client/i18n";
import BorderAllIcon from "@/wab/client/plasmic/plasmic_kit/PlasmicIcon__BorderAll";
import BorderRadiusAllIcon from "@/wab/client/plasmic/plasmic_kit/PlasmicIcon__BorderRadiusAll";
import BorderRadiusSideIcon from "@/wab/client/plasmic/plasmic_kit/PlasmicIcon__BorderRadiusSide";
import BorderSideIcon from "@/wab/client/plasmic/plasmic_kit/PlasmicIcon__BorderSide";
import MinusIcon from "@/wab/client/plasmic/plasmic_kit/PlasmicIcon__Minus";
import PlusIcon from "@/wab/client/plasmic/plasmic_kit/PlasmicIcon__Plus";
import { useStudioCtx } from "@/wab/client/contexts/StudioContexts";
import { useVariantedStylesHelperFromCurrentCtx } from "@/wab/client/studio-ctx/varianted-style-context";
import { VariantedStylesHelper } from "@/wab/shared/VariantedStylesHelper";
import { assert, ensure, spawn, unanimousVal } from "@/wab/shared/common";
import { parseCssShorthand, showCssShorthand } from "@/wab/shared/css";
import { LENGTH_PERCENTAGE_UNITS } from "@/wab/shared/css/types";
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
import * as React from "react";
import { useEffect, useRef } from "react";

enum BorderType {
  Line,
  Radius,
}
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
  const { t: uiT } = useI18n();
  const { expsProvider } = props;
  const studioCtx = useStudioCtx();

  const hasDefaultBorder = useHasDefaultBorder(expsProvider);
  const borderStyleCells = useStyleCells(expsProvider, borderStyleProps);
  const [open, setOpen] = React.useState(false);

  const hasBorderProps =
    borderStyleCells.some((cell) => cell.has) ||
    hasDefaultBorder;
  const hasBorderTargetProps = borderStyleCells.some((cell) => cell.targetHas);

  const currentVsh = useVariantedStylesHelperFromCurrentCtx(props.vsh ? undefined : studioCtx);
  const vsh = props.vsh ?? currentVsh;

  const clickOpenCloseButton = async () => {
    if (open || hasBorderTargetProps) {
      await studioCtx.changeUnsafe(() => {
        const exp = expsProvider.mergedExp();
        for (const prop of borderStyleProps) {
          if (exp.has(prop)) {
            exp.clear(prop);
          }
        }
      });
    }
    setOpen(!open);
  };

  const showHeaderControls = hasBorderTargetProps || !hasBorderProps;
  const shouldReactToHeaderClick =
    showHeaderControls && !open && !hasBorderTargetProps;

  return (
    <StylePanelSection
      key={String(open || hasBorderProps)}
      title={uiT("Border")}
      expsProvider={expsProvider}
      styleProps={borderStyleProps}
      onHeaderClick={
        shouldReactToHeaderClick ? clickOpenCloseButton : undefined
      }
      controls={
        showHeaderControls && (
          <IconLinkButton onClick={clickOpenCloseButton}>
            <Icon icon={open || hasBorderTargetProps ? MinusIcon : PlusIcon} />
          </IconLinkButton>
        )
      }
    >
      {(open || hasBorderProps) && (
        <BorderControlsWrapper
          expsProvider={expsProvider}
          borderType={BorderType.Line}
          vsh={vsh}
        />
      )}
    </StylePanelSection>
  );
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

  const shouldReactToHeaderClick =
    showHeaderControls && !open && !hasBorderRadiusTargetProps;

  return (
    <StylePanelSection
      key={String(open || hasBorderRadiusProps)}
      title={uiT("Corner radius")}
      expsProvider={expsProvider}
      styleProps={borderRadiusStyleProps}
      onHeaderClick={
        shouldReactToHeaderClick ? clickOpenCloseButton : undefined
      }
      controls={
        showHeaderControls && (
          <IconLinkButton onClick={clickOpenCloseButton}>
            <Icon
              icon={open || hasBorderRadiusTargetProps ? MinusIcon : PlusIcon}
            />
          </IconLinkButton>
        )
      }
    >
      {(open || hasBorderRadiusProps) && (
        <BorderControlsWrapper
          inputRef={inputRef}
          expsProvider={expsProvider}
          borderType={BorderType.Radius}
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

export function BorderControlsWrapper(props: {
  expsProvider: ExpsProvider;
  borderType: BorderType;
  inputRef?: React.Ref<DimTokenSpinnerRef>;
  vsh: VariantedStylesHelper;
}) {
  const { expsProvider, borderType, inputRef, vsh } = props;
  const cells = useStyleCells(expsProvider, borderType === BorderType.Line ? borderStyleProps : borderRadiusStyleProps);
  // These identities are fixed on each provider; they are not mutable reads.
  const key = JSON.stringify(expsProvider instanceof TplExpsProvider
    ? [expsProvider.tpl.uuid, ...expsProvider.targetVariantCombo.map((variant) => variant.uuid)]
    : expsProvider.targetRs().uid);
  return borderType === BorderType.Line ? (
    <BorderLineControls expsProvider={expsProvider}
      initialBorderPositions={getInitialBorderPositions(cells, borderLineStyles, standardSides)} key={key} vsh={vsh} />
  ) : (
    <BorderRadiusControls expsProvider={expsProvider} inputRef={inputRef}
      initialBorderPositions={getInitialBorderPositions(cells, borderRadiusStyles, standardCorners)} key={key} vsh={vsh} />
  );
}

function BorderLineControls(props: {
  expsProvider: ExpsProvider;
  initialBorderPositions: Side[];
  vsh: VariantedStylesHelper;
}) {
  const { t: uiT } = useI18n();
  const { expsProvider, initialBorderPositions, vsh } = props;
  const studioCtx = expsProvider.studioCtx;
  const cells = useStyleCells(expsProvider, borderStyleProps);
  const [selectedSides, setSelectedSides] = React.useState<Side[]>(
    initialBorderPositions,
  );

  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const hasSetPropRef = React.useRef(false);

  const effectiveSides = () =>
    selectedSides.length > 0 ? selectedSides : standardSides;

  const getSideProp = (side: Side, prop: string) => {
    return cells.find((cell) => cell.key === `border-${side}-${prop}`)?.value ?? "";
  };

  const getUnanimousSelectedSidesProp = (prop: string) => {
    return unanimousVal(effectiveSides().map((s) => getSideProp(s, prop)));
  };

  const getSelectedSidesWidth = () => {
    if (selectedSides.length === 0) {
      return showCssShorthand(
        effectiveSides().map((side) => getSideProp(side, "width")),
      );
    } else {
      return getUnanimousSelectedSidesProp("width");
    }
  };

  const toggleSide = (side: Side) => {
    if (selectedSides.includes(side)) {
      setSelectedSides((prevSelectedSides) =>
        prevSelectedSides.filter((s) => s !== side),
      );
    } else if (hasSetPropRef.current) {
      // If we had already set a prop with the current set of selectedSides,
      // then we treat this side button click as toggling to that side,
      // instead of adding that side to the selection
      setSelectedSides([side]);
    } else {
      // Else the user is just clicking on multiple side buttons to set
      // styles for many of them at once
      setSelectedSides((prevSelectedSides) => [...prevSelectedSides, side]);
    }
    hasSetPropRef.current = false;
  };

  const changeProp = (prop: string, value: string) => {
    hasSetPropRef.current = true;
    const exp = expsProvider.mergedExp();
    for (const side of effectiveSides()) {
      exp.set(`border-${side}-${prop}`, value);
      const widthProp = `border-${side}-width`;
      if (!exp.has(widthProp)) {
        exp.set(widthProp, "1px");
      }
      const styleProp = `border-${side}-style`;
      if (!exp.has(styleProp)) {
        exp.set(styleProp, "solid");
      }
    }
  };

  const changeWidth = async (value: string) => {
    hasSetPropRef.current = true;
    return studioCtx.changeUnsafe(() => {
      const exp = expsProvider.mergedExp();
      if (selectedSides.length === 0) {
        const newVals = parseCssShorthand(value);
        [...standardSides].forEach((side, i) =>
          exp.set(`border-${side}-width`, newVals[i]),
        );
      } else {
        changeProp("width", value);
      }
    });
  };

  const clearWidth = async () => {
    hasSetPropRef.current = true;
    return studioCtx.changeUnsafe(() => {
      const exp = expsProvider.mergedExp();
      effectiveSides().forEach((side) => exp.clear(`border-${side}-width`));
    });
  };

  return (
    <div className="flex flex-vcenter" ref={containerRef}>
      <div
        className="grid grid-cols-3 grid-rows-3 label-col"
        style={{ flexShrink: 0, marginLeft: -10 }}
      >
        <IconButton
          className="col-start-2"
          isActive={selectedSides.includes("top")}
          onClick={() => toggleSide("top")}
          tooltip={uiT("Top border")}
        >
          <Icon icon={BorderSideIcon} style={{ transform: "rotate(90deg)" }} />
        </IconButton>
        <IconButton
          className="col-start-1"
          isActive={selectedSides.includes("left")}
          onClick={() => toggleSide("left")}
          tooltip={uiT("Left border")}
        >
          <Icon icon={BorderSideIcon} />
        </IconButton>
        <IconButton
          isActive={selectedSides.length === 0}
          onClick={() => setSelectedSides([])}
          tooltip={uiT("All borders")}
        >
          <Icon icon={BorderAllIcon} />
        </IconButton>
        <IconButton
          isActive={selectedSides.includes("right")}
          onClick={() => toggleSide("right")}
          tooltip={uiT("Right border")}
        >
          <Icon icon={BorderSideIcon} style={{ transform: "rotate(180deg)" }} />
        </IconButton>
        <IconButton
          className="col-start-2"
          isActive={selectedSides.includes("bottom")}
          onClick={() => toggleSide("bottom")}
          tooltip={uiT("Bottom border")}
        >
          <Icon icon={BorderSideIcon} style={{ transform: "rotate(-90deg)" }} />
        </IconButton>
      </div>
      <div className="ml-lg flex-fill">
        <LabeledStyleDimItemRow
          label={uiT("Width")}
          styleName={effectiveSides().map((s) => `border-${s}-width`)}
          labelSize="small"
          displayStyleName="border-width"
          tokenType={"Spacing"}
          dimOpts={{
            value: getSelectedSidesWidth() || "--",
            onChange: (val) =>
              val === undefined ? spawn(clearWidth()) : spawn(changeWidth(val)),
            shorthand: selectedSides.length === 0,
            dragScale: "1",
            min: 0,
            allowedUnits: LENGTH_PERCENTAGE_UNITS,
            allowFunctions: true,
          }}
        />
        <LabeledLineStyleToggleButtonGroupItemRow
          label={uiT("Style")}
          styleName={effectiveSides().map((s) => `border-${s}-style`)}
          labelSize="small"
          value={getUnanimousSelectedSidesProp("style") || ""}
          onChange={async (val) =>
            studioCtx.changeUnsafe(() =>
              changeProp(
                "style",
                ensure(val, "Unexpected undefined value for prop"),
              ),
            )
          }
        />
        <LabeledStyleColorItemRow
          label={uiT("Color")}
          styleName={effectiveSides().map((s) => `border-${s}-color`)}
          labelSize="small"
          displayStyleName="border-color"
          colorOpts={{
            color: getUnanimousSelectedSidesProp("color"),
            onChange: async (color) =>
              studioCtx.changeUnsafe(() => changeProp("color", color)),
          }}
          vsh={vsh}
        />
      </div>
    </div>
  );
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
        effectiveCorners().forEach((corner, i) =>
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
