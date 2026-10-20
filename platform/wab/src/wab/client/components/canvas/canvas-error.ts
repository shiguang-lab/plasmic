import {
  getEnvId,
  RenderingCtx,
} from "@/wab/client/components/canvas/canvas-rendering";
import { handleError } from "@/wab/client/ErrorNotifications";
import { getUiLocale } from "@/wab/client/i18n";
import { translate } from "@/wab/client/i18n/locales";
import { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import {
  classNameProp,
  dataCanvasEnvsProp,
  valKeyProp,
  valOwnerProp,
} from "@/wab/shared/canvas-constants";
import { getExportedComponentName } from "@/wab/shared/codegen/react-p/serialize-utils";
import { getComponentDisplayName } from "@/wab/shared/core/components";
import { summarizeTpl } from "@/wab/shared/core/tpls";
import { ownedComputedFn } from "@/wab/shared/mobx-util";
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

interface CanvasErrorBoundaryState {
  error?: Error | null;
}

export const mkCanvasErrorBoundary = ownedComputedFn(
  // Owned by the ViewCtx rather than React, so it's released with the ViewCtx
  (viewCtx: ViewCtx, react: typeof React) => {
    const ReactComponent = react.Component;
    return class CanvasErrorBoundary extends ReactComponent<
      CanvasErrorBoundaryProps,
      CanvasErrorBoundaryState
    > {
      static contextType = viewCtx.canvasCtx.Sub.DataContext;

      constructor(props) {
        super(props);
        this.state = {};
      }

      static getDerivedStateFromError(error: Error) {
        return { error };
      }

      componentDidMount() {
        this.componentDidMountOrUpdate();
      }

      componentDidUpdate() {
        this.componentDidMountOrUpdate();
      }

      private stopWatching?: () => void;

      private resetError = () => {
        this.setState({ error: null });
      };

      private componentDidMountOrUpdate() {
        if (this.state.error && !isPlasmicUndefinedDataErrorPromise(this.state.error)) {
          // Subscribe without scheduling work: a persistent error must not
          // drive its own retry loop. Model/dependency evaluation flushes this.
          this.stopWatching ??= viewCtx.subscribeToCanvasChanges(this.resetError);
        } else {
          this.stopWatching?.();
          this.stopWatching = undefined;
        }
      }

      componentWillUnmount() {
        this.stopWatching?.();
      }

      render() {
        const r = react.createElement;
        const { ctx, children, nodeOrComponent, nodeProps } = this.props;
        if (this.state.error != null) {
          if (isPlasmicUndefinedDataErrorPromise(this.state.error)) {
            throw this.state.error;
          }

          const deriveTitle = () => {
            if (isKnownComponent(nodeOrComponent)) {
              // Error boundary at the root of a component
              const errorElement = deriveOffendingElement(this.state.error);
              if (errorElement) {
                return `Error in ${getExportedComponentName(
                  nodeOrComponent,
                )} when rendering ${errorElement}:`;
              } else {
                return `Error in ${getExportedComponentName(nodeOrComponent)}:`;
              }
            } else {
              // Error boundary for a specific element
              return `Error in ${summarizeTpl(nodeOrComponent)}:`;
            }
          };

          return r(mkCanvasErrorDisplay(react), {
            ctx: ctx,
            error: this.state.error,
            nodeOrComponent,
            nodeProps,
            title: deriveTitle(),
          });
        } else {
          return children;
        }
      }
    };
  },
);

interface CanvasErrorDisplayProps {
  ctx: RenderingCtx;
  nodeOrComponent: TplNode | Component;
  /**
   * The props used to instantiate nodeOrComponent with. We don't actually use this,
   * but it is read by globalHook to gather component props
   */
  nodeProps?: Record<string, any>;
  title: React.ReactNode;
  error: any;
}

export function withErrorDisplayFallback<T>(
  react: typeof React,
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
    return react.createElement(mkCanvasErrorDisplay(react), {
      ctx,
      nodeOrComponent,
      error,
      title: translate(getUiLocale(), "Error in {part1}:", {
        part1: String(
          isKnownComponent(nodeOrComponent)
            ? getComponentDisplayName(nodeOrComponent)
            : summarizeTpl(nodeOrComponent),
        ),
      }),
    });
  }
}

const mkCanvasErrorDisplay = ownedComputedFn((react: typeof React) => {
  const ReactComponent = react.Component;
  return class CanvasErrorDisplay extends ReactComponent<CanvasErrorDisplayProps> {
    render() {
      const { ctx, title, error } = this.props;

      const valKey = ctx.valKey;
      const ownerKey = ctx.ownerKey;
      const envId = getEnvId(ctx);

      const r = react.createElement;
      return r(
        "div",
        {
          className: "__wab_error-display",
          [valKeyProp]: valKey,
          [dataCanvasEnvsProp]: envId,
          [valOwnerProp]: ownerKey,
          [classNameProp]: "__wab_error-display",
        },
        r(
          "div",
          { className: "__wab_error-display__inner" },
          r("div", { className: "__wab_error-display__heading" }, title),
          r("div", { className: "__wab_error-display__code" }, `${error}`),
        ),
      );
    }
  };
});

function deriveOffendingElement(error: Error | null | undefined) {
  if (!error) {
    return undefined;
  }
  const match = error.stack?.match(/at (\w+)/);
  return match?.[1] ?? undefined;
}

// Only for detecting errors in e2e tests
const handleCanvasError = debounce(handleError, 500, { leading: true });
