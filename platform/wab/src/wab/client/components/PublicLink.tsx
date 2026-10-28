import { Link as RouterLink } from "@/wab/client/route/Link";
import { isAbsoluteUrl } from "@/wab/commons/urls";
import * as React from "react";

type PublicLinkProps = React.ComponentProps<"a">;

// Forwards its ref to the anchor so antd Tooltip/Popover can anchor on it.
export const PublicLink = React.forwardRef<
  HTMLAnchorElement,
  Omit<PublicLinkProps, "ref">
>(function PublicLink(props, ref) {
  if (isAbsoluteUrl(props.href || "")) {
    // Use normal link for absolute URLs
    return <a {...props} ref={ref} />;
  } else {
    // Use our routing-aware Link for internal navigation
    return <RouterLink {...props} ref={ref} to={props.href || ""} />;
  }
});
