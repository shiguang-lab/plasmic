import { useStudioSaveState } from "@/wab/client/studio-ctx/save-state";
import { READ_ONLY_EXPLANATION } from "@/wab/client/components/Messages";
import { LinkButton } from "@/wab/client/components/widgets";
import { useI18n } from "@/wab/client/i18n";
import { UiText } from "@/wab/client/i18n/UiText";
import { useStudioCtx } from "@/wab/client/contexts/StudioContexts";
import { Tooltip } from "antd";
import React from "react";

export function _EditLockControl() {
  const { t } = useI18n();
  const sc = useStudioCtx();
  const isAtTip = useStudioSaveState(sc, (state) => state.isAtTip);
  if (isAtTip) {
    return null;
  }
  return (
    <Tooltip
      title={t("{part1} Reload project to edit.", {
        part1: t(READ_ONLY_EXPLANATION),
      })}
    >
      <div>
        <UiText message={"Project has been updated."} />{" "}
        {
          <strong>
            <LinkButton onClick={() => document.location.reload()}>
              <UiText message={"Reload"} />
            </LinkButton>
          </strong>
        }
      </div>
    </Tooltip>
  );
}

export const EditLockControl = _EditLockControl;
