/** @vitest-environment node */
import {
  setupSsrfTestServers,
  SsrfTestServers,
  startTestServer,
  TestServer,
} from "@/wab/server/__testonly__/test-server";
import { fetchUntrusted, UnsafeUrlError } from "@/wab/server/util/url";

describe("fetchUntrusted", () => {
  let ssrf: SsrfTestServers | undefined;

  beforeEach(async () => {
    ssrf = await setupSsrfTestServers();
  });

  afterEach(async () => {
    await ssrf?.dispose();
  });

  it("fetches an external IP", async () => {
    await expect(
      fetchUntrusted({
        method: "GET",
        url: ssrf!.externalGoodServer.url,
      }),
    ).resolves.toMatchObject({
      status: 200,
      data: ssrf!.expectedGoodContent,
    });
    expect(ssrf!.externalGoodServer.requestCount()).toBe(1);
  });

  it("does not fetch an internal IP", async () => {
    await expect(
      fetchUntrusted({ method: "GET", url: ssrf!.internalServer.url }),
    ).rejects.toThrow(UnsafeUrlError);
    expect(ssrf!.internalServer.requestCount()).toBe(0);
  });

  it("does not fetch an internal IP via external redirect", async () => {
    await expect(
      fetchUntrusted({ method: "GET", url: ssrf!.externalBadServer.url }),
    ).rejects.toThrow(UnsafeUrlError);
    expect(ssrf!.externalBadServer.requestCount()).toBe(1);
    expect(ssrf!.internalServer.requestCount()).toBe(0);
  });
});

describe("fetchUntrusted - two-hop redirect boundary", () => {
  let ssrf: SsrfTestServers;
  let firstHop: TestServer;
  beforeEach(async () => {
    ssrf = await setupSsrfTestServers();
    firstHop = await startTestServer("127.0.0.1", (_req, res) => {
      res.writeHead(302, { Location: ssrf.externalBadServer.url });
      res.end();
    });
  });
  afterEach(async () => {
    await firstHop.dispose();
    await ssrf.dispose();
  });

  it("follows redirect with fetch but fails with fetchUntrusted", async () => {
    const response = await fetch(firstHop.url, {
      signal: AbortSignal.timeout(5000),
    });
    expect(await response.text()).toBe("INTERNAL ONLY");
    const requestsAfterFetch = ssrf.internalServer.requestCount();
    expect(requestsAfterFetch).toBeGreaterThan(0);
    let redirectCount = 0;
    await expect(
      fetchUntrusted({
        method: "GET",
        url: firstHop.url,
        timeout: 5000,
        beforeRedirect: () => {
          ++redirectCount;
        },
      }),
    ).rejects.toThrow(UnsafeUrlError);
    expect(ssrf.internalServer.requestCount()).toBe(requestsAfterFetch);
    expect(redirectCount).toBe(2);
    expect(firstHop.requestCount()).toBe(2);
    expect(ssrf.externalBadServer.requestCount()).toBe(2);
  });
});
