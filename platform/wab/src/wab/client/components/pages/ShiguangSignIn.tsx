import { useLocation } from "@/wab/client/route/HistoryProvider";
import { getShiguangSignInUrl } from "@/wab/shared/shiguang-auth";
import { createPath } from "history";
import { useLayoutEffect } from "react";

export function ShiguangSignIn({ returnTo: requestedReturnTo }: { returnTo?: string } = {}) {
  const location = useLocation();
  const returnTo = new URL(requestedReturnTo ?? createPath(location), window.location.origin);
  const loginUrl = getShiguangSignInUrl(
    returnTo.origin === window.location.origin ? returnTo.href : window.location.origin + "/",
  );
  useLayoutEffect(() => {
    window.location.replace(loginUrl);
  }, [loginUrl]);
  return null;
}
