import {
  waitForCoverMedia,
  waitForCoverTransitions,
} from "@/wab/client/canvas-snapshot/media";

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

it("counts failed and stalled images across artboards without changing their fallback presentation", async () => {
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
    broken.alt = "Image unavailable";
    stalled.style.visibility = "visible";
    const brokenBefore = broken.outerHTML;
    const stalledBefore = stalled.outerHTML;
    const empty = vi.fn(async () => {});
    image(second, "", empty);
    const media = waitForCoverMedia([first, second]);
    await vi.advanceTimersByTimeAsync(5_000);
    expect(await media).toBe(2);
    expect(good.loading).toBe("eager");
    expect(good.style.visibility).toBe("");
    expect(broken.outerHTML).toBe(brokenBefore);
    expect(stalled.outerHTML).toBe(stalledBefore);
    expect(empty).not.toHaveBeenCalled();
  } finally {
    vi.useRealTimers();
  }
});

it("waits for chained transitions across frames and ignores a running keyframe animation", async () => {
  const first = board();
  const second = board();
  const firstEnd = Promise.withResolvers<void>();
  const firstTransition = {
    transitionProperty: "opacity",
    playState: "running",
    finished: firstEnd.promise,
  };
  const nextTransition = {
    transitionProperty: "color",
    playState: "running",
    finished: Promise.resolve(),
  };
  const spinner = { playState: "running", finished: new Promise(() => {}) };
  const firstAnimations = vi
    .fn()
    .mockReturnValueOnce([firstTransition])
    .mockReturnValue([]);
  const secondAnimations = vi
    .fn()
    .mockReturnValueOnce([spinner])
    .mockReturnValueOnce([nextTransition])
    .mockReturnValue([spinner]);
  Object.defineProperty(first, "getAnimations", { value: firstAnimations });
  Object.defineProperty(second, "getAnimations", { value: secondAnimations });
  vi.useFakeTimers();
  try {
    const ready = waitForCoverTransitions([first, second]);
    await vi.advanceTimersByTimeAsync(100);
    expect(firstAnimations).toHaveBeenCalledTimes(1);
    firstEnd.resolve();
    await vi.advanceTimersByTimeAsync(100);
    await ready;
    expect(secondAnimations).toHaveBeenCalledTimes(3);
  } finally {
    vi.useRealTimers();
  }
});
