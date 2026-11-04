import {
  asApiError,
  getApiErrorPresentation,
} from "@/wab/client/api-error-presentation";
import { UiLabel, UiText } from "@/wab/client/i18n/UiText";
import { analytics } from "@/wab/client/observability";
import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { ApiError, NetworkError } from "@/wab/shared/ApiErrors/ApiError";
import { UserError } from "@/wab/shared/UserError";
import {
  AssertionError,
  FalsyValueError,
  HarmlessError,
  NullOrUndefinedValueError,
  mkUuid,
  shallowJson,
  spawn,
  stampObjectUuid,
} from "@/wab/shared/common";
import { tryGetTplOwnerComponent } from "@/wab/shared/core/tpls";
import { DEVFLAGS } from "@/wab/shared/devflags";
import { isStampedIgnoreError } from "@/wab/shared/error-handling";
import { TplNode } from "@/wab/shared/model/classes";
import * as Sentry from "@sentry/browser";
import { message as antdMessage } from "antd";
import { IconType } from "antd/lib/notification/interface";
import React from "react";

/** Keep full diagnostics in the console; Desktop persists this record to disk. */
export function logError(error: unknown, title = "Studio operation failed", description?: string) {
  const normalized = normalizeError(error);
  const api = asApiError(error);
  console.error("Studio operation failed " + JSON.stringify({
    title, description, name: normalized.name, message: normalized.message,
    stack: normalized.stack, statusCode: api?.statusCode,
    request: (error as ApiError | undefined)?.request,
    detail: error instanceof UserError ? error.description : undefined,
  }));
}

// Note that sometimes you will see double errors, due to React rethrowing
// errors and/or mobx rethrowing errors.  I don't fully understand the mechanics
// (there is some magic that React does across execution contexts) but this only
// happens in development and not production.
export function showError(
  error: unknown,
  opts?: {
    title?: string;
    description?: string;
    type?: IconType;
  },
) {
  const { title = "Unexpected error", description, type } = opts ?? {};
  const normalized = normalizeError(error);
  const businessError = asApiError(error);
  logError(error, title, description);
  const info = error instanceof NetworkError || normalized.message?.includes("XHRStatus0Error")
    ? { title: "Temporarily disconnected", type: "error" as const }
    : businessError
      ? getApiErrorPresentation(businessError)
      : { title: opts?.title ?? (error instanceof UserError ? "Operation failed" : title), type: "error" as const };
  const key = JSON.stringify([info.title, normalized.name, normalized.message, businessError?.statusCode]);
  const heading = <UiLabel text={info.title.length <= 100 ? info.title : "Operation failed"} />;
  const messageType = type ?? info.type;
  const showMessage = messageType === "error" ? antdMessage.error : antdMessage.open;
  void showMessage({
    type: messageType,
    key,
    content: heading,
    duration: 4,
  });
}

/**
 * This is intended to be called from onerror and onunhandledrejection, so it
 * breaks out the processing into separate ticks (so that any errors from
 * *those* will in turn be sure to raise more errors loudly).  We just want to
 * be careful never to silence things.
 */
export function handleError(error: Error, source?: string) {
  if (shouldIgnoreError(error, source)) {
    return;
  }
  logError(error);
  setTimeout(() => {
    if (DEVFLAGS.debug || shouldShowError(error)) {
      showError(error);
    }
  }, 0);
  setTimeout(() => {
    const apiError = asApiError(error);
    if (apiError && apiError.statusCode < 500) {
      return;
    }
    stampObjectUuid(error);
    Sentry.captureException(error);
    analytics().track("Error", {
      error: shallowJson(error),
    });
  }, 0);
}

function shouldShowError(error: Error) {
  if (
    error instanceof AssertionError ||
    error instanceof NullOrUndefinedValueError ||
    error instanceof FalsyValueError
  ) {
    if ((window as any).isProd) {
      // For now, we don't show AssertionErrors, NullOrUndefinedValueErrors, FalsyValueError to users
      return false;
    }
  }
  return true;
}

// The following is a list of "harmless" errors thrown by third-party code, the list is used both
// to ignore errors that are handled and should not be shown to the user, and to ignore errors that
// are unhandled and should not be reported
export const ERROR_PATTERNS_TO_IGNORE = [
  // react-aria
  // https://app.shortcut.com/plasmic/story/38632/typeerror-failed-to-execute-createtreewalker-on-document-parameter-1-is-not-of-type-node
  "createTreeWalker",

  // monaco
  // https://app.shortcut.com/plasmic/story/39095/error-cannot-read-properties-of-null-reading-getstartposition
  "reading 'getStartPosition'",
  // Monaco tried to use web workers, but the apphost can block it with CSP
  ".loadForeignModule",

  // antd / rc-align sometimes throw this by using ReactDOM.findDOMNode()
  "Unable to find node on an unmounted component",

  // This is to avoid an error message generated by the Antd Button onClick()
  // (that doesn't work well cross frame) of the Antd Tabs Custom Action
  "Failed to execute 'appendChild'",

  // TinyMCE editor throws this error when embedding media
  // with iframe snippet, and opening the media modal again;
  // it tries to look for a "data" field, which doesn't exist
  // from the data object parsed from the iframe snippet.
  "Could not find valid *required* value for",

  // This is to avoid an error message generated by React Joy Ride when the target
  // element goes away during the tour step
  "isSameNode",

  // This is a known benign error that happens with ResizeObserver
  // https://linear.app/plasmic/issue/PLA-1721
  "ResizeObserver loop completed with undelivered notifications.",
];

export function shouldIgnoreError(error: Error, source?: string) {
  if (
    error.message &&
    ERROR_PATTERNS_TO_IGNORE.some((pattern) => error.message.includes(pattern))
  ) {
    return true;
  }

  if (error instanceof HarmlessError) {
    return true;
  }

  // Monaco editor worker sometimes throws and the error gets to `window.error`
  if (
    error.message?.toLowerCase().includes("debug failure") &&
    source?.toLowerCase().includes("monaco")
  ) {
    return true;
  }

  if (isStampedIgnoreError(error)) {
    return true;
  }

  return false;
}

export function reportError(error: Error, eventName?: string) {
  logError(error, eventName);
  const apiError = asApiError(error);
  if (error instanceof UserError || (apiError && apiError.statusCode < 500)) {
    if (DEVFLAGS.debug) {
      console.log("UserError: ", eventName ?? error.name, error.message, error);
    }
    return;
  }
  console.log("Error: ", eventName ?? error.name, error.message, error);
  Sentry.captureException(error);
  analytics().track(eventName ?? error.name, {
    name: error.name,
    message: error.message,
  });
}

export function reportSilentErrorMessage(
  msg: string,
  eventName = "Silent Error",
) {
  Sentry.captureMessage(msg);
  analytics().track(eventName, {
    message: msg,
  });
}

export function notifyReferencingNode(
  title: string,
  message: string,
  referencingNode: TplNode | null | undefined,
  studioCtx: StudioCtx,
) {
  const owningComponent = referencingNode
    ? tryGetTplOwnerComponent(referencingNode)
    : undefined;
  const key = mkUuid();
  console.error("Referenced node operation failed", { title, detail: message, referencingNode });
  void antdMessage.error({
    key,
    duration: 4,
    content: (
      <>
        <UiLabel text={title} />{" "}
        {referencingNode && owningComponent ? (
          <a
            onClick={() => {
              spawn(
                studioCtx.setStudioFocusOnTpl(owningComponent, referencingNode),
              );
              antdMessage.destroy(key);
            }}
          >
            <UiText message={"[Go to reference]"} />
          </a>
        ) : null}
      </>
    ),
  });
}

// Sometimes the handled variable is not of type Error, so we need to normalize it
// https://linear.app/plasmic/issue/PLA-11224/captureexception-error
export function normalizeError(error: any) {
  return isStampedIgnoreError(error)
    ? error
    : error instanceof Error
      ? error
      : error && error.error
        ? (error.error as Error)
        : error && typeof error.message === "string"
          ? Object.assign(new Error(error.message), {
              ...(typeof error.name === "string" ? { name: error.name } : {}),
              ...(typeof error.stack === "string" ? { stack: error.stack } : {}),
            })
        : typeof error === "string"
          ? new Error(error)
          : new Error(
              `Unknown error: ${
                typeof error === "object" ? JSON.stringify(error) : error
              }`,
            );
}
