import { UiText } from "@/wab/client/i18n/UiText";
import * as React from "react";

export function PageFooter() {
  return (
    <div className={"LoginForm__Footer"}>
      <div className={"LoginForm__FooterLinks"}>
        <a href="https://www.plasmic.app/privacy">
          <UiText message={"Privacy Policy"} />
        </a>
        <a href="https://www.plasmic.app/tos">
          <UiText message={"Terms & Conditions"} />
        </a>
      </div>
      <div className={"LoginForm__FooterCopy"}>
        <UiText message={"This site is protected by reCAPTCHA."} />
      </div>
      <div className={"LoginForm__FooterCopy"}>
        <UiText
          message={"Copyright © {part1} Plasmic Inc. All rights reserved."}
          values={{ part1: new Date().getFullYear() }}
        />
      </div>
    </div>
  );
}
