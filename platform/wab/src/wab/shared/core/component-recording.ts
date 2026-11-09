import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import type { Component } from "@/wab/shared/model/classes";

/** Admit lazy component trees to change recording before an imperative edit. */
export function ensureComponentsRecorded(components: Component[]) {
  if (typeof window === "undefined") { return true; }
  const studio: StudioCtx | undefined = (window as any).studioCtx;
  return studio?.observeComponents(components);
}
