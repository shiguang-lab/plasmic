import { PlainLink } from "@/wab/client/components/widgets";
import { UiText } from "@/wab/client/i18n/UiText";
import * as React from "react";

export function HelpButton() {
  return (
    <PlainLink
      className={"help-btn"}
      href={"https://plasmic.app/learn"}
      target="_blank"
    >
      <UiText message={"Help"} />
    </PlainLink>
  );
}
