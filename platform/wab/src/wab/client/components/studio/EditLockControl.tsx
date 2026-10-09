import { READ_ONLY_EXPLANATION } from "@/wab/client/components/Messages";
import { LinkButton } from "@/wab/client/components/widgets";
import { UiText } from "@/wab/client/i18n/UiText";
import { useStudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { Tooltip } from "antd";
import { observer } from "mobx-react";
import React from "react";

export function _EditLockControl() {
  const sc = useStudioCtx();
  if (sc.isAtTip) {
    return null;
  }
  return (
    <Tooltip title={`${READ_ONLY_EXPLANATION} Reload project to edit.`}>
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
