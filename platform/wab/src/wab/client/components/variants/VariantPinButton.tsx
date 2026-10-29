// This file is owned by you, feel free to edit as you see fit.
import {
  DefaultVariantPinButtonProps,
  PlasmicVariantPinButton,
} from "@/wab/client/plasmic/plasmic_kit_variants/PlasmicVariantPinButton";
import { useI18n } from "@/wab/client/i18n";
import * as React from "react";

interface VariantPinButtonProps extends DefaultVariantPinButtonProps {
  onToggle?: () => void;
  tabIndex?: number;
}

function VariantPinButton(props: VariantPinButtonProps) {
  const { t } = useI18n();
  const { onToggle, ...rest } = props;
  const pinState = props.pinState;
  const isVisible =
    !!pinState &&
    ["selected", "pinnedTrue", "evaluatedTrue"].includes(pinState);
  const isSelected = pinState?.includes("selected");
  return (
    <PlasmicVariantPinButton
      root={
        {
          tooltip: isSelected
            ? undefined
            : isVisible
              ? t("Turn off variant")
              : t("View variant"),
          "data-test-class": `variant-pin-button-${
            isVisible ? "deactivate" : "activate"
          }`,
          disabled: isSelected || !onToggle,
        } as any
      }
      onClick={
        onToggle
          ? (e) => {
              e.stopPropagation();
              onToggle();
            }
          : undefined
      }
      {...rest}
    />
  );
}

export default VariantPinButton;
