import { PlainLink } from "@/wab/client/components/widgets";
import { useAppCtx } from "@/wab/client/contexts/AppContexts";
import { UiText } from "@/wab/client/i18n/UiText";
import * as React from "react";

export function HelpButton() {
  const appCtx = useAppCtx();
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
