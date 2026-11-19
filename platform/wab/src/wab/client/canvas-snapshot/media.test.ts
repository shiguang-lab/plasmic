import { waitForCoverMedia } from "@/wab/client/canvas-snapshot/media";

function board() {
  const doc = document.implementation.createHTMLDocument();
  Object.defineProperty(doc, "fonts", { value: { ready: Promise.resolve() } });
  return doc;
}

function image(doc: Document, src: string, decode: () => Promise<void>) {
  const img = doc.createElement("img");
  if (src) {
    img.src = src;
  }
  img.decode = decode;
  doc.body.append(img);
  return img;
}

it("keeps decoded images and hides failed and stalled images within one deadline across artboards", async () => {
  vi.useFakeTimers();
  try {
    const first = board();
    const second = board();
    const good = image(first, "/good", async () => {});
    good.loading = "lazy";
    const broken = image(first, "/broken", async () => {
      throw new Error("decode failed");
    });
    const stalled = image(second, "/slow", () => new Promise<void>(() => {}));
    const empty = vi.fn(async () => {});
    image(second, "", empty);
    const media = waitForCoverMedia([first, second]);
    await vi.advanceTimersByTimeAsync(5_000);
    expect(await media).toBe(2);
    expect(good.loading).toBe("eager");
    expect(good.style.visibility).toBe("");
    expect(broken.style.visibility).toBe("hidden");
    expect(stalled.style.visibility).toBe("hidden");
    expect(empty).not.toHaveBeenCalled();
  } finally {
    vi.useRealTimers();
  }
});
