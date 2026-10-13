import { getUiLocale, useI18n } from "@/wab/client/i18n";
import {
  MessageKey,
  translate,
  translateUiLabel,
} from "@/wab/client/i18n/locales";
import { ApiError, HttpError } from "@/wab/shared/ApiErrors/ApiError";
import { transformErrors } from "@/wab/shared/ApiErrors/errors";
import { UserError } from "@/wab/shared/UserError";
import React from "react";

export function asApiError(error: unknown): ApiError | undefined {
  if (error instanceof ApiError) {
    return error;
  }
  if (
    error &&
    typeof error === "object" &&
    "name" in error &&
    "message" in error
  ) {
    const restored = transformErrors(error as Error);
    if (restored instanceof ApiError) {
      return restored;
    }
    if (
      "statusCode" in error &&
      typeof error.statusCode === "number" &&
      error.statusCode >= 400 &&
      error.statusCode <= 599
    ) {
      return new HttpError(
        error.statusCode,
        typeof error.message === "string" ? error.message : undefined,
      );
    }
  }
  return undefined;
}

export function getApiErrorPresentation(error: ApiError): {
  title: MessageKey;
  description: MessageKey;
  type: "warning" | "error";
} {
  switch (error.name) {
    case "AuthError":
      return {
        title: "Session verification failed",
        description:
          "Reload the page and sign in again to verify your session.",
        type: "warning",
      };
    case "CaptchaError":
      return {
        title: "Verification required",
        description: "Complete the security verification and try again.",
        type: "warning",
      };
    case "ProjectRevisionError":
      return {
        title: "Project has changed",
        description:
          "The project was changed by another editor. Reload it before trying again.",
        type: "warning",
      };
    case "SchemaMismatchError":
    case "StaleCliError":
    case "LoaderDeprecatedVersionError":
      return {
        title: "Update required",
        description: "Update the editor or integration packages and try again.",
        type: "warning",
      };
    case "CopilotPlanRequiredError":
      return {
        title: "Feature unavailable",
        description: "Your organization does not have access to this feature.",
        type: "warning",
      };
    case "CopilotRateLimitExceededError":
      return {
        title: "Request limit reached",
        description: "The AI request limit has been reached. Try again later.",
        type: "warning",
      };
    case "GrantUserNotFoundError":
      return {
        title: "User not found",
        description: "Unable to grant access to a non-existent user",
        type: "warning",
      };
  }
  switch (error.statusCode) {
    case 401:
      return {
        title: "Sign-in required",
        description:
          "Your session has expired or you are not signed in. Sign in and try again.",
        type: "warning",
      };
    case 403:
      return {
        title: "Action not allowed",
        description: "You do not have permission to perform this action.",
        type: "warning",
      };
    case 404:
      return {
        title: "Resource not found",
        description:
          "The requested resource does not exist or is no longer available.",
        type: "warning",
      };
    case 409:
      return {
        title: "Conflicting changes",
        description:
          "The request conflicts with existing data. Check for duplicate values and try again.",
        type: "warning",
      };
    case 412:
      return {
        title: "Action cannot be completed",
        description:
          "The current resource state does not allow this action. Refresh and try again.",
        type: "warning",
      };
    case 429:
      return {
        title: "Request limit reached",
        description: "Too many requests. Wait a moment and try again.",
        type: "warning",
      };
    case 503:
      return {
        title: "Service unavailable",
        description:
          "The service is temporarily unavailable. Please try again later.",
        type: "error",
      };
    default:
      return error.statusCode < 500
        ? {
            title: "Invalid request",
            description: "Check the submitted values and try again.",
            type: "warning",
          }
        : {
            title: "Unexpected error",
            description:
              "Something went wrong on the server. Please try again later.",
            type: "error",
          };
  }
}

// Backend diagnostics stay intact on the Error. Only reviewed messages are UI
// captions; arbitrary API/provider English falls back to a localized category.
const reasons: Record<string, MessageKey> = {
  "offset field cannot be negative": "Offset cannot be negative.",
  "limit field cannot be negative": "Limit cannot be negative.",
  "unexpected analytics type": "The selected analytics type is invalid.",
  "Invalid API token": "Invalid API token",
  "Invalid editor preferences": "Invalid editor preferences",
  "Invalid request origin": "Invalid request origin",
  "Ownership can only be granted by transfer":
    "Ownership can only be granted by transfer",
  "Another AI run is active in this project.":
    "Another AI run is active in this project.",
  "Attachment is not accessible.": "Attachment is not accessible.",
  "Execution lease is not valid.": "Execution lease is not valid.",
  "Finish or reconcile the active AI operation before undoing.":
    "Finish or reconcile the active AI operation before undoing.",
  "Saved design changed. Reload and verify the latest revision.":
    "Saved design changed. Reload and verify the latest revision.",
  "Current editor undo record is not available.":
    "Current editor undo record is not available.",
  "The previous editor lease is still active.":
    "The previous editor lease is still active.",
  "Attachment content does not match its supported file type.":
    "Attachment content does not match its supported file type.",
  "Verify saved design to reconcile an unconfirmed editor operation before another request.":
    "Verify saved design to reconcile an unconfirmed editor operation before another request.",
  "Only the run initiator can execute tools.":
    "Only the run initiator can execute tools.",
  "Only the run initiator can undo its current editor changes.":
    "Only the run initiator can undo its current editor changes.",
  "Reopen the saved design in a new editor session before reconciling this run.":
    "Reopen the saved design in a new editor session before reconciling this run.",
  "Tool result changed the execution scope.":
    "Tool result changed the execution scope.",
};

export function getErrorMessage(error: unknown): string {
  const locale = getUiLocale();
  const apiError = asApiError(error);
  if (apiError) {
    // Subscription restrictions returned by deployments that use billing.
    if (/^You can only have one unpaid organization\./.test(apiError.message)) {
      return translate(
        locale,
        "Only one unpaid organization is allowed. Upgrade or delete the existing organization before creating or restoring another.",
      );
    }
    if (
      /^Projects can only be transferred to a paid organization\./.test(
        apiError.message,
      )
    ) {
      return translate(
        locale,
        "Projects can only be transferred to a paid organization.",
      );
    }
    if (apiError.message.startsWith("Cannot delete end user directory")) {
      return translate(
        locale,
        "Remove associated apps before deleting this user directory.",
      );
    }
    if (
      apiError.message.startsWith(
        "Cannot permanently delete a workspace that still contains",
      )
    ) {
      return translate(
        locale,
        "Remove CMS databases, data sources and projects before permanently deleting a workspace.",
      );
    }
    const reason = reasons[apiError.message];
    return translate(
      locale,
      reason ?? getApiErrorPresentation(apiError).description,
    );
  }
  return translateUiLabel(
    locale,
    error instanceof UserError
      ? error.description
      : error instanceof Error
        ? error.message
        : String(error ?? ""),
  );
}

export function getErrorType(error: unknown): "warning" | "error" {
  const api = asApiError(error);
  return api ? getApiErrorPresentation(api).type : "error";
}

/** Subscribe even when a notification or modal is already open. */
export function ErrorDescription({ error }: { error: unknown }) {
  useI18n();
  return <>{getErrorMessage(error)}</>;
}
