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

it.each(["revision", "build"])("displays cache outside the rendering queue and replaces stale %s images", async (change) => {
  cacheMocks.write.mockResolvedValue(undefined);
  const blob = new Blob(["old"]);
  cacheMocks.read.mockResolvedValue({ blob, revision: change === "revision" ? 1 : 2, build: change === "build" ? "old-build" : ENV.COMMITHASH, format: previewFormat });
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

it.each(["matching", "offline"])("retains cached images for %s revision checks", async (mode) => {
  const blob = new Blob(["cached"]);
  cacheMocks.read.mockResolvedValue({ blob, revision: 1, build: ENV.COMMITHASH, format: previewFormat });
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
