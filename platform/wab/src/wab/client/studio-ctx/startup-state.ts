import type { AppCtx } from "@/wab/client/app-ctx";
import { parseProjectLocation } from "@/wab/client/cli-routes";
import { focusPreferenceKey, fullPageHeightKey } from "@/wab/client/LocalStorageKey";
import type { ProjectId } from "@/wab/shared/ApiSchema";
import { createStudioStore } from "@/wab/client/stores/store-kit";

/**
 * Startup readiness flags for one Studio.
 *
 * Replaces `StudioCtx.initialRouteLoaded` / `initialViewportLoaded`
 * (`observable.box`). The only subscription is an imperative one (the
 * active-canvas readiness reaction), so this module is store-first.
 */
export interface StartupSnapshot {
  readonly routeLoaded: boolean;
  readonly viewportLoaded: boolean;
}

export function createStartupStore() {
  return createStudioStore<StartupSnapshot>(
    // Viewport readiness starts optimistic; it is only set to false on desktop
    // when a saved editor view has to be restored first.
    () => ({ routeLoaded: false, viewportLoaded: true }),
    { name: "studio-startup" },
  );
}

export type StartupStore = ReturnType<typeof createStartupStore>;

export function readInitialRoutePreferences(appCtx: AppCtx, projectId: ProjectId) {
  const restoreViewport = !!appCtx.topFrameApi &&
    navigator.userAgent.includes("PlasmicDesktop/") &&
    !parseProjectLocation(appCtx.history.location)?.publishedTemplate;

  const readViewport = async () => {
    if (restoreViewport) {
      try {
        return await appCtx.topFrameApi?.getSavedEditorView(projectId);
      } catch (error) {
        console.warn("Cannot read saved editor viewport", error);
      }
    }
    return null;
  };

  const values = Promise.all([
    appCtx.api.getStorageItem(focusPreferenceKey(projectId)),
    appCtx.api.getStorageItem(fullPageHeightKey(projectId)),
    readViewport(),
  ]);
  // Model loading can fail or finish after these reads. The route awaits the original promise.
  void values.catch(() => undefined);
  return { restoreViewport, values };
}
