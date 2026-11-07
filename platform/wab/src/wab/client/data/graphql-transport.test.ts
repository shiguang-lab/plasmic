import { createGraphqlTransport } from "@/wab/client/data/graphql-transport";
import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => vi.restoreAllMocks());

function mockEndpoint(body: unknown = { data: { name: "测试" } }, status = 200) {
  return vi.spyOn(window, "fetch").mockResolvedValue(
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    })
  );
}

describe("GraphQL endpoint transport", () => {
  it("sends POST JSON, auth headers and selected operation without OPTIONS", async () => {
    const fetch = mockEndpoint();
    const request = {
      query: "query Person($id: ID!) { person(id: $id) { name } }",
      variables: { id: "中文 &?" },
      operationName: "Person",
    };
    const result = await createGraphqlTransport({
      url: "https://example.test/graphql",
      headers: { Authorization: "Bearer test" },
    }).send(request);
    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe("https://example.test/graphql");
    expect(init?.method).toBe("POST");
    expect(JSON.parse(String(init?.body))).toEqual(request);
    expect(new Headers(init?.headers).get("Authorization")).toBe("Bearer test");
    expect(new Headers(init?.headers).get("Content-Type")).toBe("application/json");
    expect(result).toMatchObject({ ok: true, body: { data: { name: "测试" } } });
  });

  it("encodes GET variables as JSON and preserves existing URL parameters", async () => {
    const fetch = mockEndpoint();
    const request = {
      query: "query Person($id: ID!) { person(id: $id) { name } }",
      variables: { id: "中文 &?", nested: { active: true } },
      operationName: "Person",
    };
    await createGraphqlTransport({ url: "https://example.test/graphql?tenant=one", method: "GET" }).send(request);
    expect(fetch).toHaveBeenCalledTimes(1);
    const [rawUrl, init] = fetch.mock.calls[0];
    const url = new URL(String(rawUrl));
    expect(url.searchParams.get("tenant")).toBe("one");
    expect(url.searchParams.get("query")).toBe(request.query);
    expect(JSON.parse(url.searchParams.get("variables") ?? "")).toEqual(request.variables);
    expect(url.searchParams.get("operationName")).toBe("Person");
    expect(init?.method).toBe("GET");
    expect(init?.body).toBeUndefined();
  });

  it("sends mutations over POST even when queries use GET", async () => {
    const fetch = mockEndpoint();
    await createGraphqlTransport({ url: "https://example.test/graphql", method: "GET" }).send({ query: "mutation { updatePerson { name } }" });
    expect(fetch.mock.calls[0][1]?.method).toBe("POST");
  });

  it("keeps GraphQL and HTTP failures visible to the editor", async () => {
    const errors = [{ message: "unauthorized" }];
    mockEndpoint({ errors }, 401);
    const result = await createGraphqlTransport({ url: "https://example.test/graphql" }).send({ query: "{ person { name } }" });
    expect(result).toMatchObject({ ok: false, status: 401, body: { errors } });
  });

  it("passes cancellation to fetch and propagates network failures", async () => {
    const fetch = vi.spyOn(window, "fetch").mockRejectedValue(new DOMException("Cancelled", "AbortError"));
    const controller = new AbortController();
    await expect(createGraphqlTransport({ url: "https://example.test/graphql" }).send({ query: "{ person { name } }", signal: controller.signal })).rejects.toMatchObject({ name: "AbortError" });
    expect(fetch.mock.calls[0][1]?.signal).toBe(controller.signal);
  });

  it("rejects an already cancelled operation before making a request", async () => {
    const fetch = mockEndpoint();
    const controller = new AbortController();
    controller.abort();
    const transport = createGraphqlTransport({ url: "https://example.test/graphql" });
    await expect(Promise.resolve().then<unknown>(() => transport.send({ query: "{ person { name } }", signal: controller.signal }))).rejects.toMatchObject({ name: "AbortError" });
    expect(fetch).not.toHaveBeenCalled();
  });
});
