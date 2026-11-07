import { LabeledStyleDimItem } from "@/wab/client/components/sidebar/sidebar-helpers";
import {
  ExpsProvider,
  useStyleComponent,
} from "@/wab/client/components/style-controls/StyleComponent";
import { useStyleCells, useStyleIndicator } from "@/wab/client/studio-ctx/style-inputs-react";
import { useI18n } from "@/wab/client/i18n";
import { useVariantedStylesHelperFromCurrentCtx } from "@/wab/client/studio-ctx/varianted-style-context";
import { isTokenRef } from "@/wab/commons/StyleToken";
import { VariantedStylesHelper } from "@/wab/shared/VariantedStylesHelper";
import { PERCENTAGE_UNITS } from "@/wab/shared/css/types";
import React from "react";

interface OpacityControlProps {
  expsProvider: ExpsProvider;
  vsh?: VariantedStylesHelper;
}

export function OpacityControl(
  props: OpacityControlProps,
) {
  const { t: uiT } = useI18n();
  const { expsProvider } = props;
  const styling = useStyleComponent();

  // Use provided vsh or create one from studio context
  const currentVsh = useVariantedStylesHelperFromCurrentCtx(props.vsh ? undefined : expsProvider.studioCtx);
  const vsh = props.vsh ?? currentVsh;

  const [opacityCell] = useStyleCells(expsProvider, ["opacity"]);
  const opacity = opacityCell?.value || "1";
  const formattedOpacity = isTokenRef(opacity)
    ? opacity
    : `${Math.round(parseFloat(opacity) * 100)}%`;

  const opacityDefinedIndicator = useStyleIndicator(expsProvider, "opacity");

  const handleOpacityChange = (val?: string) => {
    const newVal = val?.includes("%")
      ? parseInt(val) / 100
      : parseFloat(val || "1");

    styling.change(() => {
      if (val === undefined || (isNaN(newVal) && !isTokenRef(val))) {
        styling.exp().clear("opacity");
      } else {
        styling
          .exp()
          .set("opacity", val && isTokenRef(val) ? val : String(newVal));
      }
    });
  };

  return (
    <LabeledStyleDimItem
      styleName="opacity"
      definedIndicator={opacityDefinedIndicator}
      aria-label={uiT("Opacity")}
      dimOpts={{
        value: formattedOpacity,
        onChange: handleOpacityChange,
        min: 0,
        max: 100,
        extraOptions: ["100%", "75%", "50%", "25%", "0%"],
        allowedUnits: PERCENTAGE_UNITS,
        allowFunctions: true,
        tooltip: uiT("Opacity"),
      }}
      tokenType={"Opacity"}
      vsh={vsh}
    />
  );
}
