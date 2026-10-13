import { getUiLocale, useI18n } from "@/wab/client/i18n";
import { translateUiLabel } from "@/wab/client/i18n/locales";

import {
  DefaultToggleRecordingButtonProps,
  PlasmicToggleRecordingButton,
} from "@/wab/client/plasmic/plasmic_kit_variants_bar/PlasmicToggleRecordingButton";
import { VARIANTS_LOWER } from "@/wab/shared/Labels";
import { Tooltip } from "antd";
import * as React from "react";

interface ToggleRecordingButtonProps extends DefaultToggleRecordingButtonProps {
  onClick: (e: React.MouseEvent) => void;
}

function ToggleRecordingButton(props: ToggleRecordingButtonProps) {
  const { t: studioUiT } = useI18n();

  return (
    <Tooltip
      trigger={["hover"]}
      title={
        props.isRecording
          ? studioUiT("Stop recording all {part1}", {
              part1: translateUiLabel(getUiLocale(), VARIANTS_LOWER),
            })
          : studioUiT("Start recording all {part1}", {
              part1: translateUiLabel(getUiLocale(), VARIANTS_LOWER),
            })
      }
    >
      <PlasmicToggleRecordingButton {...props} />
    </Tooltip>
  );
}

export default ToggleRecordingButton;
