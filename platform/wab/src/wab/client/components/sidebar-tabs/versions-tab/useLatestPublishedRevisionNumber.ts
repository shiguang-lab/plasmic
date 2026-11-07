import { useAsyncStrict } from "@/wab/client/hooks/useAsyncStrict";
import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { useStore } from "zustand";

/** Both publishing entry points compare the same published revision. Async state
 * belongs to the selected release, so an older response cannot label a new one. */
export function useLatestPublishedRevisionNumber(studio: StudioCtx) {
  const release = useStore(studio.versionHistory.store, (state) => state.releases[0]);
  const projectId = useStore(studio.projectMetadataStore, (state) => state.id);
  const identity = release ? JSON.stringify([release.id, release.revisionId, release.branchId]) : undefined;
  const state = useAsyncStrict(async () => {
    if (!release) { return undefined; }
    const { rev } = await studio.appCtx.api.getProjectRevWithoutData(projectId, release.revisionId, release.branchId ?? undefined);
    return { identity, revision: rev?.revision };
  }, [studio, projectId, identity]);
  return state.value?.identity === identity ? state.value?.revision : undefined;
}
