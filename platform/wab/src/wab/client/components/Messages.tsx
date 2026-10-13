import { getUiLocale } from "@/wab/client/i18n";
import { UiText } from "@/wab/client/i18n/UiText";
import { translate } from "@/wab/client/i18n/locales";
import * as common from "@/wab/shared/common";
import { notification } from "antd";
import L from "lodash";
import React, { ReactNode } from "react";

export const READ_ONLY_EXPLANATION =
  "Someone else has edited the project, so you are now viewing a stale read-only version.";

export const FORBIDDEN_EXPLANATION =
  "You do not have permissions to edit this project.";

export const RELOAD_EXPLANATION =
  "An update to Plasmic is available.  You are now in read-only mode.";

export const SAVE_ERROR_RECOVERED_EXPLANATION = "Save is working again.";

function reload() {
  document.location.reload();
}

export function showForbiddenError() {
  const key = L.uniqueId();
  notification.error({
    key,
    message: <UiText message={"Error"} />,
    description: (
      <span>
        <UiText
          message={"Changes could not be saved. {part1}"}
          values={{ part1: <UiText message={FORBIDDEN_EXPLANATION} /> }}
        />
      </span>
    ),
    duration: 0,
  });
}

export function showReloadNotice() {
  const key = L.uniqueId();
  notification.info({
    key,
    message: translate(getUiLocale(), "Info"),
    description: (
      <span>
        <UiText
          message={"{part1} {part2} to edit."}
          values={{
            part1: <UiText message={RELOAD_EXPLANATION} />,
            part2: (
              <a
                onClick={() => {
                  notification.destroy(key);
                  reload();
                }}
              >
                <UiText message={"Reload project"} />
              </a>
            ),
          }}
        />
      </span>
    ),
    duration: 0,
  });
}

export function showReloadError() {
  const key = L.uniqueId();
  notification.error({
    key,
    message: <UiText message={"Error"} />,
    description: (
      <span>
        <UiText
          message={
            "Changes could not be saved. {part1} {part2} to continue editing."
          }
          values={{
            part1: <UiText message={RELOAD_EXPLANATION} />,
            part2: (
              <a
                onClick={() => {
                  notification.destroy(key);
                  reload();
                }}
              >
                <UiText message={"Reload project"} />
              </a>
            ),
          }}
        />
      </span>
    ),
    duration: 0,
  });
}

export function showSaveErrorRecoveredNotice() {
  const key = L.uniqueId();
  notification.info({
    key,
    message: <UiText message={"info"} />,
    description: (
      <span>
        <UiText message={SAVE_ERROR_RECOVERED_EXPLANATION} />
      </span>
    ),
    duration: 0,
  });
}

export function toast(
  description: ReactNode,
  opts: {
    key?: string;
    duration?: number;
  } = {},
) {
  return notification.open({
    key: opts.key ?? common.mkShortId(),
    message: "",
    placement: "bottomLeft",
    style: { width: 500 },
    duration: opts.duration ?? 10,
    description: description,
    className: "snackbar",
  });
}
