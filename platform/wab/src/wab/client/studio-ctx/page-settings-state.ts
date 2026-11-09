import { createStudioStore, resolveStore } from "@/wab/client/stores/store-kit";
import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import type { PageComponent } from "@/wab/shared/core/components";
import { useShallow } from "zustand/react/shallow";
import { useStore } from "zustand";

/**
 * Page settings dialog visibility and the page it edits.
 *
 * Replaces `StudioCtx._pageSettingsOpen` / `_pageSettingsPage`
 * (`observable.box`). Only the canvas dialog reads them reactively.
 */
export interface PageSettingsSnapshot {
  readonly open: boolean;
  readonly page: PageComponent | undefined;
}

export function createPageSettingsStore() {
  return createStudioStore<PageSettingsSnapshot>(
    () => ({ open: false, page: undefined }),
    { name: "studio-page-settings" },
  );
}

export type PageSettingsStore = ReturnType<typeof createPageSettingsStore>;

/** Reactive read for the dialog. */
const emptyPageSettingsStore = createPageSettingsStore();

export function usePageSettingsDialog(studio: StudioCtx): {
  open: boolean;
  page: PageComponent | undefined;
} {
  return useStore(
    resolveStore(studio.pageSettingsStore, emptyPageSettingsStore),
    useShallow((state) => ({ open: state.open, page: state.page })),
  );
}
