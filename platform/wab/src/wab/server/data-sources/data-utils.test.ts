import { processHttpResult } from "@/wab/server/data-sources/data-utils";
import { DataSourceError } from "@/wab/shared/data-sources-meta/data-sources";
import { AxiosResponse } from "axios";

function makeResponse(
  status: number,
  data: any,
  headers: Record<string, string> = { "content-type": "application/json" },
): AxiosResponse<string> {
  return {
    data,
    status,
    statusText: "",
    headers,
    config: {} as any,
  };
}

describe("processHttpResult", () => {
  it("parses JSON bodies on 2xx responses", async () => {
    await expect(
      processHttpResult(makeResponse(200, '{"ok":true}')),
    ).resolves.toEqual({
      data: {
        response: { ok: true },
        statusCode: 200,
        headers: { "content-type": "application/json" },
      },
    });
  });

  it("preserves plain text bodies when response is not JSON", async () => {
    await expect(
      processHttpResult(makeResponse(200, "plain-text")),
    ).resolves.toEqual({
      data: {
        response: "plain-text",
        statusCode: 200,
        headers: { "content-type": "application/json" },
      },
    });
  });

  it("throws DataSourceError with parsed body or undefined when empty on >=400", async () => {
    await expect(
      processHttpResult(makeResponse(422, '{"error":"invalid"}')),
    ).rejects.toSatisfy(
      (err: unknown) =>
        err instanceof DataSourceError &&
        err.statusCode === 422 &&
        err.details?.error === "invalid",
    );

    await expect(
      processHttpResult(makeResponse(503, "{}")),
    ).rejects.toSatisfy(
      (err: unknown) =>
        err instanceof DataSourceError &&
        err.statusCode === 503 &&
        err.details === undefined,
    );
  });
});
