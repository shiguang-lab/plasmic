import { ready } from "./renderer";
const realDocument = document;
let owner: HTMLStyleElement;
let imported: { type: number; href: string; media: { mediaText: string }; styleSheet: any };
let mutations: MutationCallback;
let disconnected = vi.fn();
let fonts = vi.fn(() => Promise.resolve());
let decode = vi.fn(async () => {});
beforeEach(() => {
  owner = realDocument.createElement("style"); owner.textContent = '@import url("/delayed.css");';
  imported = { type: CSSRule.IMPORT_RULE, href: "/delayed.css", media: { mediaText: "" }, styleSheet: null };
  fonts = vi.fn(() => Promise.resolve()); decode = vi.fn(async () => {});
  vi.stubGlobal("requestAnimationFrame", (callback: () => void) => Promise.resolve().then(callback));
  Object.defineProperty(owner, "sheet", { configurable: true, value: { cssRules: [imported] } });
  vi.stubGlobal("MutationObserver", class {
    constructor(callback: MutationCallback) { mutations = callback; }
    observe() {} disconnect() { disconnected(); }
  });
  vi.stubGlobal("document", { documentElement: realDocument.documentElement, get fonts() { return { ready: fonts() }; }, images: [{ decode }] });
});
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });
function inserted() { mutations([{ target: realDocument.head, addedNodes: [owner] }] as any, {} as any); }
it("waits for imported styles before checking fonts or decoding images", async () => {
  const pending = ready(); inserted();
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(fonts).not.toHaveBeenCalled(); expect(decode).not.toHaveBeenCalled();
  imported.styleSheet = { cssRules: [] }; owner.dispatchEvent(new Event("load"));
  await pending;
  expect(fonts).toHaveBeenCalledOnce(); expect(decode).toHaveBeenCalledOnce();
});
it("propagates stylesheet errors instead of accepting fallback typography", async () => {
  const pending = ready(); inserted(); const rejected = expect(pending).rejects.toThrow("stylesheet failed");
  await new Promise((resolve) => setTimeout(resolve, 0));
  owner.dispatchEvent(new Event("error")); await rejected;
  expect(fonts).not.toHaveBeenCalled();
});
it("waits for nested imports even when their parent stylesheet exists", async () => {
  const nested = { ...imported }; imported.styleSheet = { cssRules: [nested] };
  const pending = ready(); inserted();
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(fonts).not.toHaveBeenCalled();
  nested.styleSheet = { cssRules: [] }; owner.dispatchEvent(new Event("load")); await pending;
  expect(fonts).toHaveBeenCalledOnce();
});
it("times out and removes stylesheet listeners when a resource never completes", async () => {
  vi.useFakeTimers(); const remove = vi.spyOn(owner, "removeEventListener");
  const pending = ready(); inserted(); const rejected = expect(pending).rejects.toThrow("stylesheet timed out");
  await vi.advanceTimersByTimeAsync(32); // Two animation frames precede stylesheet readiness.
  expect(vi.getTimerCount()).toBe(1);
  await vi.advanceTimersByTimeAsync(30000); await rejected;
  expect(remove.mock.calls.map(([event]) => event).sort()).toEqual(["error", "load"]);
  expect(fonts).not.toHaveBeenCalled();
});

it("does not wait for imports whose media query is inactive", async () => {
  imported.media.mediaText = "print";
  vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: false })));
  const pending = ready(); inserted(); await pending; expect(fonts).toHaveBeenCalledOnce();
  expect(matchMedia).toHaveBeenCalledExactlyOnceWith("print");
});

it("waits for the load event when the browser creates an import stylesheet early", async () => {
  imported.styleSheet = { cssRules: [] };
  const pending = ready(); inserted();
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(fonts).not.toHaveBeenCalled();
  owner.dispatchEvent(new Event("load")); await pending;
  expect(fonts).toHaveBeenCalledOnce();
});

it("waits when the browser has not created the owner stylesheet yet", async () => {
  Object.defineProperty(owner, "sheet", { value: null });
  const pending = ready(); inserted();
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(fonts).not.toHaveBeenCalled();
  owner.dispatchEvent(new Event("load")); await pending;
  expect(fonts).toHaveBeenCalledOnce();
});
