import { reportError, showError } from "@/wab/client/ErrorNotifications";
import {
  ErrorDescription,
  getApiErrorPresentation,
  getErrorMessage,
} from "@/wab/client/api-error-presentation";
import { setLanguagePreference } from "@/wab/client/i18n";
import { languageOptions, translate } from "@/wab/client/i18n/locales";
import { HttpError } from "@/wab/shared/ApiErrors/ApiError";
import { UniqueViolationError } from "@/wab/shared/ApiErrors/cms-errors";
import {
  AuthError,
  BadRequestError,
  BundleTypeError,
  CaptchaError,
  CopilotPlanRequiredError,
  CopilotRateLimitExceededError,
  ForbiddenError,
  GrantUserNotFoundError,
  LoaderBundlingError,
  LoaderDeprecatedVersionError,
  NotFoundError,
  PreconditionFailedError,
  ProjectRevisionError,
  PublicCopilotServiceUnavailable,
  SchemaMismatchError,
  StaleCliError,
  UnauthorizedError,
  UnknownReferencesError,
  deserializeApiError,
} from "@/wab/shared/ApiErrors/errors";
import * as Sentry from "@sentry/browser";
import { act, cleanup, render, screen } from "@testing-library/react";
import { notification } from "antd";
import React from "react";
const businessTypes = [
  BadRequestError,
  ForbiddenError,
  NotFoundError,
  ProjectRevisionError,
  SchemaMismatchError,
  StaleCliError,
  AuthError,
  CaptchaError,
  UnknownReferencesError,
  BundleTypeError,
  CopilotPlanRequiredError,
  CopilotRateLimitExceededError,
  GrantUserNotFoundError,
  PreconditionFailedError,
  LoaderBundlingError,
  LoaderDeprecatedVersionError,
  UnauthorizedError,
];
afterEach(async () => {
  cleanup();
  await act(async () => await setLanguagePreference("en"));
  vi.restoreAllMocks();
});

it.each(businessTypes)(
  "classifies %s as an expected business error after transport",
  async (ErrorType) => {
    const original = new ErrorType("Untranslated provider diagnostic");
    const error = deserializeApiError(
      JSON.parse(JSON.stringify({ ...original, message: original.message })),
      original.statusCode,
    );
    expect(getApiErrorPresentation(error).title).not.toBe("Unexpected error");
    expect(getApiErrorPresentation(error).type).toBe("warning");
    for (const { value } of languageOptions.filter((x) => x.value !== "en")) {
      await act(async () => await setLanguagePreference(value));
      expect(getErrorMessage(error)).not.toContain(
        "Untranslated provider diagnostic",
      );
      expect(getErrorMessage(error)).not.toContain(error.name);
    }
  },
);

it("renders the organization restriction as a localized warning, including locale changes while open", async () => {
  const open = vi
    .spyOn(notification, "open")
    .mockImplementation(() => undefined);
  const error = new ForbiddenError(
    "You can only have one unpaid organization. Upgrade or delete your existing organization before creating another.",
  );
  showError(error);
  const args = open.mock.calls[0][0];
  expect(args.type).toBe("warning");
  render(
    <>
      <div data-testid="title">{args.message}</div>
      <div data-testid="reason">{args.description}</div>
    </>,
  );
  for (const { value } of languageOptions) {
    await act(async () => await setLanguagePreference(value));
    expect(screen.getByTestId("title").textContent).toBe(
      translate(value, "Action not allowed"),
    );
    expect(screen.getByTestId("reason").textContent).toBe(
      getErrorMessage(error),
    );
    expect(screen.getByTestId("reason").textContent).not.toContain(
      "ForbiddenError:",
    );
  }
  expect(error.message).toContain("You can only have one unpaid organization");
  args.onClose?.();
});

it("handles duplicate fields, service outages and genuine server failures distinctly", () => {
  expect(getApiErrorPresentation(new UniqueViolationError([])).title).toBe(
    "Conflicting changes",
  );
  expect(
    getApiErrorPresentation(new PublicCopilotServiceUnavailable()).title,
  ).toBe("Service unavailable");
  expect(getApiErrorPresentation(new HttpError(500)).title).toBe(
    "Unexpected error",
  );
  const capture = vi.spyOn(Sentry, "captureException");
  reportError(new ForbiddenError("Blocked"));
  expect(capture).not.toHaveBeenCalled();
  reportError(new Error("Technical failure"));
  expect(capture).toHaveBeenCalledOnce();
});

it("subscribes for serialized and unknown HTTP business errors without exposing raw diagnostics", async () => {
  const error = {
    name: "HttpError",
    statusCode: 403,
    message: "Opaque provider diagnostic",
  };
  render(<ErrorDescription error={error} />);
  await act(async () => await setLanguagePreference("zh-CN"));
  expect(screen.getByText("你没有执行此操作的权限。")).toBeTruthy();
  await act(async () => await setLanguagePreference("ja"));
  expect(screen.queryByText("Opaque provider diagnostic")).toBeNull();
});
