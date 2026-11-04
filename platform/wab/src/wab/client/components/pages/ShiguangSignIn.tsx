import { UiText } from "@/wab/client/i18n/UiText";
import { useLocation } from "@/wab/client/route/HistoryProvider";
import { getShiguangSignInUrl } from "@/wab/shared/shiguang-auth";
import { Button } from "antd";
import { createPath } from "history";
import * as React from "react";
import { useEffect } from "react";

export function ShiguangSignIn({ returnTo: requestedReturnTo }: { returnTo?: string } = {}) {
  const location = useLocation();
  const returnTo = new URL(requestedReturnTo ?? createPath(location), window.location.origin);
  const loginUrl = getShiguangSignInUrl(
    returnTo.origin === window.location.origin ? returnTo.href : window.location.origin + "/",
  );
  useEffect(() => {
    window.location.replace(loginUrl);
  }, [loginUrl]);
  return (
    <Button type="primary" href={loginUrl}>
      <UiText message={"Sign in with Shiguang"} />
    </Button>
  );
}
