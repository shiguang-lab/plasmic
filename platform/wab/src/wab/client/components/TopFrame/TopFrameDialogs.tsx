import type { TopFrameChromeProps } from "@/wab/client/components/TopFrame/TopFrameChrome";
import { Loadable } from "@/wab/client/components/widgets";
import * as React from "react";
const loadDialogs = () =>
  import("@/wab/client/components/TopFrame/TopFrameDialogsContent").then(
    (module) => module.TopFrameDialogsContent,
  );
export function TopFrameDialogs(props: TopFrameChromeProps) {
  // Keep form state and ongoing publishing alive after the first request.
  const [requested, setRequested] = React.useState(false);
  const open =
    props.showProjectNameModal ||
    props.showCloneProjectModal ||
    props.showHostModal ||
    props.showUpsellForm ||
    props.showPublishModal ||
    props.keepPublishModalOpen ||
    props.mergeModalContext ||
    props.showShareModal ||
    props.dataSourcePicker ||
    props.showUiConfigModal ||
    props.showLocalizationModal ||
    props.showAppAuthModal ||
    props.onboardingTour.tour;
  if (!requested && open) {
    setRequested(true);
  }
  if (!requested && !open) {
    return null;
  }
  return (
    <Loadable
      loader={loadDialogs}
      contents={(Content) => <Content {...props} />}
      loadingContents={() => null}
    />
  );
}
