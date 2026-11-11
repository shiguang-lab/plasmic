import {
  activityTargets,
  CopilotActivity,
  currentActivity,
} from "@/wab/client/copilot/activity";
import { afterEach, expect, it, vi } from "vitest";

afterEach(() => vi.useRealTimers());

it("cancels only the owning activity and ignores its late completion", () => {
  const activity = new CopilotActivity();
  const cancelled = new AbortController();
  const target = { componentUuid: "page" };
  const finish = activity.begin([target], "edit", undefined, cancelled.signal);
  const other = activity.begin([target]);
  cancelled.abort();
  expect(activity.store.getState().requests).toHaveLength(1);
  expect(activity.store.getState().requests[0].id).toBe(2);
  finish("success");
  expect(activity.store.getState().requests).toHaveLength(1);
  expect(() =>
    activity.begin([target], "edit", undefined, cancelled.signal),
  ).toThrow();
  other("error");
  expect(activity.store.getState().requests).toHaveLength(0);
  activity.dispose();
});

it.each(["inspection", "edit"] as const)(
  "retains the %s scan kind throughout completion",
  (kind) => {
    vi.useFakeTimers();
    const activity = new CopilotActivity();
    const finish = activity.begin([{ componentUuid: "page" }], kind);
    expect(activity.store.getState().requests[0]).toMatchObject({
      kind,
      status: "running",
    });
    finish("success");
    expect(activity.store.getState().requests[0]).toMatchObject({
      kind,
      status: "success",
      scanning: true,
    });
    vi.advanceTimersByTime(2000);
    expect(activity.store.getState().requests).toHaveLength(0);
  },
);

it("shares one counted region for overlapping requests on the same node", () => {
  vi.useFakeTimers();
  const activity = new CopilotActivity();
  const target = {
    componentUuid: "page",
    elementUuid: "table",
  };
  const first = activity.begin([target]);
  const second = activity.begin([target]);
  expect(activity.store.getState().regions).toHaveLength(1);
  expect(activity.store.getState().regions[0]).toMatchObject({
    count: 2,
    request: { status: "running" },
  });
  const key = activity.store.getState().regions[0].key;
  second("success");
  expect(activity.store.getState().regions[0]).toMatchObject({
    count: 2,
    request: { status: "running" },
  });
  expect(currentActivity(activity.store.getState().requests)?.status).toBe(
    "running",
  );
  vi.advanceTimersByTime(2000);
  expect(activity.store.getState().regions[0]).toMatchObject({
    key,
    count: 1,
    request: { status: "running" },
  });
  first("success");
  vi.advanceTimersByTime(399);
  expect(activity.store.getState().regions).toHaveLength(1);
  vi.advanceTimersByTime(1);
  expect(activity.store.getState().regions).toHaveLength(0);
});

it("counts duplicate batch targets once and keeps separate nodes independent", () => {
  const activity = new CopilotActivity();
  const table = { componentUuid: "page", elementUuid: "table" };
  activity.begin([table, table, { ...table, elementUuid: "form" }]);
  expect(
    activity.store
      .getState()
      .regions.map((r) => [r.target.elementUuid, r.count]),
  ).toEqual([
    ["table", 1],
    ["form", 1],
  ]);
  activity.begin([{ ...table, componentUuid: "other-page" }]);
  expect(activity.store.getState().regions).toHaveLength(3);
  activity.dispose();
  expect(activity.store.getState().regions).toHaveLength(0);
});

it("does not let stale cleanup remove a new reference or double completion release twice", () => {
  vi.useFakeTimers();
  const activity = new CopilotActivity();
  const target = { componentUuid: "page" };
  const first = activity.begin([target]);
  first("success");
  first("error");
  expect(vi.getTimerCount()).toBe(2); // Scan completion and cursor expiry.
  expect(activity.store.getState().requests[0].status).toBe("success");
  vi.advanceTimersByTime(1500);
  const second = activity.begin([target]);
  vi.advanceTimersByTime(500);
  expect(activity.store.getState().regions[0]).toMatchObject({
    count: 1,
    request: { status: "running" },
  });
  second("success");
  activity.dispose();
  expect(activity.store.getState().regions).toHaveLength(0);
  expect(vi.getTimerCount()).toBe(0);
});

it("keeps fast calls visible without delaying completion, and expires each request separately", () => {
  vi.useFakeTimers();
  const activity = new CopilotActivity();
  const finishFirst = activity.begin([
    { componentUuid: "page" },
  ]);
  finishFirst("success");
  vi.advanceTimersByTime(600);
  const finishSecond = activity.begin([
    { componentUuid: "page", elementUuid: "table" },
  ]);
  expect(activity.store.getState().requests.map((r) => r.status)).toEqual([
    "success",
    "running",
  ]);
  vi.advanceTimersByTime(1400);
  expect(activity.store.getState().requests).toHaveLength(1);
  finishSecond("error");
  expect(activity.store.getState().requests).toHaveLength(0);
  vi.advanceTimersByTime(600);
  expect(activity.store.getState().requests).toHaveLength(0);
});

it("keeps long operations active and cancels pending cleanup when Studio closes", () => {
  vi.useFakeTimers();
  const activity = new CopilotActivity();
  const finish = activity.begin([{}]);
  vi.advanceTimersByTime(10000);
  expect(activity.store.getState().requests[0].status).toBe("running");
  finish("success");
  expect(activity.store.getState().requests[0]).toMatchObject({
    status: "success",
    scanning: false,
  });
  vi.advanceTimersByTime(399);
  expect(activity.store.getState().requests).toHaveLength(1);
  activity.dispose();
  finish("error");
  expect(activity.store.getState().requests).toHaveLength(0);
  expect(vi.getTimerCount()).toBe(0);
});

it("keeps successful edit scans moving for at least 1.6 seconds", () => {
  vi.useFakeTimers();
  const activity = new CopilotActivity();
  const finish = activity.begin([{ componentUuid: "page" }]);
  vi.advanceTimersByTime(20);
  finish("success");
  expect(activity.store.getState().requests[0]).toMatchObject({
    status: "success",
    scanning: true,
  });
  vi.advanceTimersByTime(1579);
  expect(activity.store.getState().requests[0].scanning).toBe(true);
  vi.advanceTimersByTime(1);
  expect(activity.store.getState().requests[0]).toMatchObject({
    status: "success",
    scanning: false,
  });
  vi.advanceTimersByTime(399);
  expect(activity.store.getState().requests).toHaveLength(1);
  vi.advanceTimersByTime(1);
  expect(activity.store.getState().requests).toHaveLength(0);
  expect(activity.cursorStore.getState().current?.status).toBe("success");
  vi.advanceTimersByTime(4500);
  expect(activity.cursorStore.getState().current).toBeUndefined();
  expect(vi.getTimerCount()).toBe(0);
});

it("removes failed edits immediately without affecting other edits or retaining timers", () => {
  vi.useFakeTimers();
  const activity = new CopilotActivity();
  const target = { componentUuid: "page" };
  const first = activity.begin([target]);
  const second = activity.begin([target]);
  vi.advanceTimersByTime(20);
  first("error");
  first("success");
  expect(activity.store.getState().regions[0]).toMatchObject({
    count: 1,
    request: { status: "running" },
    scanning: true,
  });
  expect(vi.getTimerCount()).toBe(1); // Only the other request's cursor expiry remains.
  second("error");
  expect(activity.store.getState().regions).toHaveLength(0);
  expect(vi.getTimerCount()).toBe(0);
});

it("resolves both source and destination of batched moves", () => {
  expect(
    activityTargets("executeBatch", {
      operations: [
        {
          name: "moveElement",
          input: {
            componentUuid: "page",
            elementUuid: "source",
            targetUuid: "dest",
          },
        },
        {
          name: "updateArtboard",
          input: { canvasName: "Draft", frameUuid: "frame" },
        },
      ],
    }),
  ).toEqual([
    { componentUuid: "page", elementUuid: "source" },
    { componentUuid: "page", elementUuid: "dest" },
    { canvasName: "Draft", frameUuid: "frame" },
  ]);
});

it("clears disconnected caller feedback after scan completion and preserves other callers", () => {
  vi.useFakeTimers();
  const activity = new CopilotActivity();
  const finish = activity.begin([{}], "edit", {
    id: "first",
    name: "Codex",
  });
  finish("success");
  vi.advanceTimersByTime(2000);
  expect(activity.store.getState().requests).toHaveLength(0);
  expect(activity.cursorStore.getState().current?.caller?.id).toBe("first");
  const other = activity.begin([{}], "edit", {
    id: "second",
    name: "Codex",
  });
  activity.clearCaller("first");
  expect(activity.cursorStore.getState().current?.caller?.id).toBe("second");
  expect(activity.store.getState().requests).toHaveLength(1);
  activity.clearCaller("second");
  other("success");
  expect(activity.cursorStore.getState().current).toBeUndefined();
  expect(activity.store.getState().requests).toHaveLength(0);
  expect(vi.getTimerCount()).toBe(0);
  activity.dispose();
});

it("preserves unaffected region identities and publishes no cursor changes for scans or other callers", () => {
  vi.useFakeTimers();
  const activity = new CopilotActivity();
  const first = activity.begin(
    [{ componentUuid: "a" }],
    "edit",
    { id: "first", name: "First" },
  );
  const firstRegion = activity.store.getState().regions[0];
  const scan = activity.begin(
    [{ componentUuid: "b" }],
    "inspection",
  );
  expect(activity.store.getState().regions[0]).toBe(firstRegion);
  const cursorChanged = vi.fn();
  const off = activity.cursorStore.subscribe(cursorChanged);
  scan("success");
  expect(activity.store.getState().regions[0]).toBe(firstRegion);
  vi.advanceTimersByTime(2000);
  expect(cursorChanged).not.toHaveBeenCalled();
  const second = activity.begin(
    [{ componentUuid: "c" }],
    "edit",
    { id: "second", name: "Second" },
  );
  expect(cursorChanged).toHaveBeenCalledOnce();
  const current = activity.cursorStore.getState();
  const state = activity.store.getState();
  activity.clearCaller("missing");
  expect(activity.store.getState()).toBe(state);
  expect(activity.cursorStore.getState()).toBe(current);
  first("success");
  expect(activity.cursorStore.getState()).toBe(current);
  expect(cursorChanged).toHaveBeenCalledOnce();
  second("error");
  off();
  activity.dispose();
});

it("cleans abort listeners and all caller-owned timers, ignoring late completion", () => {
  vi.useFakeTimers();
  const activity = new CopilotActivity();
  const controller = new AbortController();
  const removeListener = vi.spyOn(controller.signal, "removeEventListener");
  const finish = activity.begin(
    [{}],
    "edit",
    { id: "first", name: "First" },
    controller.signal,
  );
  const other = activity.begin([{}], "edit", {
    id: "other",
    name: "Other",
  });
  activity.clearCaller("first");
  expect(removeListener).toHaveBeenCalledWith("abort", expect.any(Function));
  expect(vi.getTimerCount()).toBe(1);
  const state = activity.store.getState();
  finish("success");
  controller.abort();
  expect(activity.store.getState()).toBe(state);
  other("success");
  expect(vi.getTimerCount()).toBe(2);
  activity.clearCaller("other");
  expect(vi.getTimerCount()).toBe(0);
  expect(activity.store.getState().requests).toHaveLength(0);
  const pending = new AbortController();
  const removePending = vi.spyOn(pending.signal, "removeEventListener");
  const late = activity.begin(
    [{}],
    "inspection",
    undefined,
    pending.signal,
  );
  activity.dispose();
  expect(removePending).toHaveBeenCalledWith("abort", expect.any(Function));
  const disposed = activity.store.getState();
  late("success");
  pending.abort();
  expect(activity.store.getState()).toBe(disposed);
  expect(vi.getTimerCount()).toBe(0);
});
