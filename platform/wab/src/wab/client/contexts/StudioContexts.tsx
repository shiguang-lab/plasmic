import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import type { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import {
  withConsumer,
  withProvider,
} from "@/wab/commons/components/ContextUtil";
import { ensure } from "@/wab/shared/common";
import * as React from "react";
import { useContext } from "react";

export const ViewCtxContext = React.createContext<ViewCtx | undefined>(
  undefined,
);
export const withViewCtx = withConsumer(ViewCtxContext.Consumer, "viewCtx");
export const providesViewCtx = withProvider(ViewCtxContext.Provider);
export const useViewCtx = () =>
  ensure(useContext(ViewCtxContext), "Must have a view context");
export const useViewCtxMaybe = () => useContext(ViewCtxContext);

export const StudioCtxContext = React.createContext<StudioCtx | undefined>(
  // To recover studioCtx after hot reloading
  (window as any).dbg?.studioCtx,
);
export const withStudioCtx = withConsumer(
  StudioCtxContext.Consumer,
  "studioCtx",
);
export const providesStudioCtx = withProvider(StudioCtxContext.Provider);
export const useStudioCtx = () => ensure(useContext(StudioCtxContext), "");
export const usePlasmicCtx = () => {
  const studioCtx = useStudioCtx();
  const viewCtx = studioCtx.focusedViewCtx();
  return { studioCtx, viewCtx };
};
