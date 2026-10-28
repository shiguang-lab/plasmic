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
import { Scrollbar } from "@shiguang2/components/esm/scrollbar";
import { Button, message as antdMessage } from "antd";
import { IconType } from "antd/lib/notification/interface";
import copy from "copy-to-clipboard";
import React from "react";

const errorMessageCounters = new Map<string, number>();

function ErrorDetailsContent({ details }: { details: string }) {
  const [copied, setCopied] = React.useState(false);
  return (
    <div style={{ minWidth: 0 }}>
      <Scrollbar scrollX={false} style={{ maxHeight: "60vh", minHeight: 0 }}>
        <pre
          style={{
            margin: 0,
            whiteSpace: "pre-wrap",
            overflowWrap: "anywhere",
            userSelect: "text",
          }}
        >
          {details}
        </pre>
      </Scrollbar>
      <Button style={{ marginTop: 16 }} onClick={() => setCopied(copy(details))}>
        <UiText message={copied ? "Copied" : "Copy details"} />
      </Button>
    </div>
  );
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
  console.error("Studio operation failed", { error, title, description });
  const deriveErrorInfo = () => {
    if (error instanceof NetworkError || normalized.message?.includes("XHRStatus0Error")) {
      return { title: "Temporarily disconnected", type: type ?? ("error" as const) };
    }
    if (businessError) {
      const presentation = getApiErrorPresentation(businessError);
      return { title: opts?.title ?? presentation.title, type: type ?? ("error" as const) };
    }
    return {
      title: opts?.title ?? (error instanceof UserError ? "Operation failed" : title),
      type: type ?? ("error" as const),
    };
  };

  const info = deriveErrorInfo();
  const reason = error instanceof NetworkError
    ? "No response was received. Check your network connection and whether the service is reachable."
    : businessError
    ? getApiErrorPresentation(businessError).description
    : error instanceof UserError
      ? normalized.message
      : `${normalized.name || "Error"}: ${normalized.message}`;
  const summary = reason.replace(/\s+/g, " ").trim();
  const briefReason = summary.length > 180 ? `${summary.slice(0, 180)}…` : summary;
  const errorText = `${normalized.name || "Error"}: ${normalized.message}`;
  const request = error instanceof ApiError || error instanceof NetworkError
    ? error.request
    : undefined;
  const details = [
    request ? `${request.method} ${request.url}` : undefined,
    businessError ? `HTTP ${businessError.statusCode}` : undefined,
    normalized.stack?.startsWith(errorText)
      ? normalized.stack
      : [errorText, normalized.stack].filter(Boolean).join("\n"),
    description,
    error instanceof UserError ? error.description : undefined,
  ].filter(Boolean).join("\n\n");
  const key = JSON.stringify([info.title, normalized.name, normalized.message, businessError?.statusCode, request]);
  const newCount = 1 + (errorMessageCounters.get(key) || 0);
  errorMessageCounters.set(key, newCount);

  const heading = (
    <div style={{ maxWidth: "min(520px, calc(100vw - 80px))", textAlign: "left" }}>
      <div>
        <UiLabel text={info.title} />
        {newCount > 1 && (
          <UiText message=" ({count} occurrences)" values={{ count: newCount }} />
        )}
      </div>
      <div style={{ marginTop: 4, overflowWrap: "anywhere" }}>
        <UiLabel text={briefReason} />
      </div>
      <button
        type="button"
        className="link-like"
        onClick={() => {
          antdMessage.destroy(key);
          spawn(import("@/wab/client/components/quick-modals").then(({ showTemporaryInfo }) =>
            showTemporaryInfo({
              title: <UiText message="Error details" />,
              content: <ErrorDetailsContent details={details} />,
              width: 720,
            }),
          ));
        }}
      >
        <UiText message="View details" />
      </button>
    </div>
  );
  const onClose = () => errorMessageCounters.delete(key);
  const showMessage = info.type === "error" ? antdMessage.error : antdMessage.open;
  void showMessage({
    type: info.type,
    key,
    content: heading,
    duration: 4,
    onClose,
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
