import { ApiError, HttpError } from "@/wab/shared/ApiErrors/ApiError";
import {
  BadRequestError,
  ForbiddenError,
  PublicCopilotServiceUnavailable,
  deserializeApiError,
  transformErrors,
} from "@/wab/shared/ApiErrors/errors";

it("restores business types and retains structured validation details", () => {
  const issues = [{ path: ["name"], message: "Required" }];
  const restored = deserializeApiError(
    {
      name: "BadRequestError",
      message: "Invalid values",
      statusCode: 400,
      issues,
    },
    400,
  );
  expect(restored).toBeInstanceOf(BadRequestError);
  expect((restored as BadRequestError).issues).toEqual(issues);
  expect(
    deserializeApiError(
      { name: "ForbiddenError", message: "Access denied" },
      403,
    ),
  ).toBeInstanceOf(ForbiddenError);
});

it.each([400, 401, 403, 404, 409, 412, 429, 500, 503])(
  "keeps status %s for unregistered API responses",
  (status) => {
    const restored = deserializeApiError(
      { name: "IntegrationError", message: "Provider refused the request" },
      status,
    );
    expect(restored).toBeInstanceOf(ApiError);
    expect(restored).toBeInstanceOf(HttpError);
    expect(restored.statusCode).toBe(status);
    expect(restored.message).toBe("Provider refused the request");
  },
);

it("handles string/empty responses and restores the public AI service error", () => {
  expect(deserializeApiError("Forbidden", 403).statusCode).toBe(403);
  expect(deserializeApiError(undefined, 404).statusCode).toBe(404);
  expect(
    transformErrors({
      name: "PublicCopilotServiceUnavailable",
      message: "Service unavailable",
    } as Error),
  ).toBeInstanceOf(PublicCopilotServiceUnavailable);
});
