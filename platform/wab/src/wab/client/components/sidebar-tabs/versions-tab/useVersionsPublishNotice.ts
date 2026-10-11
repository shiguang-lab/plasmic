import { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { ensure, spawn } from "@/wab/shared/common";
import React, { useState } from "react";
import { useLocalStorage } from "react-use";

export function useVersionsPublishNotice(studioCtx: StudioCtx) {
  const [dismissVersionsCTA, setDismissVersionsCTA] = useLocalStorage(
    `${studioCtx.siteInfo.id}-dismissVersionsCTA`,
    false,
  );

  // revision number of latest published version
  const [latestPublishedRevNum, setLatestPublishedRevNum] = useState<number>();
  const latestPublishedVersion = studioCtx.releases[0];

  // Check if we need to fetch latest data
  React.useEffect(() => {
    spawn(
      (async () => {
        const { rev: latestPublishedRev } = await studioCtx.getLatestVersion(
          latestPublishedVersion?.revisionId,
          latestPublishedVersion?.branchId ?? undefined,
        );
        setLatestPublishedRevNum(latestPublishedRev?.revision);
      })(),
    );
  }, [studioCtx, latestPublishedVersion]);

  const useVersionsCTA =
    !dismissVersionsCTA &&
    studioCtx.releases.length > 0 &&
    !!latestPublishedRevNum &&
    ensure(latestPublishedRevNum, "Should have latestPublishedRevNum") <
      studioCtx.dbCtx().revisionNum;

  return {
    useVersionsCTA,
    dismissVersionsCTA: () => setDismissVersionsCTA(true),
  };
}
