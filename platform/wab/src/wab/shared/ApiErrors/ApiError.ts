/**
 * Base class for errors that are sent to the client with a specific HTTP
 * status code. See errors.ts for the concrete errors.
 */
export abstract class ApiError extends Error {
  name = "ApiError";
  statusCode = 400;
}

/** A nonstandard API error response still retains its HTTP classification. */
export class HttpError extends ApiError {
  name = "HttpError";
  constructor(
    public statusCode: number,
    message?: string,
  ) {
    super(message);
  }
}
