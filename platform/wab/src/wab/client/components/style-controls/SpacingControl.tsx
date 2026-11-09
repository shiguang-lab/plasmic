import { maybeShowContextMenu } from "@/wab/client/components/ContextMenu";
import { useCommittedValue } from "@/wab/commons/components/ReactUtil";
import { LabeledStyleDimItem } from "@/wab/client/components/sidebar/sidebar-helpers";
import {
  getLabelForStyleName,
  changeStyle,
  createStyleContextMenu,
  StyleComponentProps,
} from "@/wab/client/components/style-controls/StyleComponent";
import { DimTokenSpinnerRef } from "@/wab/client/components/widgets/DimTokenSelector";
import { TriggerTarget } from "@/wab/client/components/widgets/TriggerAnchor";
import { useStyleCells, useStyleIndicators } from "@/wab/client/studio-ctx/style-inputs-react";
import { useVariantedStylesHelperFromCurrentCtx } from "@/wab/client/studio-ctx/varianted-style-context";
import { useStyleTokenRefs } from "@/wab/client/studio-ctx/style-token-ref-inputs";
import { UnloggedDragCatcher } from "@/wab/client/components/style-controls/UnloggedDragCatcher";
import { VariantedStylesHelper } from "@/wab/shared/VariantedStylesHelper";
import { useShallow } from "zustand/react/shallow";
import {
  INTERACT_OUTSIDE_EXCEPTION_SELECTORS,
  OnClickAwayExcept,
} from "@/wab/commons/components/OnClickAway";
import { Stated } from "@/wab/commons/components/Stated";
import { XDraggable } from "@/wab/commons/components/XDraggable";
import { derefTokenRefs } from "@/wab/commons/StyleToken";
import {
  ensure,
  simpleWords,
  toggleSet,
  tuple,
  unexpected,
} from "@/wab/shared/common";
import {
  getCssInitial,
  parseCssShorthand,
  showCssShorthand,
} from "@/wab/shared/css";
import {
  createNumericSize,
  isDraggableSize,
  NumericSize,
  parseNumericSize,
  showSizeCss,
} from "@/wab/shared/css-size";
import { LENGTH_PERCENTAGE_UNITS } from "@/wab/shared/css/types";
import { oppSide, Side, standardSides } from "@/wab/shared/geom";
import { Popover, Tooltip } from "antd";
import { TooltipPlacement } from "antd/lib/tooltip";
import cn from "classnames";
import * as Immutable from "immutable";
import React, { ReactNode } from "react";
import defer = setTimeout;

function closeLoop(pointsStr: /*TWZ*/ string) {
  const points = simpleWords(pointsStr);
  return tuple(...[...points], points[0]).join(" ");
}

interface SpacingControlProps extends StyleComponentProps {
  excludePadding?: boolean;
  spacingStyleProp: string;
  label?: ReactNode;
  subtitle?: ReactNode;
  popoverPlacement?: TooltipPlacement;
  // whether allow the size to be "auto". This is allowed for margin, which
  // can be used to center the element.
  allowAuto?: boolean;
}

interface SpacingRenderProps extends SpacingControlProps {
  readonly values: Readonly<Record<Side, string>>;
  readonly dragValues: Readonly<Record<Side, string>>;
  readonly measures: Readonly<Record<Side, string>>;
  readonly overrides: Readonly<Record<Side, boolean>>;
  readonly activeVsh: VariantedStylesHelper;
}

export interface SpacingControlHandle {
  setAllSelected: (value: string) => void;
  clearAllSelected: () => void;
}

function SpacingControlContent({ ref, ...props }: SpacingRenderProps & { ref?: React.Ref<SpacingControlHandle> }) {
  const studio = props.expsProvider.studioCtx;
  const { spacingStyleProp, popoverPlacement = "top", label, subtitle } = props;
  const spacingLabel = label || getLabelForStyleName(spacingStyleProp);
  const vsh = props.activeVsh;
  const [selection, setSelection] = React.useState(() => Immutable.Set<Side>());
  const [justDragged, setJustDragged] = React.useState(false);
  const [showPopover, setShowPopover] = React.useState(false);
  const [xThickness, setXThickness] = React.useState<number>();
  const [yThickness, setYThickness] = React.useState<number>();
  const spinner = React.useRef<DimTokenSpinnerRef | null>(null);
  const popoverContainer = React.useRef<HTMLDivElement | null>(null);
  const container = React.useRef<HTMLDivElement | null>(null);
  const topPart = React.useRef<SVGPolylineElement | null>(null);
  const leftPart = React.useRef<SVGPolylineElement | null>(null);
  const focusPending = React.useRef(false);
  const ignoreSpinnerBlur = React.useRef(false);
  const clearSidesOnSelection = React.useRef(false);

  React.useLayoutEffect(() => {
    if (topPart.current) { setYThickness(topPart.current.getBoundingClientRect().height); }
    if (leftPart.current) { setXThickness(leftPart.current.getBoundingClientRect().width); }
  }, [showPopover]);
  React.useLayoutEffect(() => {
    if (focusPending.current && spinner.current) { focusPending.current = false; spinner.current.focus(); }
  });

  const handleSpinnerFocus = () => setShowPopover(true);
  const handleSpinnerBlur = () => { if (!ignoreSpinnerBlur.current) { setShowPopover(false); } };
  const changeSelection = (sides: Immutable.Set<Side>) => {
    if (sides.size > 0) { focusPending.current = true; }
    setSelection(sides);
  };
  const changeSelectionSingle = (side: Side, { mode }: { mode: "toggle" | "add" }) => {
    changeSelection(mode === "toggle" ? toggleSet(selection, side)
      : selection.has(side) ? selection : Immutable.Set([side]));
  };
  const handleClick = (event: React.MouseEvent<SVGPolylineElement>, side: Side) => {
    if (clearSidesOnSelection.current) {
      clearSidesOnSelection.current = false;
      changeSelection(Immutable.Set([side]));
      return;
    }
    switch (event.detail) {
      case 1:
        if (!justDragged) { changeSelectionSingle(side, { mode: "toggle" }); }
        else { setJustDragged(false); }
        break;
      case 2: changeSelection(Immutable.Set([side, oppSide(side)])); break;
      default: changeSelection(Immutable.Set(standardSides));
    }
  };
  const selectedSides = () => selection.isEmpty() ? [...standardSides] : [...selection];
  const selectedStyleProps = () => selectedSides().map((side) => `${spacingStyleProp}-${side}`);
  const showSelectedValues = () => {
    const values = selectedSides().map((side) => props.values[side]);
    return selection.isEmpty() ? showCssShorthand(values) : new Set(values).size === 1 ? values[0] : "";
  };
  const change = (command: () => void) => changeStyle(props.expsProvider, command);
  const setAllSelected = (value: string) => {
    const names = selectedStyleProps();
    change(() => {
      const exp = props.expsProvider.mergedExp();
      if (selection.isEmpty()) {
        const values = parseCssShorthand(value);
        names.forEach((name, index) => exp.set(name, values[index]));
      } else { names.forEach((name) => exp.set(name, value)); }
    });
  };
  const clearAllSelected = () => {
    const names = selectedStyleProps();
    change(() => { const exp = props.expsProvider.mergedExp(); names.forEach((name) => exp.clear(name)); });
  };
  const readCommands = useCommittedValue({ setAllSelected, clearAllSelected });
  const commands = React.useMemo<SpacingControlHandle>(() => ({
    setAllSelected: (value) => readCommands().setAllSelected(value),
    clearAllSelected: () => readCommands().clearAllSelected(),
  }), [readCommands]);
  React.useImperativeHandle(ref, () => commands, [commands]);
  const showStyleContextMenu = (event: React.MouseEvent<SVGPolylineElement>, name: string) => {
    if (!props.expsProvider.getNativeStyleSource().inputs.isDisposed) {
      maybeShowContextMenu(event.nativeEvent, createStyleContextMenu(props.expsProvider, [name]));
    }
  };

    return (
      <OnClickAwayExcept
        getAllowedContainers={() => [
          ...Array.from(popoverContainer.current?.querySelectorAll("polyline.spacing-control__handle") ?? []),
          ...Array.from(container.current?.querySelectorAll('[data-plasmic-role="labeled-item"]') ?? []),
          ...Array.from(document.querySelectorAll(INTERACT_OUTSIDE_EXCEPTION_SELECTORS.join(","))),
        ]}
        callback={() => {
          if (selection.size > 0) {
            changeSelection(Immutable.Set<Side>());
            handleSpinnerBlur();
          }
        }}
      >
        <div className="spacing-control__container" ref={container}>
          <Popover
            open={showPopover}
            placement={popoverPlacement}
            content={
              <div
                className="spacing-control__handles-container"
                onMouseEnter={() => (ignoreSpinnerBlur.current = true)}
                onMouseLeave={() => (ignoreSpinnerBlur.current = false)}
                ref={popoverContainer}
              >
                <svg className="spacing-control__svg" viewBox="0 0 130 64">
                  {(() => {
                    // Options for building this}{ from worst to best}{ and their
                    // issues:  - CSS shapes made using border tricks (a la
                    // https://css-tricks.com/examples/ShapesOfCSS/) obstruct each
                    // other with the transparent parts of those divs}{ so you
                    // can't craft the diagonal hover regions using these shapes. -
                    // clip-path polygon only operates by %}{ which is cumbersome
                    // to adjust to the required dimensions. - SVG requires manual
                    // positioning calculations}{ doesn't benefit from CSS
                    // reloading}{ and can't nest HTML (so we overlay
                    // no-pointer-event divs instead)}{ but is the most flexible.
                    const xthick = 36,
                      ythick = 24;
                    const xmax = 130,
                      ymax = 64,
                      top = 0,
                      left = 0;
                    const sides = {
                      top: `0,0 ${xthick},${ythick} ${
                        xmax - xthick
                      },${ythick} ${xmax},0`,
                      right: `${xmax},0 ${xmax - xthick},${ythick} ${
                        xmax - xthick
                      },${ymax - ythick} ${xmax},${ymax}`,
                      bottom: `${xmax},${ymax} ${xmax - xthick},${
                        ymax - ythick
                      } ${xthick},${ymax - ythick} 0,${ymax}`,
                      left: `0,${ymax} ${xthick},${
                        ymax - ythick
                      } ${xthick},${ythick} 0,0`,
                    };

                    return standardSides.map((side) => {
                      const points = closeLoop(sides[side]);

                      // Initially I tried to make the drag go with the
                      // actual movement you see reflected back.  Consider
                      // dragging bottom on a normal block div: increasing
                      // padding moves elements down, so dragging down
                      // should be +1.  But with right, increasing padding
                      // moves content leftward, not rightward, breaking
                      // the consistency with bottom.  This is because
                      // widths on normal block divs are fixed (auto or
                      // 100%), so things can't move rightward.  Quickly we
                      // realize that whether things move up/down or
                      // leftward/rightward depends on a ton of context:  -
                      // Is this fixed width? - Is this left aligned vs
                      // right aligned?  (Note this can vary by instance
                      // since it depends on parent container's text-align,
                      // flex settings, or this element's float, flex
                      // settings!) - etc.  This is unwieldy, so for now we
                      // just hardcode the positive drag directions.
                      const [xFactor, yFactor] = ((): [number, number] => {
                        switch (side) {
                          case "top":
                            return tuple(0, 1);
                          case "bottom":
                            return tuple(0, -1);
                          case "left":
                            return tuple(1, 0);
                          case "right":
                            return tuple(-1, 0);
                          default:
                            return unexpected();
                        }
                      })();
                      const maybeTokenValue = props.dragValues[side];
                      const isDraggingDisabled =
                        !isDraggableSize(maybeTokenValue);
                      return (
                        <Tooltip
                          open={false}
                          title={getLabelForStyleName(
                            `${spacingStyleProp}-${side}`,
                          )}
                          key={`${spacingStyleProp} ${side}`}
                        >
                          <g>
                            <Stated<NumericSize | undefined>
                              defaultValue={undefined}
                            >
                              {(initDim, setInitDim) => (
                                <XDraggable
                                  nodeRef={side === "top" ? topPart : side === "left" ? leftPart : undefined}
                                  disabled={isDraggingDisabled}
                                  onStart={() => {
                                    studio.startUnlogged();
                                    changeSelectionSingle(side, {
                                      mode: "add",
                                    });
                                    setJustDragged(false);
                                    setInitDim(
                                      parseNumericSize(maybeTokenValue),
                                    );
                                  }}
                                  onDrag={(e) => {
                                    change(() => {
                                      const { num, unit } = ensure(
                                        initDim,
                                        "onDrag listener expects a initDim",
                                      );
                                      if (!justDragged) {
                                        setJustDragged(true);
                                      }
                                      setAllSelected(
                                        showSizeCss(
                                          createNumericSize(
                                            num +
                                              xFactor * e.data.deltaX +
                                              yFactor * e.data.deltaY,
                                            unit,
                                          ),
                                        ),
                                      );
                                    });
                                  }}
                                  onStop={() => {
                                    defer(() => {
                                      focusPending.current = true;
                                      setJustDragged(false);
                                      spinner.current?.focus();
                                    });
                                    studio.stopUnlogged();
                                    setInitDim(undefined);
                                  }}
                                >
                                  <polyline
                                    className={cn({
                                      "spacing-control__handle": true,
                                      "spacing-control__handle--selected":
                                        selection.has(side),
                                      "ew-resize":
                                        ["left", "right"].includes(side) &&
                                        !isDraggingDisabled,
                                      "ns-resize":
                                        ["top", "bottom"].includes(side) &&
                                        !isDraggingDisabled,
                                    })}
                                    ref={
                                      side === "top"
                                        ? topPart
                                        : side === "left"
                                          ? leftPart
                                          : undefined
                                    }
                                    transform={`translate(${left},${top})`}
                                    points={points}
                                    onClick={(e) => handleClick(e, side)}
                                    onContextMenu={(ev) =>
                                      showStyleContextMenu(
                                        ev,
                                        `${spacingStyleProp}-${side}`,
                                      )
                                    }
                                  />
                                </XDraggable>
                              )}
                            </Stated>
                          </g>
                        </Tooltip>
                      );
                    });
                  })()}
                </svg>
                <div className={`spacing-control__nums`}>
                  {standardSides.map((side) => (
                    <div
                      key={side}
                      className={`spacing-control__${side}`}
                      style={
                        ["top", "bottom"].includes(side)
                          ? yThickness
                            ? { height: yThickness }
                            : undefined
                          : xThickness
                            ? { width: xThickness }
                            : undefined
                      }
                    >
                      <div className={"spacing-control__num"}>
                        <UnloggedDragCatcher sc={studio}>
                          <XDraggable onStart={() => undefined}>
                            <div className={props.overrides[side] ? "overriding" : undefined}>
                              {props.measures[side]}
                            </div>
                          </XDraggable>
                        </UnloggedDragCatcher>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            }
          >
            {/* LabeledStyleDimItem doesn't forward refs; TriggerTarget
                anchors the popover on its root element. */}
            <TriggerTarget>
              <LabeledStyleDimItem
                styleName={selectedStyleProps()}
                displayStyleName={props.spacingStyleProp}
                label={spacingLabel}
                subtitle={subtitle}
                tokenType={"Spacing"}
                vsh={vsh}
                dimOpts={{
                  ref: spinner,
                  value: showSelectedValues(),
                  onChange: (val) => {
                    clearSidesOnSelection.current = true;
                    if (val === undefined) {
                      clearAllSelected();
                    } else {
                      setAllSelected(val);
                    }
                    defer(() => spinner.current?.focus());
                  },
                  onFocus: handleSpinnerFocus,
                  onBlur: handleSpinnerBlur,
                  shorthand: selection.isEmpty(),
                  extraOptions: props.allowAuto ? ["auto"] : [],
                  dragScale: "10",
                  min: spacingStyleProp === "padding" ? 0 : undefined,
                  allowedUnits: LENGTH_PERCENTAGE_UNITS,
                  allowFunctions: true,
                }}
              />
            </TriggerTarget>
          </Popover>
        </div>
      </OnClickAwayExcept>
    );
}

export function SpacingControl({ ref, ...props }: SpacingControlProps & { ref?: React.Ref<SpacingControlHandle> }) {
  const studio = props.expsProvider.studioCtx;
  const lifetime = React.useMemo(() => studio.arenaState.lifetime(), [studio, props.expsProvider]);
  const subscribe = React.useCallback((notify: () => void) => {
    lifetime.addEventListener("abort", notify);
    return () => lifetime.removeEventListener("abort", notify);
  }, [lifetime]);
  const readActive = React.useCallback(() => !lifetime.aborted, [lifetime]);
  const active = React.useSyncExternalStore(subscribe, readActive, readActive);
  return active ? <SpacingInputs {...props} controlRef={ref} /> : null;
}

function SpacingInputs({ controlRef, ...props }: SpacingControlProps & { controlRef: React.Ref<SpacingControlHandle> | undefined }) {
  const studio = props.expsProvider.studioCtx;
  const keys = standardSides.map((side) => `${props.spacingStyleProp}-${side}`);
  const cells = useStyleCells(props.expsProvider, keys);
  const indicators = useStyleIndicators(props.expsProvider, keys);
  const currentVsh = useVariantedStylesHelperFromCurrentCtx(props.vsh ? undefined : studio);
  const vsh = props.vsh ?? currentVsh;
  const baseVsh = React.useMemo(() => new VariantedStylesHelper(), []);
  // An initially closed provider has no installed cells. Keep its token
  // demand empty and do not rematerialize old command inputs in a new world.
  const installed = keys.map((key) => cells.find((cell) => cell.key === key)?.value).filter((value) => value !== undefined);
  const complete = installed.length === keys.length;
  const values = complete ? installed : [];
  const dragInputs = values.map((value, index) => value === "auto" ? getCssInitial(keys[index], "div") : value);
  const dragValues = useStyleTokenRefs(studio, dragInputs, vsh, "SpacingOnly", useShallow((state) => state.rows.map((row) => row.resolved?.value ?? derefTokenRefs([], row.input))));
  // The original measureDisp intentionally uses the base value, while drag
  // behavior follows the active variant context passed to this control.
  const measures = useStyleTokenRefs(studio, values, baseVsh, "SpacingOnly", useShallow((state) => state.rows.map((row) => row.resolved?.value ?? derefTokenRefs([], row.input))));
  const sides = <Value,>(items: readonly Value[]): Readonly<Record<Side, Value>> => ({
    top: ensure(items[standardSides.indexOf("top")], "Top spacing input"),
    right: ensure(items[standardSides.indexOf("right")], "Right spacing input"),
    bottom: ensure(items[standardSides.indexOf("bottom")], "Bottom spacing input"),
    left: ensure(items[standardSides.indexOf("left")], "Left spacing input"),
  });
  if (!complete) { return null; }
  return <SpacingControlContent {...props} ref={controlRef} activeVsh={vsh}
    values={sides(values)} dragValues={sides(dragValues.selected)} measures={sides(measures.selected)}
    overrides={sides(indicators.map((indicator) => indicator.source === "set"))} />;
}
