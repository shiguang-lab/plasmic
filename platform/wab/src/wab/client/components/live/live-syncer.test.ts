import { waitForLiveHost } from "@/wab/client/components/live/live-syncer";

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
    const pending = expect(waitForLiveHost(win)).rejects.toThrow("Couldn't find the live preview host");
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
