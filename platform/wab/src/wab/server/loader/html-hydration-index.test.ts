const mocks = vi.hoisted(() => ({ constructor: vi.fn(), hydrateAll: vi.fn() }));
vi.mock("../../../../../loader-html-hydrate/src/hydrater", () => ({ PlasmicHtmlHydrater: mocks.constructor }));
beforeEach(() => {
  vi.resetModules(); vi.clearAllMocks();
  mocks.constructor.mockImplementation(function () { return { hydrateAll: mocks.hydrateAll }; });
});
afterEach(() => vi.unstubAllGlobals());
it.each(["", "/codegen"])("derives the published service base from cached HTML script path: %s", async (prefix) => {
  vi.stubGlobal("window", {});
  vi.stubGlobal("document", { currentScript: { src: `https://published.example.test${prefix}/static/js/loader-hydrate.1234abcd.js` }, readyState: "complete" });
  (window as any).document = document;
  await import("../../../../../loader-html-hydrate/src/index");
  expect(mocks.constructor).toHaveBeenCalledExactlyOnceWith(`https://published.example.test${prefix}`);
  expect(mocks.hydrateAll).toHaveBeenCalledOnce();
});
it("waits for the loading document before hydrating all published roots", async () => {
  const addEventListener = vi.fn();
  vi.stubGlobal("window", { addEventListener });
  vi.stubGlobal("document", { currentScript: null, readyState: "loading" });
  (window as any).document = document;
  await import("../../../../../loader-html-hydrate/src/index");
  expect(mocks.hydrateAll).not.toHaveBeenCalled();
  expect(addEventListener).toHaveBeenCalledOnce();
  expect(addEventListener.mock.calls[0][0]).toBe("load");
  addEventListener.mock.calls[0][1]();
  expect(mocks.hydrateAll).toHaveBeenCalledOnce();
});
it("reuses an existing hydrater instead of replacing mounted roots on repeated script loads", async () => {
  const hydrateAll = vi.fn();
  const hydrater = { hydrateAll };
  vi.stubGlobal("window", { __plasmicHydrater: hydrater });
  vi.stubGlobal("document", { currentScript: { src: "https://published.example.test/static/js/loader-hydrate.js" }, readyState: "complete" });
  (window as any).document = document;
  await import("../../../../../loader-html-hydrate/src/index");
  expect(mocks.constructor).not.toHaveBeenCalled();
  expect(hydrateAll).toHaveBeenCalledOnce();
  expect((window as any).__plasmicHydrater).toBe(hydrater);
});
