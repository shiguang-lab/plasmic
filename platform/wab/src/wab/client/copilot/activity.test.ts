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
  const read = activity.begin("read", [target]);
  const edit = activity.begin("edit", [target]);
  expect(activity.regions).toHaveLength(1);
  expect(activity.regions[0]).toMatchObject({
    count: 2,
    request: { mode: "edit", status: "running" },
  });
  const key = activity.regions[0].key;
  edit("error");
  expect(activity.regions[0]).toMatchObject({
    count: 2,
    request: { mode: "read", status: "running" },
  });
  expect(currentActivity(activity.requests)?.status).toBe("running");
  vi.advanceTimersByTime(1600);
  expect(activity.regions[0]).toMatchObject({
    key,
    count: 1,
    request: { status: "running" },
  });
  read("success");
  vi.advanceTimersByTime(399);
  expect(activity.regions).toHaveLength(1);
  vi.advanceTimersByTime(1);
  expect(activity.regions).toHaveLength(0);
});

it("counts duplicate batch targets once and keeps separate nodes independent", () => {
  const activity = new CopilotActivity();
  const table = { componentUuid: "page", elementUuid: "table", label: "Table" };
  activity.begin("edit", [table, table, { ...table, elementUuid: "form" }]);
  expect(activity.regions.map((r) => [r.target.elementUuid, r.count])).toEqual([
    ["table", 1],
    ["form", 1],
  ]);
  activity.begin("read", [{ ...table, componentUuid: "other-page" }]);
  expect(activity.regions).toHaveLength(3);
  activity.dispose();
  expect(activity.regions).toHaveLength(0);
});

it("does not let stale cleanup remove a new reference or double completion release twice", () => {
  vi.useFakeTimers();
  const activity = new CopilotActivity();
  const target = { componentUuid: "page", label: "Page" };
  const first = activity.begin("read", [target]);
  first("success");
  first("error");
  expect(vi.getTimerCount()).toBe(1);
  expect(activity.requests[0].status).toBe("success");
  vi.advanceTimersByTime(1500);
  const second = activity.begin("edit", [target]);
  vi.advanceTimersByTime(100);
  expect(activity.regions[0]).toMatchObject({
    count: 1,
    request: { mode: "edit", status: "running" },
  });
  second("success");
  activity.dispose();
  expect(activity.regions).toHaveLength(0);
  expect(vi.getTimerCount()).toBe(0);
});

it("keeps fast calls visible without delaying completion, and expires each request separately", () => {
  vi.useFakeTimers();
  const activity = new CopilotActivity();
  const finishRead = activity.begin("read", [
    { componentUuid: "page", label: "Page" },
  ]);
  finishRead("success");
  vi.advanceTimersByTime(600);
  const finishEdit = activity.begin("edit", [
    { componentUuid: "page", elementUuid: "table", label: "Table" },
  ]);
  expect(activity.requests.map((r) => r.status)).toEqual([
    "success",
    "running",
  ]);
  vi.advanceTimersByTime(1000);
  expect(activity.requests.map((r) => r.mode)).toEqual(["edit"]);
  finishEdit("error");
  expect(activity.requests[0].status).toBe("error");
  vi.advanceTimersByTime(600);
  expect(activity.requests).toHaveLength(0);
});

it("keeps long operations active and cancels pending cleanup when Studio closes", () => {
  vi.useFakeTimers();
  const activity = new CopilotActivity();
  const finish = activity.begin("edit", [{ label: "Page" }]);
  vi.advanceTimersByTime(10000);
  expect(activity.requests[0].status).toBe("running");
  finish("success");
  vi.advanceTimersByTime(399);
  expect(activity.requests).toHaveLength(1);
  activity.dispose();
  finish("error");
  expect(activity.requests).toHaveLength(0);
  expect(vi.getTimerCount()).toBe(0);
});

it("resolves read scopes and both source and destination of batched moves", () => {
  expect(activityTargets("read", {})).toEqual([{}]);
  expect(
    activityTargets("read", {
      componentUuids: ["page"],
      elements: [{ componentUuid: "page", elementUuid: "table" }],
    }),
  ).toEqual([
    { componentUuid: "page" },
    { componentUuid: "page", elementUuid: "table" },
  ]);
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
