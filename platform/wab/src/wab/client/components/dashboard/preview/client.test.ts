import { renderPreview, subscribePreview } from "@/wab/client/components/dashboard/preview/client";
import { ENV } from "@/wab/client/env";
import { previewChannel, previewFormat } from "@/wab/client/components/dashboard/preview/types";
import { DEVFLAGS } from "@/wab/shared/devflags";

const request = {
  projectId: "project",
  revision: 1,
  flags: DEVFLAGS,
  staticBaseUrl: "http://localhost/static",
};
afterEach(() => {
  document.body.replaceChildren();
  vi.useRealTimers();
});

it("removes the renderer on completion and transfers only PNG bytes", async () => {
  const controller = new AbortController();
  const result = renderPreview(request, controller.signal);
  const frame = document.querySelector("iframe") as HTMLIFrameElement;
  window.dispatchEvent(
    new MessageEvent("message", {
      source: frame.contentWindow,
      origin: location.origin,
      data: {
        channel: previewChannel,
        type: "result",
        bytes: new ArrayBuffer(4),
      },
    }),
  );
  expect((await result).size).toBe(4);
  expect(document.querySelector("iframe")).toBeNull();
  expect(frame.src).toBe("about:blank");
  controller.abort();
});

it("cancels immediately and ignores messages from another window", async () => {
  const controller = new AbortController();
  const result = renderPreview(request, controller.signal);
  window.dispatchEvent(
    new MessageEvent("message", {
      source: window,
      origin: location.origin,
      data: {
        channel: previewChannel,
        type: "result",
        bytes: new ArrayBuffer(4),
      },
    }),
  );
  expect(document.querySelector("iframe")).not.toBeNull();
  controller.abort();
  await expect(result).rejects.toThrow();
  expect(document.querySelector("iframe")).toBeNull();
});

it("cleans up after failure and a timeout", async () => {
  vi.useFakeTimers();
  const failed = renderPreview(request, new AbortController().signal);
  const frame = document.querySelector("iframe") as HTMLIFrameElement;
  window.dispatchEvent(
    new MessageEvent("message", {
      source: frame.contentWindow,
      origin: location.origin,
      data: {
        channel: previewChannel,
        type: "error",
        message: "Render failed",
      },
    }),
  );
  await expect(failed).rejects.toThrow("Render failed");
  expect(document.querySelector("iframe")).toBeNull();
  const timedOut = renderPreview(request, new AbortController().signal);
  const assertion = expect(timedOut).rejects.toThrow("timed out");
  await vi.advanceTimersByTimeAsync(90_000);
  await assertion;
  expect(document.querySelector("iframe")).toBeNull();
});

const cacheMocks = vi.hoisted(() => ({ read: vi.fn(), write: vi.fn() }));
vi.mock("@/wab/client/components/dashboard/preview/cache", () => ({
  readPreview: cacheMocks.read,
  writePreview: cacheMocks.write,
}));

it.each(["revision", "format"])("displays cache outside the rendering queue and replaces stale %s images", async (change) => {
  cacheMocks.write.mockResolvedValue(undefined);
  const blob = new Blob(["old"]);
  cacheMocks.read.mockResolvedValue({ blob, revision: change === "revision" ? 1 : 2, build: ENV.COMMITHASH, format: change === "format" ? "old-format" : previewFormat });
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ rev: { revision: 2 } }))));
  const listener = vi.fn();
  const cancel = subscribePreview("user", "stale", listener);
  await vi.waitFor(() => expect(document.querySelector("iframe")).not.toBeNull());
  const otherListener = vi.fn();
  const cancelOther = subscribePreview("user", "other", otherListener);
  await vi.waitFor(() => expect(otherListener).toHaveBeenCalledWith(blob));
  expect(listener).toHaveBeenCalledWith(blob);
  const frame = document.querySelector("iframe") as HTMLIFrameElement;
  window.dispatchEvent(new MessageEvent("message", {
    source: frame.contentWindow, origin: location.origin,
    data: { channel: previewChannel, type: "result", bytes: new ArrayBuffer(4) },
  }));
  await vi.waitFor(() => expect(listener).toHaveBeenCalledTimes(2));
  expect(listener.mock.calls[1][0].size).toBe(4);
  expect(cacheMocks.write).toHaveBeenCalledWith("user:stale", 2, expect.any(Blob));
  cancel();
  cancelOther();
  vi.unstubAllGlobals();
});

it.each(["matching", "offline", "older-build"])("retains cached images for %s revision checks", async (mode) => {
  const blob = new Blob(["cached"]);
  // Images from an earlier app build stay valid while revision and format match.
  cacheMocks.read.mockResolvedValue({ blob, revision: 1, build: mode === "older-build" ? "old-build" : ENV.COMMITHASH, format: previewFormat });
  vi.stubGlobal("fetch", vi.fn(async () => {
    if (mode === "offline") { throw new Error("offline"); }
    return new Response(JSON.stringify({ rev: { revision: 1 } }));
  }));
  const listener = vi.fn();
  const cancel = subscribePreview("user", mode, listener);
  await vi.waitFor(() => expect(fetch).toHaveBeenCalled());
  expect(listener.mock.calls).toEqual([[blob]]);
  expect(document.querySelector("iframe")).toBeNull();
  cancel();
  vi.unstubAllGlobals();
});

it.each(["matching", "offline"])("finishes once after a cached %s revision check, including later cancellation", async (mode) => {
  const blob = new Blob(["cached"]);
  cacheMocks.read.mockResolvedValue({ blob, revision: 1, format: previewFormat });
  vi.stubGlobal("fetch", vi.fn(async () => {
    if (mode === "offline") { throw new Error("offline"); }
    return new Response(JSON.stringify({ rev: { revision: 1 } }));
  }));
  const finish = vi.fn();
  const cancel = subscribePreview("user", mode, vi.fn(), undefined, finish);
  await vi.waitFor(() => expect(finish).toHaveBeenCalledOnce());
  cancel();
  expect(finish).toHaveBeenCalledOnce();
  vi.unstubAllGlobals();
});

it("finishes generated work only after the PNG cache write completes", async () => {
  cacheMocks.read.mockResolvedValue(undefined);
  const writing = Promise.withResolvers<void>();
  cacheMocks.write.mockReturnValueOnce(writing.promise);
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ rev: { revision: 1 } }))));
  vi.stubGlobal("desktopPreview", { render: vi.fn(async () => new Uint8Array(4)), cancel: vi.fn() });
  const finish = vi.fn();
  const cancel = subscribePreview("user", "pending-write", vi.fn(), undefined, finish);
  await vi.waitFor(() => expect(cacheMocks.write).toHaveBeenCalledWith("user:pending-write", 1, expect.any(Blob)));
  expect(finish).not.toHaveBeenCalled();
  writing.resolve();
  await vi.waitFor(() => expect(finish).toHaveBeenCalledOnce());
  cancel();
  expect(finish).toHaveBeenCalledOnce();
  vi.unstubAllGlobals();
});

it("finishes a failed refresh without replacing a cached image", async () => {
  const blob = new Blob(["cached"]);
  cacheMocks.read.mockResolvedValue({ blob, revision: 0, format: previewFormat });
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ rev: { revision: 1 } }))));
  vi.stubGlobal("desktopPreview", { render: vi.fn(async () => { throw new Error("render failed"); }), cancel: vi.fn() });
  const finish = vi.fn(), listener = vi.fn();
  const cancel = subscribePreview("user", "failed-refresh", listener, undefined, finish);
  await vi.waitFor(() => expect(finish).toHaveBeenCalledOnce());
  expect(listener.mock.calls).toEqual([[blob]]);
  cancel();
  expect(finish).toHaveBeenCalledOnce();
  vi.unstubAllGlobals();
});

it("finishes cancellation before cache validation and never starts late work", async () => {
  const reading = Promise.withResolvers<undefined>();
  cacheMocks.read.mockReturnValueOnce(reading.promise);
  const listener = vi.fn(), start = vi.fn(), finish = vi.fn();
  const cancel = subscribePreview("user", "cancelled", listener, start, finish);
  cancel();
  expect(finish).toHaveBeenCalledOnce();
  reading.resolve(undefined);
  await Promise.resolve(); await Promise.resolve();
  expect(listener).not.toHaveBeenCalled();
  expect(start).not.toHaveBeenCalled();
  expect(finish).toHaveBeenCalledOnce();
});
