import type { GetProjectResponse } from "@/wab/shared/ApiSchema";
import * as Comlink from "comlink";

// Only the authorized, JSON-backed startup response uses this wire format.
const responses = new WeakSet<object>();
export function transferProjectModel(response: GetProjectResponse): GetProjectResponse {
  responses.add(response);
  return response;
}
Comlink.transferHandlers.set("PROJECT_MODEL", {
  canHandle: (value): value is GetProjectResponse =>
    typeof value === "object" && value !== null && responses.has(value),
  serialize: (value: GetProjectResponse) => {
    responses.delete(value);
    return [JSON.stringify(value), []];
  },
  deserialize: (value: string): GetProjectResponse => JSON.parse(value),
} satisfies Comlink.TransferHandler<GetProjectResponse, string>);
