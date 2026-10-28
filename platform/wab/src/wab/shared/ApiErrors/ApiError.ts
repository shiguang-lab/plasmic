export interface ApiRequest {
  method: string;
  url: string;
}

/**
 * Base class for errors that are sent to the client with a specific HTTP
 * status code. See errors.ts for the concrete errors.
 */
export abstract class ApiError extends Error {
  name = "ApiError";
  statusCode = 400;
  request?: ApiRequest;
}

/** A request that failed before receiving an HTTP response. */
export class NetworkError extends Error {
  name = "NetworkError";
  constructor(public request: ApiRequest, options?: ErrorOptions) {
    super("No response received from the server.", options);
  }
}

/** An API response that does not contain a recognized structured error. */
export class UnknownApiError extends Error {}

/** A nonstandard API error response still retains its HTTP classification. */
export class HttpError extends ApiError {
  name = "HttpError";
  constructor(
    public statusCode: number,
    message?: string,
  ) {
    super(message || `HTTP ${statusCode}`);
  }
}
