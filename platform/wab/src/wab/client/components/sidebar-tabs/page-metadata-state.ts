import { useStudioCtx } from "@/wab/client/contexts/StudioContexts";
import { ensure } from "@/wab/shared/common";
import type { Component } from "@/wab/shared/model/classes";
import { useStore } from "zustand";

/** A model identity chooses explicit field subscriptions and handles commands. */
export function usePageMetadata(page: Component) {
  const studio = useStudioCtx();
  const models = studio.modelSnapshots;
  const ref = useStore(models.field(page, "pageMeta"));
  return models.resolve(ensure(ref, "Page components are expected to have pageMeta"));
}
