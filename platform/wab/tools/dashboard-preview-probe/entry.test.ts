import "fake-indexeddb/auto";
import { Blob as NodeBlob } from "node:buffer";
import { compose } from "./snapshot";
vi.mock("./snapshot", () => ({ compose: vi.fn() }));

it("coordinates distinct artboards of one component by UUID, then releases the renderer", async () => {
  vi.stubGlobal("Blob", NodeBlob);
  history.replaceState({}, "", "/?count=0");
  const pages = ["board-one", "board-two"].map((uuid) => ({ uuid, componentId: "shared-component", width: 100, height: 80, left: 0, top: 0, name: uuid }));
  const engine = { load: vi.fn(async () => ({ pages })), render: vi.fn(), capture: vi.fn(async () => ({ blob: new Blob(["png"]) })), clear: vi.fn() };
  vi.stubGlobal("fetch", vi.fn(async (url: string) => ({ json: async () => url.includes("manifest") ? [{ id: "project", revision: 164 }] : { config: {} }, text: async () => "<html></html>" })));
  vi.stubGlobal("structuredClone", (value: any) => JSON.parse(JSON.stringify(value)));
  vi.stubGlobal("URL", class extends URL { static createObjectURL = vi.fn(() => "blob:preview"); static revokeObjectURL = vi.fn(); });
  const decode = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, "decode");
  Object.defineProperty(HTMLImageElement.prototype, "decode", { configurable: true, value: vi.fn(async () => {}) });
  const append = document.body.append.bind(document.body);
  vi.spyOn(document.body, "append").mockImplementation((...elements) => {
    append(...elements);
    for (const element of elements) if (element instanceof HTMLIFrameElement) {
      (element.contentWindow as any).coverEngine = engine;
      queueMicrotask(() => element.dispatchEvent(new Event("load")));
    }
  });
  vi.mocked(compose).mockResolvedValue({ blob: new Blob(["png"]), bounds: {}, positions: [] } as any);
  try {
    await import("./entry");
    await vi.waitFor(() => expect(window.coverProbe).toBeDefined());
    await window.coverProbe.purge();
    await window.coverProbe.mount(1);
    expect(engine.load).toHaveBeenCalledExactlyOnceWith("project", 164, expect.any(Object));
    expect(engine.render.mock.calls).toEqual([["board-one"], ["board-two"]]);
    expect(engine.capture.mock.calls).toEqual([[100, 80], [100, 80]]);
    expect(engine.clear).toHaveBeenCalledOnce();
    expect(document.querySelector("#engine")).toBeNull();
  } finally {
    window.coverProbe?.clear();
    if (decode) Object.defineProperty(HTMLImageElement.prototype, "decode", decode);
    else delete (HTMLImageElement.prototype as any).decode;
    vi.unstubAllGlobals();
  }
});
