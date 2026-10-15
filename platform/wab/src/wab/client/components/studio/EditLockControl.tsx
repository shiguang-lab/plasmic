import { READ_ONLY_EXPLANATION } from "@/wab/client/components/Messages";
import { LinkButton } from "@/wab/client/components/widgets";
import { useI18n } from "@/wab/client/i18n";
import { UiText } from "@/wab/client/i18n/UiText";
import { useStudioCtx } from "@/wab/client/contexts/StudioContexts";
import { Tooltip } from "antd";
import { observer } from "mobx-react";
import React from "react";

export function _EditLockControl() {
  const { t } = useI18n();
  const sc = useStudioCtx();
  if (sc.isAtTip) {
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

export const EditLockControl = observer(_EditLockControl);
