import { isProjectPath, parseProjectLocation } from "@/wab/client/cli-routes";
import { StudioChrome } from "@/wab/client/components/studio/StudioChrome";
import { BrandLoading } from "@/wab/client/components/widgets/BrandLoading";
import { useLocation } from "@/wab/client/route/HistoryProvider";
import * as React from "react";

const ApplicationRouteLoading = React.lazy(
  () => import("./ApplicationRouteLoading"),
);
export function ApplicationPageLoading({
  failure,
}: { failure?: React.ReactNode } = {}) {
  const location = useLocation();
  if (
    isProjectPath(location.pathname) ||
    parseProjectLocation(location)?.isPreview
  ) {
    return <StudioChrome>{failure}</StudioChrome>;
  }
  return (
    <React.Suspense fallback={<BrandLoading />}>
      <ApplicationRouteLoading failure={failure} />
    </React.Suspense>
  );
}
