import {
  FullRow,
  LabeledItem,
} from "@/wab/client/components/sidebar/sidebar-helpers";
import {
  StyleComponentProps,
} from "@/wab/client/components/style-controls/StyleComponent";
import StyleToggleButton from "@/wab/client/components/style-controls/StyleToggleButton";
import StyleToggleButtonGroup from "@/wab/client/components/style-controls/StyleToggleButtonGroup";
import styles from "@/wab/client/components/style-controls/BoxShadowControls.module.scss";
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
  defaultShadow: BoxShadow | null;
  onUpdated: (shadow: BoxShadow | null) => void;
  vsh: VariantedStylesHelper;
}

export const createDefaultBoxShadow = () => new BoxShadow({
  inset: false,
  x: new Dim("0", "px"),
  y: new Dim("4", "px"),
  blur: new Dim("16", "px"),
  spread: new Dim("0", "px"),
  color: "rgba(22,119,255,0.6)",
});

export function BoxShadowPanel({ defaultShadow: shadow, vsh, expsProvider, onUpdated }: BoxShadowPanelProps) {
  const firstInputRef = React.useRef<HTMLInputElement | null>(null);
  React.useEffect(() => {
    const timer = setTimeout(() => firstInputRef.current?.focus());
    return () => clearTimeout(timer);
  }, []);
  const updateShadow = (values: Partial<BoxShadow>) => onUpdated(new BoxShadow({ ...(shadow ?? createDefaultBoxShadow()), ...values }));
    return (
      <>
        <FullRow>
          <StyleToggleButtonGroup
            value={shadow ? shadow.inset ? "inset" : "outset" : "none"}
            onChange={(val) => {
              if (val === "none") { onUpdated(null); return; }
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
            <StyleToggleButton
              className="icon-button-flex"
              value="none"
              label={translate(getUiLocale(), "None")}
              noIcon
            />
          </StyleToggleButtonGroup>
        </FullRow>
        {shadow && <>
        <FullRow className={styles.metrics}>
          <LabeledItem
            label={translate(getUiLocale(), "Left")}
            labelSize="small"
          >
            <DimTokenSpinner
              ref={firstInputRef}
              fieldAriaProps={{ "aria-label": translate(getUiLocale(), "Left") }}
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
              fieldAriaProps={{ "aria-label": translate(getUiLocale(), "Top") }}
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
        <FullRow className={styles.metrics}>
          <LabeledItem
            label={translate(getUiLocale(), "Blur")}
            labelSize="small"
          >
            <DimTokenSpinner
              fieldAriaProps={{ "aria-label": translate(getUiLocale(), "Blur") }}
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
              fieldAriaProps={{ "aria-label": translate(getUiLocale(), "Spread") }}
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
        </>}
      </>
    );
}
