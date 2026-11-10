vi.mock("@/wab/client/env", () => ({ ENV: { COMMITHASH: "cache-test" } }));
beforeEach(() => {
  vi.resetModules();
  vi.stubGlobal("BroadcastChannel", class { postMessage() { return undefined; } });
});
afterEach(() => {
  vi.unstubAllGlobals();
  window.history.replaceState(null, "", "/");
});
it("presentation resources carry the code and branch and bypass the signed-in cache", async () => {
  window.history.replaceState(null, "", "/d/0123456789?branch=design#/details/42");
  const fetchMock = vi.fn<typeof fetch>(async () => new Response("shared"));
  vi.stubGlobal("fetch", fetchMock);
  const { fetchLibraryResource } = await import("@/wab/client/resource-cache");
  await fetchLibraryResource("/api/v1/hostless-libraries/antd/canvas");
  const options = fetchMock.mock.calls[0][1] as RequestInit;
  expect(new Headers(options.headers).get("x-plasmic-presentation-code")).toBe("0123456789");
  expect(new Headers(options.headers).get("x-plasmic-presentation-branch")).toBe("design");
  expect(options.cache).toBe("no-store");
});
it("App resource reads use the native protocol without creating a browser cache", async () => {
  vi.spyOn(navigator, "userAgent", "get").mockReturnValue("PlasmicDesktop/darwin");
  const open = vi.fn();
  vi.stubGlobal("caches", { open });
  const fetch = vi.fn(async () => new Response("native"));
  vi.stubGlobal("fetch", fetch);
  const { fetchLibraryResource } = await import("@/wab/client/resource-cache");
  expect(await (await fetchLibraryResource("/api/v1/dependency-models/model")).text()).toBe("native");
  expect(open).not.toHaveBeenCalled();
  expect(fetch).toHaveBeenCalledWith("/api/v1/dependency-models/model", undefined);
});
it("Web resources still load when browser storage access is blocked", async () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, "caches");
  Object.defineProperty(globalThis, "caches", { configurable: true, get() { throw new DOMException("Blocked", "SecurityError"); } });
  try {
    const fetch = vi.fn(async () => new Response("network"));
    vi.stubGlobal("fetch", fetch);
    const { fetchLibraryResource, clearResourceCache } = await import("@/wab/client/resource-cache");
    expect(await (await fetchLibraryResource("/api/v1/dependency-models/model")).text()).toBe("network");
    expect(fetch).toHaveBeenCalledWith("/api/v1/dependency-models/model", expect.objectContaining({cache:"no-store"}));
    await expect(clearResourceCache()).resolves.toBeUndefined();
  } finally {
    if (descriptor) {Object.defineProperty(globalThis,"caches",descriptor);}
    else {Reflect.deleteProperty(globalThis,"caches");}
  }
});
it("unrelated and mutable requests keep their original fetch options", async () => {
  const fetch = vi.fn(async () => new Response("project"));
  vi.stubGlobal("fetch", fetch);
  const { fetchLibraryResource } = await import("@/wab/client/resource-cache");
  await fetchLibraryResource("/api/v1/projects/current");
  expect(fetch).toHaveBeenCalledWith("/api/v1/projects/current", undefined);
});
