vi.mock("@/wab/client/env", () => ({ ENV: { COMMITHASH: "cache-test" } }));
beforeEach(() => {
  vi.resetModules();
  vi.stubGlobal("BroadcastChannel", class { postMessage() { return undefined; } });
});
afterEach(() => vi.unstubAllGlobals());
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
