import {
  swallowAnchorClicks,
  waitForLiveHost,
} from "@/wab/client/components/live/live-syncer";

describe("late preview host readiness", () => {
  let host: HTMLIFrameElement;
  let win: Window;
  beforeEach(() => {
    vi.useFakeTimers();
    host = document.createElement("iframe");
    document.body.append(host);
    win = host.contentWindow as Window;
  });
  afterEach(() => {
    host.remove();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });
  function body() {
    const node = win.document.createElement("div");
    node.className = "__wab_user-body";
    win.document.body.append(node);
  }
  it("requires both the host runtime and its user body", async () => {
    (win as any).__Sub = {};
    const disconnected = vi.spyOn(MutationObserver.prototype, "disconnect");
    const ready = vi.fn();
    const pending = waitForLiveHost(win).then(ready);
    await vi.advanceTimersByTimeAsync(500);
    expect(ready).not.toHaveBeenCalled();
    body();
    await pending;
    expect(ready).toHaveBeenCalledTimes(1);
    expect(disconnected).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });
  it("detects a runtime assigned after load without a DOM mutation", async () => {
    body();
    const ready = vi.fn();
    const pending = waitForLiveHost(win).then(ready);
    await vi.advanceTimersByTimeAsync(500);
    expect(ready).not.toHaveBeenCalled();
    (win as any).__Sub = {};
    await vi.advanceTimersByTimeAsync(500);
    await pending;
    expect(ready).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });
  it("rejects a missing host and releases its observer and timers", async () => {
    const disconnected = vi.spyOn(MutationObserver.prototype, "disconnect");
    const pending = expect(waitForLiveHost(win)).rejects.toThrow(
      "Couldn't find the live preview host",
    );
    await vi.advanceTimersByTimeAsync(180000);
    await pending;
    expect(disconnected).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });
  it("does not allocate polling when the host is already ready", async () => {
    body();
    (win as any).__Sub = {};
    const observed = vi.spyOn(MutationObserver.prototype, "observe");
    await waitForLiveHost(win);
    expect(observed).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe("live preview links", () => {
  let host: HTMLIFrameElement;
  beforeEach(() => {
    host = document.createElement("iframe");
    document.body.append(host);
  });
  afterEach(() => host.remove());
  function click(
    href: string,
    options: MouseEventInit = {},
    attributes: Record<string, string> = {},
    eventType = "click",
  ) {
    const doc = host.contentDocument as Document;
    const anchor = doc.createElement("a");
    anchor.href = href;
    for (const [key, value] of Object.entries(attributes)) {
      anchor.setAttribute(key, value);
    }
    doc.body.append(anchor);
    const navigate = vi.fn();
    swallowAnchorClicks(doc, navigate, (value) =>
      value.startsWith("https://external.example")
        ? undefined
        : `https://studio.example/d/0123456789#${value}`,
    );
    const event = new MouseEvent(eventType, {
      bubbles: true,
      cancelable: true,
      ...options,
    });
    anchor.dispatchEvent(event);
    return { anchor, event, navigate };
  }
  it("routes business links from the iframe through the shared preview history", () => {
    const { navigate, event } = click("/coupons/42?tab=rules#info");
    expect(navigate).toHaveBeenCalledWith("/coupons/42?tab=rules#info");
    expect(event.defaultPrevented).toBe(true);
  });
  it.each([{ ctrlKey: true }, { metaKey: true }])(
    "encodes modified clicks without consuming their native behavior",
    (options) => {
      const { anchor, navigate, event } = click("/coupons/42", options);
      expect(anchor.href).toBe(
        "https://studio.example/d/0123456789#/coupons/42",
      );
      expect(navigate).not.toHaveBeenCalled();
      expect(event.defaultPrevented).toBe(false);
    },
  );
  it("encodes new-tab links and preserves external links and downloads", () => {
    expect(
      click("/coupons/42", {}, { target: "_blank" }).anchor.href,
    ).toContain("/d/0123456789#/coupons/42");
  });
  it("leaves external links to the browser", () => {
    const { event, navigate } = click("https://external.example/");
    expect(event.defaultPrevented).toBe(false);
    expect(navigate).not.toHaveBeenCalled();
  });
  it("does not turn downloads into business navigation", () => {
    const { event, navigate, anchor } = click(
      "/assets/report.csv",
      {},
      { download: "report.csv" },
    );
    expect(event.defaultPrevented).toBe(false);
    expect(navigate).not.toHaveBeenCalled();
    expect(anchor.getAttribute("href")).toBe("/assets/report.csv");
  });
  it("restores a relative href after the browser consumes a modified click", async () => {
    const { anchor } = click("?tab=rules", { ctrlKey: true });
    expect(anchor.href).toContain("/d/0123456789#?tab=rules");
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(anchor.getAttribute("href")).toBe("?tab=rules");
  });
  it("provides a preview URL to the native context menu and retains the source for subsequent navigation", async () => {
    const { anchor, event, navigate } = click("#rules", {}, {}, "contextmenu");
    expect(event.defaultPrevented).toBe(false);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(anchor.href).toBe("https://studio.example/d/0123456789##rules");
    anchor.dispatchEvent(
      new MouseEvent("click", { bubbles: true, cancelable: true }),
    );
    expect(navigate).toHaveBeenCalledExactlyOnceWith("#rules");
  });
});
