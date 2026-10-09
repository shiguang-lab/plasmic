import { SidebarSection } from "@/wab/client/components/sidebar/SidebarSection";
import {
  FullRow,
  LabeledStyleItem,
} from "@/wab/client/components/sidebar/sidebar-helpers";
import { DefinedIndicator } from "@/wab/client/components/style-controls/DefinedIndicator";
import {
  ExpsProvider,
  TplExpsProvider,
} from "@/wab/client/components/style-controls/StyleComponent";
import DimTokenSpinner from "@/wab/client/components/widgets/DimTokenSelector";
import { useI18n } from "@/wab/client/i18n";
import { UiText } from "@/wab/client/i18n/UiText";
import { spawn } from "@/wab/shared/common";
import { NUMBER_UNITS } from "@/wab/shared/css/types";
import { parseGridChildCssProps } from "@/wab/shared/grid-utils";
import { observer } from "mobx-react";
import { ok } from "neverthrow";
import React from "react";

export const GridChildSection = observer(function GridChildSection(props: {
  expsProvider: ExpsProvider;
}) {
  const { t: uiT } = useI18n();
  const { expsProvider } = props;

  const childTpl =
    expsProvider instanceof TplExpsProvider ? expsProvider.tpl : undefined;

  if (!childTpl) {
    return null;
  }

  const studioCtx = expsProvider.studioCtx;

  const gridChildSpec = parseGridChildCssProps(expsProvider.mergedExp());

  const definedIndicators = [
    expsProvider.definedIndicator("grid-row-start"),
    expsProvider.definedIndicator("grid-row-end"),
    expsProvider.definedIndicator("grid-column-start"),
    expsProvider.definedIndicator("grid-column-end"),
  ];

  const handleChange = (prop: "row" | "column", dir: "start" | "end") => {
    return (val) => {
      spawn(
        studioCtx.change(() => {
          if (!val) {
            expsProvider.targetExp().clear(`grid-${prop}-${dir}`);
          } else {
            expsProvider
              .targetExp()
              .set(
                `grid-${prop}-${dir}`,
                `${dir === "end" ? "span " : ""}${+val}`,
              );
          }

          return ok();
        }),
      );
    };
  };

  return (
    <SidebarSection
      title={uiT("Grid Child")}
      isHeaderActive={true}
      definedIndicator={
        <DefinedIndicator label={uiT("GridChild")} type={definedIndicators} />
      }
    >
      <FullRow>
        <LabeledStyleItem
          label={
            <div style={{ minWidth: 90 }}>
              <UiText message={"Row"} />
            </div>
          }
          styleName="grid-row"
        >
          <FullRow twinCols>
            <div className="flex flex-col flex-align-start">
              <DimTokenSpinner
                value={gridChildSpec.row.start ?? ""}
                onChange={handleChange("row", "start")}
                min={1}
                allowedUnits={NUMBER_UNITS}
                allowFunctions={false}
              />
              <span>
                <UiText message={"Start"} />
              </span>
            </div>
            <div className="flex flex-col flex-align-start">
              <DimTokenSpinner
                value={gridChildSpec.row.span ?? "1"}
                onChange={handleChange("row", "end")}
                min={1}
                noClear={true}
                allowedUnits={NUMBER_UNITS}
                allowFunctions={false}
              />
              <span>
                <UiText message={"Span"} />
              </span>
            </div>
          </FullRow>
        </LabeledStyleItem>
      </FullRow>
      <FullRow>
        <LabeledStyleItem
          label={
            <div style={{ minWidth: 90 }}>
              <UiText message={"Column"} />
            </div>
          }
          styleName="grid-column"
        >
          <FullRow twinCols>
            <div className="flex flex-col flex-align-start">
              <DimTokenSpinner
                value={gridChildSpec.column.start ?? ""}
                onChange={handleChange("column", "start")}
                min={1}
                allowedUnits={NUMBER_UNITS}
                allowFunctions={false}
              />
              <span>
                <UiText message={"Start"} />
              </span>
            </div>
            <div className="flex flex-col flex-align-start">
              <DimTokenSpinner
                value={gridChildSpec.column.span ?? "1"}
                onChange={handleChange("column", "end")}
                min={1}
                noClear={true}
                allowedUnits={NUMBER_UNITS}
                allowFunctions={false}
              />
              <span>
                <UiText message={"Span"} />
              </span>
            </div>
          </FullRow>
        </LabeledStyleItem>
      </FullRow>
    </SidebarSection>
  );
});
