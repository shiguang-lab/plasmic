import { createTransport } from "@graphiql/toolkit";

/** Use the configured endpoint directly; data sources need no OPTIONS discovery. */
export function createGraphqlTransport({
  url,
  headers,
  method = "POST",
}: {
  url: string;
  headers?: Record<string, string>;
  method?: string;
}) {
  return createTransport({
    url,
    headers: { "Content-Type": "application/json", ...headers },
    method: method === "GET" ? "GET" : "POST",
    supportedMethods: ["GET", "POST"],
    enableIncrementalDelivery: false,
  });
}
