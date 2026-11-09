import { useStudioSelection } from "@/wab/client/studio-ctx/selection-state";
import {
  MaybeCollapsibleRowsRenderer,
  SidebarSection,
} from "@/wab/client/components/sidebar/SidebarSection";
import {
  FullRow,
  LabeledStyleDimItem,
  LabeledStyleItemRow,
} from "@/wab/client/components/sidebar/sidebar-helpers";
import {
  PosControls2,
  PosPushButtons,
} from "@/wab/client/components/style-controls/PosControls";
import {
  ExpsProvider,
  StyleComponentProps,
  StylePanelSection,
  TplExpsProvider,
} from "@/wab/client/components/style-controls/StyleComponent";
import StyleToggleButton from "@/wab/client/components/style-controls/StyleToggleButton";
import StyleToggleButtonGroup from "@/wab/client/components/style-controls/StyleToggleButtonGroup";
import { AlignItemsControls } from "@/wab/client/components/style-controls/align-items-controls";
import { DimTokenSpinner } from "@/wab/client/components/widgets/DimTokenSelector";
import { LabelWithDetailedTooltip } from "@/wab/client/components/widgets/LabelWithDetailedTooltip";
import { getUiLocale, useI18n } from "@/wab/client/i18n";
import { UiLabel, UiText } from "@/wab/client/i18n/UiText";
import { translate } from "@/wab/client/i18n/locales";
import { isStylePropSet } from "@/wab/client/utils/style-utils";
import {
  Axis,
  TrackRange,
  parseGridChildAreaCss,
  showGridChildCss,
} from "@/wab/shared/Grids";
import { mapify } from "@/wab/shared/common";
import { LENGTH_PERCENTAGE_UNITS, NUMBER_UNITS } from "@/wab/shared/css/types";
import { standardSides } from "@/wab/shared/geom";
import { ContainerType } from "@/wab/shared/layoututils";
import { produce } from "immer";
import { useStylePanelLayoutInputs, useStylePanelLayoutSnapshot } from "@/wab/client/studio-ctx/style-panel-layout-inputs";
import React from "react";

function PositioningPanelSectionBody(props: StyleComponentProps & { inputs: ReturnType<typeof useStylePanelLayoutSnapshot> }) {
  const studio = props.expsProvider.studioCtx;
  const focusedView = useStudioSelection(studio, (state) => state.view);
  const inputs = props.inputs;
      if (props.expsProvider instanceof TplExpsProvider && !inputs.layout?.showPositioning) {
        return (
          <SidebarSection
            title={
              <LabelWithDetailedTooltip
                tooltip={
                  focusedView?.component.pageMeta ? (
                    <div>
                      <UiText
                        message={
                          "Positioning controls are disabled on root elements, because a page always takes up the full window."
                        }
                      />
                    </div>
                  ) : (
                    <div>
                      <UiText
                        message={
                          "Positioning controls are disabled on root element."
                        }
                      />{" "}
                      <strong>
                        <UiText
                          message={"Set it on component instances instead."}
                        />
                      </strong>
                    </div>
                  )
                }
              >
                <UiText message={"Position"} />
              </LabelWithDetailedTooltip>
            }
          />
        );
      }

      const exps = props.expsProvider;
      const curPosition = inputs.position;
      const isAuto = inputs.isAuto;
      const parentContainerType = inputs.parentContainerType;
      const parentIsFlex = ["flex-row", "flex-column"].includes(
        parentContainerType || "",
      );
      const parentIsFree = parentContainerType === "free";

      const parentIsCodeComponent = inputs.layout?.parentIsCodeComponent ?? false;

      const expsProvider = props.expsProvider;

      let toggleButtons = [
        {
          label: translate(getUiLocale(), "Free"),
          tooltip: translate(getUiLocale(), "Free"),
          value: "absolute",
        },
        {
          label: translate(getUiLocale(), "Sticky"),
          tooltip: translate(getUiLocale(), "Sticky"),
          value: "sticky",
        },
        {
          label: translate(getUiLocale(), "Fixed"),
          tooltip: translate(getUiLocale(), "Fixed"),
          value: "fixed",
        },
      ];

      if (!parentIsFree) {
        // Don't show Auto if parent is free container
        toggleButtons = [
          {
            label: translate(getUiLocale(), "Auto"),
            tooltip: translate(getUiLocale(), "Auto"),
            value: "relative",
          },
          ...toggleButtons,
        ];
      }

      const styleProps = [
        "position",
        "z-index",
        "vertical-align",
        ...standardSides,
        // Flex child settings
        "align-self",
        "order",
        // Grid child settings
        "grid-row",
        "grid-column",
        "justify-self",
        "align-self",
      ];
      const defaultStyleProps = mapify({ position: "relative" });

      const collapsableIndicatorNames = ["z-index", ...standardSides];
      return (
        <>
          <StylePanelSection
            expsProvider={props.expsProvider}
            title={<UiText message={"Position"} />}
            unremovableStyleProps={
              // You cannot remove "position" if you're a base variant
              exps instanceof TplExpsProvider &&
              inputs.layout?.isBaseTarget &&
              !parentIsCodeComponent
                ? ["position"]
                : []
            }
            defaultStyleProps={defaultStyleProps}
            styleProps={styleProps}
            collapsableIndicatorNames={collapsableIndicatorNames}
            controls={
              <StyleToggleButtonGroup
                value={curPosition}
                autoWidth
                onChange={(val) =>
                  studio.changeUnsafe(() => {
                    props.expsProvider.onPositionChange(val);
                  })
                }
              >
                {toggleButtons.map((button) => (
                  <StyleToggleButton
                    key={button.label}
                    showLabel
                    label={<UiLabel text={button.label} />}
                    tooltip={<UiLabel text={button.tooltip} />}
                    value={button.value}
                    children={null}
                    noIcon
                  />
                ))}
              </StyleToggleButtonGroup>
            }
            hasMore
          >
            {(renderMaybeCollapsibleRows) =>
              curPosition && (
                <>
                  <div>
                    {curPosition === "absolute" && (
                      <FreeChildSettings
                        expsProvider={props.expsProvider}
                        renderMaybeCollapsibleRows={renderMaybeCollapsibleRows}
                      />
                    )}
                    {curPosition === "fixed" && (
                      <FixedChildSettings
                        expsProvider={props.expsProvider}
                        renderMaybeCollapsibleRows={renderMaybeCollapsibleRows}
                      />
                    )}
                    {curPosition === "sticky" && (
                      <StickyChildSettings
                        flexParent={parentIsFlex}
                        expsProvider={props.expsProvider}
                        renderMaybeCollapsibleRows={renderMaybeCollapsibleRows}
                      />
                    )}
                    {isAuto && (
                      <AutoChildSettings
                        parentContainerType={parentContainerType}
                        expsProvider={expsProvider}
                        renderMaybeCollapsibleRows={renderMaybeCollapsibleRows}
                      />
                    )}
                  </div>
                </>
              )
            }
          </StylePanelSection>
        </>
      );
}

const positioningKeys = ["position", "z-index", "vertical-align", "top", "right", "bottom", "left", "align-self", "order", "grid-row", "grid-column", "justify-self"];
export const PositioningPanelSection = React.memo(function PositioningPanelSection(props: StyleComponentProps) {
  const inputs = useStylePanelLayoutSnapshot(props.expsProvider, positioningKeys, ["display", "flex-direction"]);
  return inputs.active ? <PositioningPanelSectionBody {...props} inputs={inputs} /> : null;
});

function MiniLabel({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className={"MiniLabel"}>
      <div className={"MiniLabel__label"}>{label}</div>
      <div className={"MiniLabel__content"}>{children}</div>
    </div>
  );
}

const AutoChildSettings = React.memo(function AutoChildSettings(props: {
  expsProvider: ExpsProvider;
  renderMaybeCollapsibleRows?: MaybeCollapsibleRowsRenderer;
  parentContainerType: ContainerType | undefined;
}) {
  const { t: uiT } = useI18n();
  const { expsProvider, parentContainerType } = props;
  const inputs = useStylePanelLayoutSnapshot(expsProvider, positioningKeys, ["display", "flex-direction"]);
  if (!inputs.active) { return null; }
  const flexDir = inputs.parentCells.find((cell) => cell.key === "flex-direction")?.value.split("-")[0];

  const isSet = isStylePropSet(expsProvider);

  return (
    <>
      {["flex-row", "flex-column"].includes(parentContainerType || "") && (
        <AlignItemsControls
          expsProvider={expsProvider}
          prop="align-self"
          dir={flexDir || "row"}
          includeAuto={true}
          isFlex={true}
        />
      )}
      {parentContainerType === "content-layout" && (
        <AlignItemsControls
          expsProvider={expsProvider}
          prop="justify-self"
          dir={"column"}
          includeAuto={true}
          isFlex={false}
        />
      )}
      {props.renderMaybeCollapsibleRows?.([
        ["flex-row", "flex-column", "content-layout"].includes(
          parentContainerType || "",
        )
          ? {
              collapsible: !isSet("order") && !isSet("z-index"),
              content: (
                <FullRow twinCols>
                  <LabeledStyleDimItem
                    label={uiT("Order")}
                    styleName="order"
                    dimOpts={{
                      allowedUnits: NUMBER_UNITS,
                      extraOptions: [],
                      dragScale: "1",
                      allowFunctions: false,
                    }}
                    labelSize="small"
                  />
                  <LabeledStyleDimItem
                    label={uiT("Z-index")}
                    styleName="z-index"
                    dimOpts={{
                      allowedUnits: NUMBER_UNITS,
                      extraOptions: [],
                      dragScale: "1",
                      allowFunctions: false,
                    }}
                    labelSize="small"
                  />
                </FullRow>
              ),
            }
          : {
              collapsible: !isSet("z-index"),
              content: (
                <FullRow>
                  <div style={{ marginLeft: "auto", width: "50%" }}>
                    <LabeledStyleDimItem
                      label={uiT("Z-index")}
                      styleName="z-index"
                      dimOpts={{
                        allowedUnits: NUMBER_UNITS,
                        extraOptions: [],
                        dragScale: "1",
                        allowFunctions: false,
                      }}
                      labelSize="small"
                    />
                  </div>
                </FullRow>
              ),
            },
      ])}
    </>
  );
});

const FreeChildSettings = function FreeChildSettings({
  expsProvider,
  renderMaybeCollapsibleRows,
}: {
  expsProvider: ExpsProvider;
  renderMaybeCollapsibleRows?: MaybeCollapsibleRowsRenderer;
}) {
  const { t: uiT } = useI18n();
  return (
    <>
      <FullRow>
        <PosPushButtons expsProvider={expsProvider} />
      </FullRow>
      {renderMaybeCollapsibleRows?.([
        {
          collapsible: true,
          content: (
            <FullRow>
              <PosControls2 expsProvider={expsProvider} />
            </FullRow>
          ),
        },
        {
          collapsible: true,
          content: (
            <FullRow>
              <div style={{ marginLeft: "auto", width: "50%" }}>
                <LabeledStyleDimItem
                  label={uiT("Z-index")}
                  styleName="z-index"
                  dimOpts={{
                    allowedUnits: NUMBER_UNITS,
                    dragScale: "1",
                    allowFunctions: false,
                  }}
                  labelSize="small"
                />
              </div>
            </FullRow>
          ),
        },
      ])}
    </>
  );
};

const FixedChildSettings = function FixedChildSettings({
  expsProvider,
  renderMaybeCollapsibleRows,
}: {
  expsProvider: ExpsProvider;
  renderMaybeCollapsibleRows?: MaybeCollapsibleRowsRenderer;
}) {
  const { t: uiT } = useI18n();
  return (
    <>
      <FullRow>
        <PosPushButtons expsProvider={expsProvider} />
      </FullRow>
      {renderMaybeCollapsibleRows?.([
        {
          collapsible: true,
          content: (
            <FullRow>
              <PosControls2
                expsProvider={expsProvider}
                dimOpts={{
                  max: 300, // For fixed elements 300px is plenty of space to set it,
                  allowedUnits: LENGTH_PERCENTAGE_UNITS,
                }}
              />
            </FullRow>
          ),
        },
        {
          collapsible: true,
          content: (
            <FullRow>
              <div style={{ marginLeft: "auto", width: "50%" }}>
                <LabeledStyleDimItem
                  label={uiT("Z-index")}
                  styleName="z-index"
                  dimOpts={{
                    allowedUnits: NUMBER_UNITS,
                    dragScale: "1",
                    allowFunctions: false,
                  }}
                  labelSize="small"
                />
              </div>
            </FullRow>
          ),
        },
      ])}
    </>
  );
};

const GridChildSettings = React.memo(function GridChildSettings(props: {
  expsProvider: ExpsProvider;
}) {
  const { t: uiT } = useI18n();
  const { expsProvider } = props;
  const active = useStylePanelLayoutInputs(expsProvider, ["grid-row", "grid-column"]);
  if (!active) { return null; }
  const sc = expsProvider.studioCtx;
  const exp = () => expsProvider.mergedExp();

  const area = parseGridChildAreaCss({
    gridRow: exp().get("grid-row"),
    gridColumn: exp().get("grid-column"),
  });

  const renderPlacement = (
    label: string,
    axis: Axis,
    startEnd: keyof TrackRange,
  ) => {
    return (
      <div className={"panel-col-3"}>
        <MiniLabel label={label}>
          <DimTokenSpinner
            value={"" + area[axis][startEnd]}
            onChange={async (val) =>
              sc.changeUnsafe(() =>
                exp().merge(
                  showGridChildCss({
                    id: "",
                    area: produce(area, (draft) => {
                      draft[axis][startEnd] = val ? +val : 0;
                    }),
                  }),
                ),
              )
            }
            allowedUnits={NUMBER_UNITS}
            allowFunctions={false}
          />
        </MiniLabel>
      </div>
    );
  };

  return (
    <>
      <LabeledStyleItemRow
        label={uiT("Placement")}
        styleName={["grid-row", "grid-column"]}
        labelSize="small"
      >
        <div>
          <div className={"panel-row"}>
            {renderPlacement("Row Start", "rows", "start")}
            {renderPlacement("Row End", "rows", "end")}
            {renderPlacement("Col Start", "cols", "start")}
            {renderPlacement("Col End", "cols", "end")}
          </div>
        </div>
      </LabeledStyleItemRow>

      <AlignItemsControls
        label={uiT("Justify")}
        expsProvider={expsProvider}
        prop="justify-self"
        dir="column"
        includeAuto={true}
        isFlex={false}
      />

      <AlignItemsControls
        label={uiT("Align")}
        expsProvider={expsProvider}
        prop="align-self"
        dir="row"
        includeAuto={true}
        isFlex={false}
      />
    </>
  );
});

const StickyChildSettings = React.memo(function StickyChildSettings({
  expsProvider,
  renderMaybeCollapsibleRows,
  flexParent,
}: {
  expsProvider: ExpsProvider;
  renderMaybeCollapsibleRows?: MaybeCollapsibleRowsRenderer;
  flexParent?: boolean;
}) {
  const { t: uiT } = useI18n();
  const inputs = useStylePanelLayoutSnapshot(expsProvider, positioningKeys, ["display", "flex-direction"]);
  if (!inputs.active) { return null; }
  const flexDir = inputs.parentCells.find((cell) => cell.key === "flex-direction")?.value.split("-")[0];

  return (
    <>
      <FullRow>
        <PosControls2 expsProvider={expsProvider} />
      </FullRow>
      {renderMaybeCollapsibleRows?.([
        ...(flexParent
          ? [
              {
                collapsible: true,
                content: (
                  <AlignItemsControls
                    expsProvider={expsProvider}
                    prop="align-self"
                    dir={flexDir || "row"}
                    includeAuto={true}
                    isFlex={true}
                  />
                ),
              },
            ]
          : []),
        {
          collapsible: true,
          content: (
            <FullRow>
              <div style={{ marginLeft: "auto", width: "50%" }}>
                <LabeledStyleDimItem
                  label={uiT("Z-index")}
                  styleName="z-index"
                  dimOpts={{
                    allowedUnits: NUMBER_UNITS,
                    dragScale: "1",
                    min: 1,
                    allowFunctions: false,
                  }}
                  labelSize="small"
                />
              </div>
            </FullRow>
          ),
        },
      ])}
    </>
  );
});
