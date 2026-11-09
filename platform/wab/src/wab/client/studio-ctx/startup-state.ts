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
