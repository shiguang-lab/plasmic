import { PreviewWorker } from "@/wab/client/components/live/preview-worker";

afterEach(() => vi.unstubAllGlobals());

it("uses the emitted URL directly when it belongs to the current origin", () => {
  const Worker = vi.fn(function () {});
  vi.stubGlobal("Worker", Worker);
  const url = new URL("/static/js/async/preview-compiler.js", location.href);
  const result = new PreviewWorker(url, { type: "classic" });
  expect(Worker).toHaveBeenCalledWith(url, { type: "classic" });
  result.release();
});

it("starts cross-origin assets in a local blob and releases it", async () => {
  const createObjectURL = vi.fn((_blob: Blob) => "blob:http://localhost/preview");
  const revokeObjectURL = vi.fn();
  vi.stubGlobal("URL", class extends URL {
    static createObjectURL = createObjectURL;
    static revokeObjectURL = revokeObjectURL;
  });
  const Worker = vi.fn(function () {});
  vi.stubGlobal("Worker", Worker);
  const url = new URL("https://studio.example/static/js/async/preview-compiler.hash.js");
  const result = new PreviewWorker(url, { type: "classic" });
  expect(Worker).toHaveBeenCalledWith("blob:http://localhost/preview", { type: "classic" });
  const blob = createObjectURL.mock.calls[0][0] as Blob;
  const text = await new Promise<string>(resolve => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.readAsText(blob);
  });
  expect(text).toBe(`importScripts(${JSON.stringify(url.href)});`);
  expect(revokeObjectURL).not.toHaveBeenCalled();
  result.release();
  expect(revokeObjectURL).toHaveBeenCalledWith("blob:http://localhost/preview");
});

it("releases its blob when construction fails", () => {
  const revokeObjectURL = vi.fn();
  vi.stubGlobal("URL", class extends URL {
    static createObjectURL = () => "blob:http://localhost/preview";
    static revokeObjectURL = revokeObjectURL;
  });
  vi.stubGlobal("Worker", class { constructor() { throw new DOMException("Denied", "SecurityError"); } });
  expect(() => new PreviewWorker(new URL("https://studio.example/compiler.js"), {})).toThrow("Denied");
  expect(revokeObjectURL).toHaveBeenCalledOnce();
});
