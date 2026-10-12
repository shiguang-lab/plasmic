import { useAppCtx } from "@/wab/client/contexts/AppContexts";
import { ensure, spawn } from "@/wab/shared/common";

export function useShareDialog() {
  const appCtx = useAppCtx();
  const topFrameApi = ensure(appCtx.topFrameApi, "missing topFrameApi");

  function openShareDialog() {
    spawn(topFrameApi.setShowShareModal(true));
  }

  return {
    openShareDialog,
  };
}
