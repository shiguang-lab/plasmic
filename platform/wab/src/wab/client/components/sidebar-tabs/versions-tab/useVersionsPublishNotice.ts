import { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { useLatestPublishedRevisionNumber } from "@/wab/client/components/sidebar-tabs/versions-tab/useLatestPublishedRevisionNumber";
import { useStore } from "zustand";
import { useLocalStorage } from "react-use";

export function useVersionsPublishNotice(studioCtx: StudioCtx) {
  const projectId = useStore(studioCtx.projectMetadataStore, (state) => state.id);
  const [dismissVersionsCTA, setDismissVersionsCTA] = useLocalStorage(
    `${projectId}-dismissVersionsCTA`,
    false,
  );

  const latestPublishedRevNum = useLatestPublishedRevisionNumber(studioCtx);
  const currentRevisionNum = useStore(studioCtx.versionHistory.store, (state) => state.currentRevisionNum);
  const hasReleases = useStore(studioCtx.versionHistory.store, (state) => state.releases.length > 0);
  const useVersionsCTA = !dismissVersionsCTA && hasReleases && !!latestPublishedRevNum && latestPublishedRevNum < currentRevisionNum;

  return {
    useVersionsCTA,
    dismissVersionsCTA: () => setDismissVersionsCTA(true),
  };
}
