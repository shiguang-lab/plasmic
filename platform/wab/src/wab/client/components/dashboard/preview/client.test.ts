import { renderPreview } from "@/wab/client/components/dashboard/preview/client";
import { previewChannel } from "@/wab/client/components/dashboard/preview/types";
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
