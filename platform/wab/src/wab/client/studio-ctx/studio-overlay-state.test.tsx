import { fakeStudioCtx } from "@/wab/client/__testonly__/fake-init-ctx";
import { initializePlasmicExtension, takeScreenshot } from "@/wab/client/screenshot-util";
import { StudioOverlayState } from "@/wab/client/studio-ctx/studio-overlay-state";
import { ensure } from "@/wab/shared/common";
import { waitFor } from "@testing-library/react";

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it("installs nested overlay commands synchronously and preserves the published identity for a net no-op", () => {
  const owner = new StudioOverlayState();
  const changed = vi.fn(); owner.store.subscribe(changed);
  const before = owner.store.getState();
  owner.deferPublication(() => {
    owner.commentsOverlay = false;
    expect(owner.store.getState().commentsOverlay).toBe(false);
    owner.deferPublication(() => { owner.commentsOverlay = true; });
    expect(changed).not.toHaveBeenCalled();
  });
  expect(owner.store.getState()).toBe(before);
  expect(changed).not.toHaveBeenCalled();
  owner.dispose();
});

it("publishes actual Studio resize changes after completed model inputs while retaining same-value app effects", async () => {
  const { studioCtx: studio } = fakeStudioCtx();
  await waitFor(() => expect(studio.initialRouteReady).toBe(true));
  const arena = await studio.changeUnsafe(() => studio.addArena("Overlay inputs"));
  const name = studio.modelSnapshots.field(arena, "name");
  const read = vi.fn(() => {
    expect(name.getState()).toBe("Completed overlay inputs");
    expect(studio.overlayState.store.getState()).toMatchObject({ resizeDragging: true });
  });
  const stops = [name.subscribe(read), studio.overlayState.store.subscribe(read)];
  try {
    await studio.changeUnsafe(() => {
      studio.isResizeDragging = true;
      arena.name = "Completed overlay inputs";
    });
    expect(read).toHaveBeenCalledTimes(2);
    stops.forEach((stop) => stop());
    const before = studio.overlayState.store.getState();
    const appEffect = vi.mocked(studio.app.setIsDragging); appEffect.mockClear();
    const changed = vi.fn(); const stop = studio.overlayState.store.subscribe(changed);
    try {
      studio.isResizeDragging = true;
      expect(appEffect).toHaveBeenCalledExactlyOnceWith(true);
      expect(studio.overlayState.store.getState()).toBe(before);
      expect(changed).not.toHaveBeenCalled();
    } finally { stop(); }
  } finally { stops.forEach((stop) => stop()); await studio.awaitEval(); studio.dispose(); }
});

it("keeps the actual extension capture callback restore and releases native UI subscribers before a late result", async () => {
  type Response = { data?: string; screenshot?: string; error?: string };
  const callbacks: ((response: Response) => void)[] = [];
  const sendMessage = vi.fn((_extension: string, request: { type: string }, respond: (response: Response) => void) => {
    if (request.type === "plasmic-check-availability") { respond({ data: "plasmic-yes" }); }
    else { callbacks.push(respond); }
  });
  vi.stubGlobal("chrome", { runtime: { sendMessage } });
  initializePlasmicExtension();
  const { studioCtx: studio } = fakeStudioCtx();
  await waitFor(() => expect(studio.initialRouteReady).toBe(true));
  const iframe = document.createElement("iframe"), dom = document.createElement("div");
  vi.spyOn(iframe, "getBoundingClientRect").mockReturnValue(new DOMRect(10, 20, 400, 300));
  vi.spyOn(dom, "getBoundingClientRect").mockReturnValue(new DOMRect(2, 3, 40, 30));
  const ready = vi.fn(async () => undefined);
  const changed = vi.fn(); studio.overlayState.store.subscribe(changed);
  try {
    takeScreenshot(studio, iframe, dom, ready);
    expect(studio.overlayState.store.getState().screenshotting).toBe(true);
    ensure(callbacks.shift(), "First extension capture response")({ screenshot: "image" });
    expect(studio.overlayState.store.getState().screenshotting).toBe(false);
    expect(ready).toHaveBeenLastCalledWith("data:image/png;base64,image");
    takeScreenshot(studio, iframe, dom, ready);
    const terminal = studio.overlayState.store.getState();
    expect(terminal.screenshotting).toBe(true);
    studio.dispose(); changed.mockClear();
    studio.overlayState.store.subscribe(changed);
    ensure(callbacks.shift(), "Late extension capture response")({ error: "capture failed" });
    expect(studio.screenshotting).toBe(false);
    expect(studio.overlayState.store.getState()).toBe(terminal);
    expect(changed).not.toHaveBeenCalled();
    expect(ready).toHaveBeenLastCalledWith(undefined, "capture failed");
  } finally { studio.dispose(); }
});
