import S from "@/wab/client/components/sidebar-tabs/ColumnsSection.module.scss";
import {
  FullRow,
  LabeledItemRow,
} from "@/wab/client/components/sidebar/sidebar-helpers";
import StyleCheckbox from "@/wab/client/components/style-controls/StyleCheckbox";
import { ExpsProvider } from "@/wab/client/components/style-controls/StyleComponent";
import { useColumnsWrapInputs } from "@/wab/client/studio-ctx/columns-wrap-inputs";
import { useStyleCells } from "@/wab/client/studio-ctx/style-inputs-react";
import { IconLinkButton } from "@/wab/client/components/widgets";
import DimTokenSpinner from "@/wab/client/components/widgets/DimTokenSelector";
import { Icon } from "@/wab/client/components/widgets/Icon";
import { useI18n } from "@/wab/client/i18n";
import { UiText } from "@/wab/client/i18n/UiText";
import MinusIcon from "@/wab/client/plasmic/plasmic_kit/PlasmicIcon__Minus";
import PlusIcon from "@/wab/client/plasmic/plasmic_kit/PlasmicIcon__Plus";
import { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import {
  isReverseValue,
  redistributeColumns,
  updateCurrentTplColumns,
} from "@/wab/shared/columns-utils";
import { ensure, spawn } from "@/wab/shared/common";
import { TplColumnsTag } from "@/wab/shared/core/tpls";
import { NUMBER_UNITS } from "@/wab/shared/css/types";
import { ColumnsConfig } from "@/wab/shared/model/classes";
import cn from "classnames";
import { clamp } from "lodash";
import { ok } from "neverthrow";
import React from "react";

export function ColumnsWrapControls(props: {
    config: ColumnsConfig | undefined;
    viewCtx: ViewCtx;
    tpl: TplColumnsTag;
    expsProvider: ExpsProvider;
    isDisabled?: boolean;
  }) {
    const { t: uiT } = useI18n();
    const { viewCtx, tpl, config, isDisabled, expsProvider } = props;
    const { breakUpRows, colsSizes, childCount } = useColumnsWrapInputs(viewCtx, tpl, config);
    const studioCtx = viewCtx.studioCtx;
    const currentConfig = () => ensure(viewCtx.effectiveCurrentVariantSetting(tpl).columnsConfig, "Responsive columns config must exist for editing");
    const [flexDirectionCell, flexWrapCell] = useStyleCells(
      expsProvider,
      ["flex-direction", "flex-wrap"],
    );

    const isReversed =
      isReverseValue(flexDirectionCell?.value ?? "") ||
      isReverseValue(flexWrapCell?.value ?? "");

    const handleChangeColsPerRow = async (delta: number, absolute = false) => {
      await studioCtx.change<never>(() => {
        const actual = currentConfig();
        const newColsPerRow = clamp(
          absolute ? delta : actual.colsSizes.length + delta,
          1,
          tpl.children.length,
        );
        updateCurrentTplColumns(
          tpl,
          {
            colsSizes: redistributeColumns(actual.colsSizes, newColsPerRow),
          },
          viewCtx.variantTplMgr(),
        );
        return ok();
      });
    };

    return (
      <>
        <LabeledItemRow>
          <StyleCheckbox
            isDisabled={isDisabled}
            isChecked={breakUpRows}
            onChange={async (val) => {
              await studioCtx.change<never>(() => {
                updateCurrentTplColumns(
                  tpl,
                  {
                    breakUpRows: val,
                    colsSizes: redistributeColumns(
                      currentConfig().colsSizes,
                      tpl.children.length,
                    ),
                  },
                  viewCtx.variantTplMgr(),
                );
                return ok();
              });
            }}
          >
            <UiText message={"Wrap?"} />
          </StyleCheckbox>
          <StyleCheckbox
            className="ml-m"
            isDisabled={isDisabled}
            isChecked={isReversed}
            onChange={async (val) => {
              await studioCtx.change(() => {
                const exp = expsProvider.mergedExp();
                if (currentConfig().breakUpRows) {
                  exp.set("flex-wrap", `wrap${val ? "-reverse" : ""}`);
                } else {
                  exp.set("flex-direction", `row${val ? "-reverse" : ""}`);
                }
                return ok();
              });
            }}
          >
            <UiText message={"Reverse?"} />
          </StyleCheckbox>
        </LabeledItemRow>
        {breakUpRows && (
          <LabeledItemRow label={uiT("Columns / row")}>
            <FullRow twinCols>
              <DimTokenSpinner
                disabled={isDisabled || !breakUpRows}
                value={`${colsSizes.length}`}
                onChange={async (val) => {
                  if (val && +val !== colsSizes.length && +val > 0) {
                    spawn(handleChangeColsPerRow(+val, true));
                  }
                }}
                noClear
                allowedUnits={NUMBER_UNITS}
                extraOptions={[]}
                min={1}
                max={childCount}
                studioCtx={studioCtx}
                allowFunctions={false}
              />
              <div className={cn("flex justify-end", S.iconsMargin)}>
                <IconLinkButton
                  disabled={
                    isDisabled || !breakUpRows || colsSizes.length === 1
                  }
                  onClick={() => handleChangeColsPerRow(-1)}
                >
                  <Icon icon={MinusIcon} />
                </IconLinkButton>
                <IconLinkButton
                  disabled={
                    isDisabled ||
                    !breakUpRows ||
                    colsSizes.length === childCount
                  }
                  onClick={() => handleChangeColsPerRow(1)}
                >
                  <Icon icon={PlusIcon} />
                </IconLinkButton>
              </div>
            </FullRow>
          </LabeledItemRow>
        )}
      </>
    );
  }
