import {
  getEnvId,
  RenderingCtx,
} from "@/wab/client/components/canvas/canvas-rendering";
import { handleError } from "@/wab/client/ErrorNotifications";
import { getUiLocale } from "@/wab/client/i18n";
import { translate } from "@/wab/client/i18n/locales";
import { getExportedComponentName } from "@/wab/shared/codegen/react-p/serialize-utils";
import { getComponentDisplayName } from "@/wab/shared/core/components";
import { summarizeTpl } from "@/wab/shared/core/tpls";
import { assert } from "@/wab/shared/common";
import {
  Component,
  isKnownComponent,
  TplNode,
} from "@/wab/shared/model/classes";
import { isPlasmicUndefinedDataErrorPromise } from "@plasmicapp/data-sources";
import { debounce } from "lodash";
import type React from "react";

export interface CanvasErrorBoundaryProps {
  nodeOrComponent: TplNode | Component;
  nodeProps?: Record<string, any>;
  children: React.ReactNode;
  ctx: RenderingCtx;
}

/** Native error capture keeps model context on props for the canvas collector. */
export function wrapCanvasErrorBoundary(props: CanvasErrorBoundaryProps) {
  const { ctx, nodeOrComponent, nodeProps, children } = props;
  const view = ctx.viewCtx;
  assert(!view.disposeSignal.aborted, "Cannot create a canvas error boundary for a disposed view");
  return view.canvasCtx.Sub.React.createElement(view.canvasCtx.Sub.CanvasErrorBoundary, {
    ...props,
    lifetime: view.disposeSignal,
    subscribeToChanges: (listener) => view.subscribeToCanvasChanges(listener),
    isPendingError: isPlasmicUndefinedDataErrorPromise,
    renderError: (error) => {
      const errorElement = deriveOffendingElement(error);
      const title = isKnownComponent(nodeOrComponent)
        ? `Error in ${getExportedComponentName(nodeOrComponent)}${errorElement ? ` when rendering ${errorElement}` : ""}:`
        : `Error in ${summarizeTpl(nodeOrComponent)}:`;
      return renderCanvasErrorDisplay(ctx, title, error, nodeOrComponent, nodeProps);
    },
    children,
  });
}

function renderCanvasErrorDisplay(ctx: RenderingCtx, title: React.ReactNode, error: unknown, nodeOrComponent: TplNode | Component, nodeProps?: Record<string, any>) {
  return ctx.viewCtx.canvasCtx.Sub.React.createElement(ctx.viewCtx.canvasCtx.Sub.CanvasErrorDisplay, {
    ctx,
    nodeOrComponent,
    nodeProps,
    title,
    message: String(error),
    valKey: ctx.valKey,
    ownerKey: ctx.ownerKey,
    envId: getEnvId(ctx),
  });
}

export function withErrorDisplayFallback<T>(
  ctx: RenderingCtx,
  nodeOrComponent: TplNode | Component,
  fn: () => T,
  opts: {
    hasLoadingBoundary: boolean;
  },
) {
  try {
    return fn();
  } catch (error: any) {
    if (isPlasmicUndefinedDataErrorPromise(error)) {
      if (opts.hasLoadingBoundary) {
        // There is a React Suspense boundary above us — let it handle the
        // pending-query promise so it can show a loading fallback.
        throw error;
      }
      // No Suspense boundary available. Returning null is safe here because
      // mkComponentLevelQueryFetcher will call setDollarQ once the query
      // settles, triggering a natural canvas re-render with real data.
      // Re-throwing here would cause CanvasErrorBoundary to register a
      // rerender observer that loops indefinitely while queries are pending.
      return null as unknown as T;
    }
    return renderCanvasErrorDisplay(ctx, translate(getUiLocale(), "Error in {part1}:", {
      part1: String(isKnownComponent(nodeOrComponent)
        ? getComponentDisplayName(nodeOrComponent)
        : summarizeTpl(nodeOrComponent)),
    }), error, nodeOrComponent);
  }
}

function deriveOffendingElement(error: Error | null | undefined) {
  if (!error) {
    return undefined;
  }
  const match = error.stack?.match(/at (\w+)/);
  return match?.[1] ?? undefined;
}

// Only for detecting errors in e2e tests
const handleCanvasError = debounce(handleError, 500, { leading: true });
