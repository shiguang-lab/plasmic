import { PreviewQueue } from "@/wab/client/components/dashboard/preview/queue";

function deferred<T>() {
  let resolve: (value: T) => void = () => {
    throw new Error("Deferred not initialized");
  };
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}
afterEach(() => vi.useRealTimers());

it("shares duplicate jobs and limits concurrent generation to one", async () => {
  vi.useFakeTimers();
  const queue = new PreviewQueue(),
    first = deferred<Blob>(),
    second = deferred<Blob>();
  const run1 = vi.fn(() => first.promise),
    run2 = vi.fn(() => second.promise);
  const a = vi.fn(),
    b = vi.fn();
  queue.subscribe("first", run1, a);
  queue.subscribe("first", run1, b);
  queue.subscribe("second", run2, vi.fn());
  expect(run1).toHaveBeenCalledTimes(1);
  expect(run2).not.toHaveBeenCalled();
  const image = new Blob(["png"]);
  first.resolve(image);
  await vi.advanceTimersByTimeAsync(200);
  expect(a).toHaveBeenCalledWith(image);
  expect(b).toHaveBeenCalledWith(image);
  expect(run2).toHaveBeenCalledTimes(1);
  second.resolve(image);
  await vi.runAllTimersAsync();
});

it("cancels queued work and waits for active teardown before replacing a job", async () => {
  vi.useFakeTimers();
  const queue = new PreviewQueue(),
    stopped = deferred<Blob>();
  let signal: AbortSignal | undefined;
  const listener = vi.fn(),
    next = vi.fn(async () => new Blob());
  const unsubscribe = queue.subscribe(
    "a",
    async (s) => {
      signal = s;
      return stopped.promise;
    },
    listener,
  );
  const cancel = queue.subscribe("b", next, vi.fn());
  cancel();
  unsubscribe();
  expect(signal?.aborted).toBe(true);
  queue.subscribe("a", next, vi.fn());
  expect(next).not.toHaveBeenCalled();
  stopped.resolve(new Blob());
  await vi.runAllTimersAsync();
  expect(listener).not.toHaveBeenCalled();
  expect(next).toHaveBeenCalledTimes(1);
});

it("reports a start only when a job leaves the queue, including to late subscribers", async () => {
  vi.useFakeTimers();
  const queue = new PreviewQueue(),
    first = deferred<Blob>();
  const firstStart = vi.fn(),
    lateStart = vi.fn(),
    secondStart = vi.fn();
  queue.subscribe("first", () => first.promise, vi.fn(), firstStart);
  queue.subscribe("second", async () => new Blob(), vi.fn(), secondStart);
  expect(firstStart).toHaveBeenCalledTimes(1);
  expect(secondStart).not.toHaveBeenCalled();
  queue.subscribe("first", () => first.promise, vi.fn(), lateStart);
  expect(lateStart).toHaveBeenCalledTimes(1);
  first.resolve(new Blob());
  await vi.runAllTimersAsync();
  expect(secondStart).toHaveBeenCalledTimes(1);
  expect(firstStart).toHaveBeenCalledTimes(1);
});

it("continues after an error", async () => {
  vi.useFakeTimers();
  const queue = new PreviewQueue(),
    failure = vi.fn(),
    next = vi.fn();
  queue.subscribe(
    "bad",
    async () => {
      throw new Error("bad");
    },
    failure,
  );
  queue.subscribe("good", async () => new Blob(), next);
  await vi.runAllTimersAsync();
  expect(failure).toHaveBeenCalledWith(undefined);
  expect(next).toHaveBeenCalledTimes(1);
});
