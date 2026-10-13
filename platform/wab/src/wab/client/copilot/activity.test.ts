import {
  activityTargets,
  CopilotActivity,
  currentActivity,
} from "@/wab/client/copilot/activity";
import { afterEach, expect, it, vi } from "vitest";

afterEach(() => vi.useRealTimers());

it("shares one counted region for overlapping requests on the same node", () => {
  vi.useFakeTimers();
  const activity = new CopilotActivity();
  const target = {
    componentUuid: "page",
    elementUuid: "table",
    label: "Table",
  };
  const first = activity.begin([target]);
  const second = activity.begin([target]);
  expect(activity.regions).toHaveLength(1);
  expect(activity.regions[0]).toMatchObject({
    count: 2,
    request: { status: "running" },
  });
  const key = activity.regions[0].key;
  second("success");
  expect(activity.regions[0]).toMatchObject({
    count: 2,
    request: { status: "running" },
  });
  expect(currentActivity(activity.requests)?.status).toBe("running");
  vi.advanceTimersByTime(2000);
  expect(activity.regions[0]).toMatchObject({
    key,
    count: 1,
    request: { status: "running" },
  });
  first("success");
  vi.advanceTimersByTime(399);
  expect(activity.regions).toHaveLength(1);
  vi.advanceTimersByTime(1);
  expect(activity.regions).toHaveLength(0);
});

it("counts duplicate batch targets once and keeps separate nodes independent", () => {
  const activity = new CopilotActivity();
  const table = { componentUuid: "page", elementUuid: "table", label: "Table" };
  activity.begin([table, table, { ...table, elementUuid: "form" }]);
  expect(activity.regions.map((r) => [r.target.elementUuid, r.count])).toEqual([
    ["table", 1],
    ["form", 1],
  ]);
  activity.begin([{ ...table, componentUuid: "other-page" }]);
  expect(activity.regions).toHaveLength(3);
  activity.dispose();
  expect(activity.regions).toHaveLength(0);
});

it("does not let stale cleanup remove a new reference or double completion release twice", () => {
  vi.useFakeTimers();
  const activity = new CopilotActivity();
  const target = { componentUuid: "page", label: "Page" };
  const first = activity.begin([target]);
  first("success");
  first("error");
  expect(vi.getTimerCount()).toBe(1);
  expect(activity.requests[0].status).toBe("success");
  vi.advanceTimersByTime(1500);
  const second = activity.begin([target]);
  vi.advanceTimersByTime(500);
  expect(activity.regions[0]).toMatchObject({
    count: 1,
    request: { status: "running" },
  });
  second("success");
  activity.dispose();
  expect(activity.regions).toHaveLength(0);
  expect(vi.getTimerCount()).toBe(0);
});

it("keeps fast calls visible without delaying completion, and expires each request separately", () => {
  vi.useFakeTimers();
  const activity = new CopilotActivity();
  const finishFirst = activity.begin([
    { componentUuid: "page", label: "Page" },
  ]);
  finishFirst("success");
  vi.advanceTimersByTime(600);
  const finishSecond = activity.begin([
    { componentUuid: "page", elementUuid: "table", label: "Table" },
  ]);
  expect(activity.requests.map((r) => r.status)).toEqual([
    "success",
    "running",
  ]);
  vi.advanceTimersByTime(1400);
  expect(activity.requests).toHaveLength(1);
  finishSecond("error");
  expect(activity.requests).toHaveLength(0);
  vi.advanceTimersByTime(600);
  expect(activity.requests).toHaveLength(0);
});

it("keeps long operations active and cancels pending cleanup when Studio closes", () => {
  vi.useFakeTimers();
  const activity = new CopilotActivity();
  const finish = activity.begin([{ label: "Page" }]);
  vi.advanceTimersByTime(10000);
  expect(activity.requests[0].status).toBe("running");
  finish("success");
  expect(activity.requests[0]).toMatchObject({
    status: "success",
    scanning: false,
  });
  vi.advanceTimersByTime(399);
  expect(activity.requests).toHaveLength(1);
  activity.dispose();
  finish("error");
  expect(activity.requests).toHaveLength(0);
  expect(vi.getTimerCount()).toBe(0);
});

it("keeps successful edit scans moving for at least 1.6 seconds", () => {
  vi.useFakeTimers();
  const activity = new CopilotActivity();
  const finish = activity.begin([{ componentUuid: "page", label: "Page" }]);
  vi.advanceTimersByTime(20);
  finish("success");
  expect(activity.requests[0]).toMatchObject({ status: "success", scanning: true });
  vi.advanceTimersByTime(1579);
  expect(activity.requests[0].scanning).toBe(true);
  vi.advanceTimersByTime(1);
  expect(activity.requests[0]).toMatchObject({ status: "success", scanning: false });
  vi.advanceTimersByTime(399);
  expect(activity.requests).toHaveLength(1);
  vi.advanceTimersByTime(1);
  expect(activity.requests).toHaveLength(0);
  expect(vi.getTimerCount()).toBe(0);
});

it("removes failed edits immediately without affecting other edits or retaining timers", () => {
  vi.useFakeTimers();
  const activity = new CopilotActivity();
  const target = { componentUuid: "page", label: "Page" };
  const first = activity.begin([target]);
  const second = activity.begin([target]);
  vi.advanceTimersByTime(20);
  first("error");
  first("success");
  expect(activity.regions[0]).toMatchObject({
    count: 1,
    request: { status: "running" },
    scanning: true,
  });
  expect(vi.getTimerCount()).toBe(0);
  second("error");
  expect(activity.regions).toHaveLength(0);
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
