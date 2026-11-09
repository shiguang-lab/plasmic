import {
  FullRow,
  LabeledItem,
} from "@/wab/client/components/sidebar/sidebar-helpers";
import {
  StyleComponentProps,
} from "@/wab/client/components/style-controls/StyleComponent";
import StyleToggleButton from "@/wab/client/components/style-controls/StyleToggleButton";
import StyleToggleButtonGroup from "@/wab/client/components/style-controls/StyleToggleButtonGroup";
import { ColorPicker } from "@/wab/client/components/widgets/ColorPicker";
import { DimTokenSpinner } from "@/wab/client/components/widgets/DimTokenSelector";
import { getUiLocale } from "@/wab/client/i18n";
import { translate } from "@/wab/client/i18n/locales";
import { VariantedStylesHelper } from "@/wab/shared/VariantedStylesHelper";
import { ensure } from "@/wab/shared/common";
import { BoxShadow, Dim } from "@/wab/shared/core/bg-styles";
import { LENGTH_UNITS } from "@/wab/shared/css/types";
import React from "react";

interface BoxShadowPanelProps extends StyleComponentProps {
  defaultShadow: BoxShadow;
  onUpdated: (shadow: BoxShadow) => void;
  vsh: VariantedStylesHelper;
}
export function BoxShadowPanel({ defaultShadow: shadow, vsh, expsProvider, onUpdated }: BoxShadowPanelProps) {
  const firstInputRef = React.useRef<HTMLInputElement | null>(null);
  React.useEffect(() => {
    const timer = setTimeout(() => firstInputRef.current?.focus());
    return () => clearTimeout(timer);
  }, []);
  const updateShadow = (values: Partial<BoxShadow>) => onUpdated(new BoxShadow({ ...shadow, ...values }));
    return (
      <>
        <FullRow>
          <StyleToggleButtonGroup
            value={shadow.inset ? "inset" : "outset"}
            onChange={(val) => {
              updateShadow({ inset: ensure(val, "Unexpected undefined val") === "inset" });
            }}
          >
            <StyleToggleButton
              className="icon-button-flex"
              value="outset"
              label={translate(getUiLocale(), "Outset")}
              noIcon
            />
            <StyleToggleButton
              className="icon-button-flex"
              value="inset"
              label={translate(getUiLocale(), "Inset")}
              noIcon
            />
          </StyleToggleButtonGroup>
        </FullRow>
        <FullRow twinCols>
          <LabeledItem
            label={translate(getUiLocale(), "Left")}
            labelSize="small"
          >
            <DimTokenSpinner
              ref={firstInputRef}
              value={shadow.x.showCss()}
              onChange={(val) =>
                updateShadow({ x: Dim.fromCss(val || "0px") })
              }
              noClear
              allowedUnits={LENGTH_UNITS}
              allowFunctions
              extraOptions={[]}
              studioCtx={expsProvider.studioCtx}
            />
          </LabeledItem>
          <LabeledItem
            label={translate(getUiLocale(), "Top")}
            labelSize="small"
          >
            <DimTokenSpinner
              value={shadow.y.showCss()}
              onChange={(val) =>
                updateShadow({ y: Dim.fromCss(val || "0px") })
              }
              noClear
              allowedUnits={LENGTH_UNITS}
              allowFunctions
              extraOptions={[]}
              studioCtx={expsProvider.studioCtx}
            />
          </LabeledItem>
        </FullRow>
        <FullRow twinCols>
          <LabeledItem
            label={translate(getUiLocale(), "Blur")}
            labelSize="small"
          >
            <DimTokenSpinner
              value={shadow.blur.showCss()}
              onChange={(val) =>
                updateShadow({ blur: Dim.fromCss(val || "0px") })
              }
              noClear
              allowedUnits={LENGTH_UNITS}
              allowFunctions
              extraOptions={[]}
              studioCtx={expsProvider.studioCtx}
            />
          </LabeledItem>
          <LabeledItem
            label={translate(getUiLocale(), "Spread")}
            labelSize="small"
          >
            <DimTokenSpinner
              value={shadow.spread.showCss()}
              onChange={(val) =>
                updateShadow({ spread: Dim.fromCss(val || "0px") })
              }
              noClear
              allowedUnits={LENGTH_UNITS}
              allowFunctions
              extraOptions={[]}
              studioCtx={expsProvider.studioCtx}
            />
          </LabeledItem>
        </FullRow>
        <FullRow>
          <div className={"spaced-above fill-width"}>
            <ColorPicker
              color={shadow.color}
              onChange={(color) => {
                updateShadow({ color });
              }}
              vsh={vsh}
            />
          </div>
        </FullRow>
      </>
    );
}
