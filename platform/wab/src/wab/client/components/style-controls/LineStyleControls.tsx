import { LabeledToggleButtonGroupItemRow } from "@/wab/client/components/sidebar/sidebar-helpers";
import StyleToggleButton from "@/wab/client/components/style-controls/StyleToggleButton";
import { Icon } from "@/wab/client/components/widgets/Icon";
import { useI18n } from "@/wab/client/i18n";
import BorderDashedIcon from "@/wab/client/plasmic/plasmic_kit/PlasmicIcon__BorderDashed";
import BorderDottedIcon from "@/wab/client/plasmic/plasmic_kit/PlasmicIcon__BorderDotted";
import BorderSolidIcon from "@/wab/client/plasmic/plasmic_kit/PlasmicIcon__BorderSolid";
import CloseIcon from "@/wab/client/plasmic/plasmic_kit/PlasmicIcon__Close";
import React from "react";

export function LabeledLineStyleToggleButtonGroupItemRow(
  props: Omit<
    React.ComponentProps<typeof LabeledToggleButtonGroupItemRow>,
    "children"
  >,
) {
  const { t } = useI18n();
  return (
    <LabeledToggleButtonGroupItemRow {...props}>
      <StyleToggleButton
        className="panel-popup--no-min-width"
        value="none"
        tooltip={t("None")}
        stretched
      >
        <Icon icon={CloseIcon} />
      </StyleToggleButton>
      <StyleToggleButton
        className="panel-popup--no-min-width"
        value="dotted"
        tooltip={t("Dotted")}
        stretched
      >
        <Icon icon={BorderDottedIcon} />
      </StyleToggleButton>
      <StyleToggleButton
        className="panel-popup--no-min-width"
        value="dashed"
        tooltip={t("Dashed")}
        stretched
      >
        <Icon icon={BorderDashedIcon} />
      </StyleToggleButton>
      <StyleToggleButton
        className="panel-popup--no-min-width"
        value="solid"
        tooltip={t("Solid")}
        stretched
      >
        <Icon icon={BorderSolidIcon} />
      </StyleToggleButton>
    </LabeledToggleButtonGroupItemRow>
  );
}
