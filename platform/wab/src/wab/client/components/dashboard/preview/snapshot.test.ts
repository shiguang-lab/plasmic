import type { rasterize as Rasterize } from "./snapshot";
let rasterize: typeof Rasterize;
let pixels: (y: number) => number[];
let rejectImage: number | undefined;
let encodeFails: boolean;
let images: { src: string; decode: () => Promise<void> }[];
let contexts: { canvas: HTMLCanvasElement; drawImage: ReturnType<typeof vi.fn>; translate: ReturnType<typeof vi.fn>; scale: ReturnType<typeof vi.fn> }[];
const source = '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="80"><rect width="20" height="20" fill="red"/></svg>';
beforeEach(async () => {
  vi.resetModules(); images = []; contexts = []; rejectImage = undefined; encodeFails = false;
  pixels = (y) => y === 19 ? [255, 0, 0, 255] : [255, 255, 255, 255];
  vi.stubGlobal("Image", class {
    src = "";
    index = images.push(this) - 1;
    async decode() { if (this.index === rejectImage) throw new Error("SVG decoding failed"); }
  });
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(function (this: HTMLCanvasElement) {
    const context = { canvas: this, drawImage: vi.fn(), translate: vi.fn(), scale: vi.fn(), getImageData: (_x: number, y: number) => ({ data: pixels(y) }) };
    contexts.push(context); return context as any;
  });
  vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation(function (this: HTMLCanvasElement, callback) { callback(encodeFails ? null : new Blob(["png"], { type: "image/png" })); });
  ({ rasterize } = await import("./snapshot"));
});
afterEach(() => vi.unstubAllGlobals());
function released() {
  expect(images.every((image) => image.src === "")).toBe(true);
  expect(contexts.every(({ canvas }) => canvas.width === 0 && canvas.height === 0)).toBe(true);
}
it("preserves the normal rasterizer path without allocating an intermediate canvas", async () => {
  expect((await rasterize(source, 100, 80)).type).toBe("image/png");
  expect(contexts).toHaveLength(2);
  expect(contexts[1].scale).not.toHaveBeenCalled();
  expect(contexts[1].drawImage).toHaveBeenCalledExactlyOnceWith(images[1], 0, 0, 100, 80);
  released();
});
it("normalizes reversed graphics contexts and restores orientation from raster pixels", async () => {
  pixels = (y) => y === 5 ? [255, 0, 0, 255] : [255, 255, 255, 255];
  await rasterize(source, 100, 80);
  expect(contexts).toHaveLength(3);
  expect(contexts[1].translate).toHaveBeenCalledExactlyOnceWith(0, 80);
  expect(contexts[1].scale).toHaveBeenCalledExactlyOnceWith(1, -1);
  expect(contexts[2].translate).toHaveBeenCalledExactlyOnceWith(0, 80);
  expect(contexts[2].scale).toHaveBeenCalledExactlyOnceWith(1, -1);
  expect(contexts[2].drawImage).toHaveBeenCalledExactlyOnceWith(contexts[1].canvas, 0, 0);
  released();
});
it("rejects an inconclusive rasterizer probe instead of guessing a passing direction", async () => {
  pixels = () => [255, 255, 255, 255];
  await expect(rasterize(source, 100, 80)).rejects.toThrow("Could not determine snapshot shadow direction");
  released();
});
it.each([0, 1])("propagates decoding errors and releases probe/output resources: image %s", async (index) => {
  rejectImage = index;
  await expect(rasterize(source, 100, 80)).rejects.toThrow("SVG decoding failed");
  released();
});
it("probes once per renderer without retaining its image or canvas", async () => {
  await rasterize(source, 100, 80); await rasterize(source, 100, 80);
  expect(images).toHaveLength(3);
  expect(contexts).toHaveLength(3);
  released();
});
it("releases both output canvases when PNG encoding fails", async () => {
  pixels = (y) => y === 5 ? [255, 0, 0, 255] : [255, 255, 255, 255]; encodeFails = true;
  await expect(rasterize(source, 100, 80)).rejects.toThrow("PNG encoding failed");
  expect(contexts).toHaveLength(3); released();
});

it("encodes text pixels only after a decoded foreignObject has completed painting", async () => {
  let painted = false;
  let encoded = "";
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    queueMicrotask(() => { callback(0); queueMicrotask(() => { painted = true; }); });
    return 1;
  });
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(function (this: HTMLCanvasElement) {
    return { drawImage: () => { encoded = painted ? "gradient-title-pixels" : "missing-title"; }, getImageData: (_x: number, y: number) => ({ data: pixels(y) }) } as any;
  });
  vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation((_callback) => {
    _callback(new Blob([encoded], {type: "image/png"}));
  });
  const output = await rasterize(source, 100, 80);
  expect(output.size, "PNG must contain the completed text raster").toBe(new Blob(["gradient-title-pixels"]).size);
});
