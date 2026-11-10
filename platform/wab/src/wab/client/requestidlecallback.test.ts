import { requestIdleCallbackAsync } from "@/wab/client/requestidlecallback";

afterEach(() => vi.unstubAllGlobals());

it("rejects a synchronous task failure so the owning queue can finish", async () => {
  let run: ((deadline: IdleDeadline) => void) | undefined;
  vi.stubGlobal("requestIdleCallback", vi.fn((callback) => { run = callback; return 1; }));
  vi.stubGlobal("cancelIdleCallback", vi.fn());
  const error = new Error("Artboard initialization failed");
  const pending = requestIdleCallbackAsync(() => { throw error; });
  const rejected = expect(pending).rejects.toBe(error);
  expect(() => run?.({ didTimeout: false, timeRemaining: () => 50 })).not.toThrow();
  await rejected;
});

it("rejects an asynchronous task failure and preserves its cause", async () => {
  let run: ((deadline: IdleDeadline) => void) | undefined;
  vi.stubGlobal("requestIdleCallback", vi.fn((callback) => { run = callback; return 2; }));
  vi.stubGlobal("cancelIdleCallback", vi.fn());
  const error = new Error("Component evaluation failed");
  const pending = requestIdleCallbackAsync(async () => { throw error; });
  const rejected = expect(pending).rejects.toBe(error);
  run?.({ didTimeout: false, timeRemaining: () => 50 });
  await rejected;
});

it("waits for the asynchronous task before releasing its owner", async () => {
  let run: ((deadline: IdleDeadline) => void) | undefined;
  vi.stubGlobal("requestIdleCallback", vi.fn((callback) => { run = callback; return 3; }));
  vi.stubGlobal("cancelIdleCallback", vi.fn());
  let finish: () => void = () => undefined;
  const pending = requestIdleCallbackAsync(() => new Promise<void>((resolve) => { finish = resolve; }));
  let settled = false;
  void pending.then(() => { settled = true; });
  run?.({ didTimeout: false, timeRemaining: () => 50 });
  await Promise.resolve();
  expect(settled).toBe(false);
  finish();
  await pending;
  expect(settled).toBe(true);
});
