import { handleError, normalizeError } from "@/wab/client/ErrorNotifications";
import {
  AntdConfigProvider,
  configureAntdStatics,
} from "@/wab/client/antd-theme";
import { isTopFrame } from "@/wab/client/cli-routes";
import { initClientFlags } from "@/wab/client/client-dev-flags";
import { Root } from "@/wab/client/components/root-view";
import { StudioStartupBoundary } from "@/wab/client/components/studio/StudioChrome";
import { watchUnanchoredPopups } from "@/wab/client/components/widgets/TriggerAnchor";
import { ENV } from "@/wab/client/env";
import {
  HostFrameCtxProvider,
  useHostFrameCtxIfHostFrame,
} from "@/wab/client/frame-ctx/host-frame-ctx";
import { initObservability } from "@/wab/client/observability";
import {
  HistoryProvider,
  useLocation,
} from "@/wab/client/route/HistoryProvider";
import { usesProductTheme } from "@/wab/client/ui-theme";
import { isLiteralObject, swallow, tuple } from "@/wab/shared/common";
import { DEVFLAGS, applyDevFlagOverrides } from "@/wab/shared/devflags";
import * as Sentry from "@sentry/browser";
import { createBrowserHistory } from "history";
import * as React from "react";
import { OverlayProvider } from "react-aria";
import * as ReactDOM from "react-dom";

const localStoragePrefixesThatAreSafeToRemove = ["__mpq_"];

function ShellThemeProvider({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation();
  return (
    <AntdConfigProvider productUI={usesProductTheme(pathname)}>
      {children}
    </AntdConfigProvider>
  );
}

/**
 * Watch for any entries over 500KB in size - we found that mixpanel was introducing __mpq_* keys that were exhausting the 10MB limit!
 */
function reportAndFixOversizedLocalStorage() {
  let keys: string[];
  try {
    keys = Object.keys(localStorage);
  } catch (err) {
    return;
  }
  const report = keys
    .map((key) => tuple(key, localStorage[key].length))
    .filter(([_key, len]) => len > 500000);
  if (report.length > 0) {
    Sentry.captureMessage(
      `Found oversized localStorage: ${JSON.stringify(report)}`,
    );
    for (const [key, _len] of report) {
      if (
        localStoragePrefixesThatAreSafeToRemove.some((prefix) =>
          key.startsWith(prefix),
        )
      ) {
        localStorage.removeItem(key);
      }
    }
  }
}

// Monkey patch console.log afterwards based on the devflags
const originalConsoleLog = console.log;
console.log = function () {};

/**
 * main needs to go in Shell rather than main.tsx since Shell is the root of
 * hot-reload, so this way hot reload works more fully.  Need to ensure that as
 * many application modules as possible are imported via this hot module and
 * there's no import path to them from the root main.tsx.
 */
export function main() {
  performance.mark("studio-shell");
  if (!DEVFLAGS.uncatchErrors) {
    window.onunhandledrejection = (e: PromiseRejectionEvent) => {
      handleError(normalizeError(e.reason));
    };
    window.onerror = (
      event: Event | string,
      source?: string,
      lineno?: number,
      colno?: number,
      error?: Error,
    ) => {
      // We check `source` to weed out errors that come from
      // the console.
      if (source && error) {
        handleError(error, source);
      }
    };
  }

  applyDevFlagOverrides(initClientFlags(DEVFLAGS));

  configureAntdStatics();

  if (process.env.NODE_ENV !== "production") {
    // Surfaces Tooltip/Popover/Dropdown triggers whose child can't anchor them.
    watchUnanchoredPopups(document);
  }

  initObservability();

  (window as any).commithash = ENV.COMMITHASH;

  const appContainerElement = document.querySelector(".app-container");

  monkeyPatchConsoleLog();

  if (isTopFrame()) {
    ReactDOM.render(<Shell />, appContainerElement);
  } else {
    ReactDOM.render(
      <HostFrameCtxProvider>
        <Shell />
      </HostFrameCtxProvider>,
      appContainerElement,
    );
  }

  reportAndFixOversizedLocalStorage();
}

export function Shell() {
  const hostFrameCtx = useHostFrameCtxIfHostFrame();
  const [history] = React.useState(() =>
    hostFrameCtx ? hostFrameCtx.history : createBrowserHistory(),
  );

  return (
    <HistoryProvider history={history}>
      <ShellThemeProvider>
        <OverlayProvider style={{ width: "100%", height: "100%" }}>
          {hostFrameCtx ? (
            <Root />
          ) : (
            <StudioStartupBoundary>
              <Root />
            </StudioStartupBoundary>
          )}
        </OverlayProvider>
      </ShellThemeProvider>
    </HistoryProvider>
  );
}

function monkeyPatchConsoleLog() {
  // Some integrations also monkey-patch console.log and try serialize the
  // arguments which can be pretty expensive, so we make sure to override them
  // and limit their total size.
  let finalConsoleLog = console.log;
  let innerConsoleLog = false;
  const monkeyPatchConsoleLogValue = (
    previousConsoleLog: typeof console.log,
  ) => {
    finalConsoleLog = (...args: any[]) => {
      if (innerConsoleLog) {
        // The args are already sanitized and the original console.log has
        // already been called
        return previousConsoleLog(...args);
      }
      if (DEVFLAGS.logToConsole) {
        // Only the native `console.log` should take the actual arguments
        originalConsoleLog(...args);
      }
      const MAX_DEPTH = 3;
      const MAX_WIDTH = 20;
      try {
        innerConsoleLog = true;
        const visitedObjects = new Map<any, any>();
        const sanitizeLogArg = (arg: any, depth: number) => {
          if (arg && typeof arg === "object") {
            if (visitedObjects.has(arg)) {
              return visitedObjects.get(arg);
            }
            if (depth >= MAX_DEPTH) {
              const filtered = Array.isArray(arg)
                ? "[ Array ]"
                : isLiteralObject(arg)
                  ? "[ Object ]"
                  : `[ ${
                      swallow(() => arg.typeTag as string) ||
                      arg.constructor.name
                    } ]`;
              visitedObjects.set(arg, filtered);
              return filtered;
            } else {
              if (Array.isArray(arg)) {
                const filtered: any[] = [];
                visitedObjects.set(arg, filtered);
                filtered.push(
                  ...(arg.length > MAX_WIDTH
                    ? [...arg.slice(0, MAX_WIDTH), "..."]
                    : arg
                  ).map((subArg) => sanitizeLogArg(subArg, depth + 1)),
                );
                return filtered;
              } else {
                const filtered: any = {};
                visitedObjects.set(arg, filtered);
                Object.assign(
                  filtered,
                  Object.fromEntries([
                    ...Object.entries(arg)
                      .slice(0, MAX_WIDTH)
                      .map(([key, field]) => [
                        key,
                        sanitizeLogArg(field, depth + 1),
                      ]),
                    ...(isLiteralObject(arg)
                      ? []
                      : [
                          [
                            "constructorClass",
                            swallow(() => arg.typeTag as string) ||
                              arg.constructor.name,
                          ],
                        ]),
                  ]),
                );
                return filtered;
              }
            }
          }
          return arg;
        };
        return previousConsoleLog(...args.map((arg) => sanitizeLogArg(arg, 0)));
      } finally {
        innerConsoleLog = false;
      }
    };
  };
  monkeyPatchConsoleLogValue(console.log);
  // Ensure new overrides to console.log will not take precedence
  Object.defineProperty(console, "log", {
    get: () => finalConsoleLog,
    set: (newConsoleLog) => monkeyPatchConsoleLogValue(newConsoleLog),
  });
}
