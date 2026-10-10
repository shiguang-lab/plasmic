import { fakeStudioCtx } from "@/wab/client/__testonly__/fake-init-ctx";
import {
  activityBounds,
  CopilotActivityOverlay,
  CopilotActivityStatus,
} from "@/wab/client/components/canvas/CopilotActivityOverlay";
import { setUiLocale } from "@/wab/client/i18n";
import { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { IArenaFrame } from "@/wab/shared/Arenas";
import { Component, TplComponent } from "@/wab/shared/model/classes";
import { act, cleanup, render, screen } from "@testing-library/react";
import { observable } from "mobx";
import React from "react";
import { afterEach, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  document.body.replaceChildren();
});

it("renders a single persistent scan DOM node until its last reference expires", () => {
  vi.useFakeTimers();
  vi.spyOn(window, "requestAnimationFrame").mockReturnValue(1);
  const { studioCtx } = fakeStudioCtx();
  const activity = studioCtx.copilotActivity;
  const component = mock<Component>({ uuid: "page", type: "page" });
  const frame = mock<IArenaFrame>({
    width: 1440,
    height: 1024,
    _height: observable.box(1024),
    container: mock<TplComponent>({ component }),
  });
  const viewCtx = mock<ViewCtx>();
  Object.defineProperty(viewCtx, "studioCtx", {
    value: mock<StudioCtx>({ zoom: 1 }),
  });
  viewCtx.arenaFrame.mockReturnValue(frame);
  vi.spyOn(studioCtx, "tryGetViewCtxForFrame").mockReturnValue(viewCtx);
  const target = { componentUuid: "page", label: "Page" };
  const read = activity.begin("read", [target, target]);
  const { container } = render(
    <CopilotActivityOverlay studioCtx={studioCtx} frame={frame} />,
  );
  const region = container.querySelector('[data-copilot-target="page"]');
  expect(region).toBeTruthy();
  let edit = read;
  act(() => {
    edit = activity.begin("edit", [target]);
  });
  expect(container.querySelectorAll("[data-copilot-target]")).toHaveLength(1);
  expect(container.querySelector("[data-copilot-target]")).toBe(region);
  expect(region?.getAttribute("data-mode")).toBe("edit");
  act(() => {
    edit("error");
    vi.advanceTimersByTime(1600);
  });
  expect(container.querySelector("[data-copilot-target]")).toBe(region);
  expect(region?.getAttribute("data-status")).toBe("running");
  act(() => {
    read("success");
    vi.advanceTimersByTime(400);
  });
  expect(container.querySelectorAll("[data-copilot-target]")).toHaveLength(0);
  activity.dispose();
});

function rect(
  element: Element,
  left: number,
  top: number,
  width: number,
  height: number,
) {
  vi.spyOn(element, "getBoundingClientRect").mockReturnValue({
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
    x: left,
    y: top,
    toJSON: () => ({}),
  });
}

it("follows the current DOM position and clips to frame edges", () => {
  const element = document.createElement("div");
  document.body.append(element);
  rect(element, -20, 40, 200, 100);
  expect(activityBounds([element], 1440, 1024)).toEqual({
    left: 0,
    top: 40,
    width: 180,
    height: 100,
  });
  rect(element, 100, -30, 200, 100);
  expect(activityBounds([element], 1440, 1024)).toEqual({
    left: 100,
    top: 0,
    width: 200,
    height: 70,
  });
  rect(element, 1500, 40, 200, 100);
  expect(activityBounds([element], 1440, 1024)).toBeUndefined();
});

it("clips a table cell to its nested scrolling viewport instead of highlighting hidden content", () => {
  const scroll = document.createElement("div");
  scroll.style.overflowX = "auto";
  scroll.style.overflowY = "hidden";
  const cell = document.createElement("div");
  scroll.append(cell);
  document.body.append(scroll);
  rect(scroll, 100, 200, 300, 200);
  rect(cell, 350, 220, 200, 80);
  expect(activityBounds([cell], 1440, 1024)).toEqual({
    left: 350,
    top: 220,
    width: 50,
    height: 80,
  });
  rect(cell, 401, 220, 200, 80);
  expect(activityBounds([cell], 1440, 1024)).toBeUndefined();
});

it("shows localized operation status from real activity completion", async () => {
  vi.useFakeTimers();
  setUiLocale("zh-CN");
  const { studioCtx } = fakeStudioCtx();
  const finish = studioCtx.copilotActivity.begin("edit", [
    { label: "OrdersTable" },
  ]);
  render(<CopilotActivityStatus studioCtx={studioCtx} />);
  expect(screen.getByRole("status").textContent).toContain(
    "正在编辑 · OrdersTable",
  );
  await act(() => finish("error"));
  expect(screen.getByRole("status").textContent).toContain(
    "操作失败 · OrdersTable",
  );
  await act(() => vi.advanceTimersByTime(1600));
  expect(screen.queryByRole("status")).toBeNull();
  studioCtx.copilotActivity.dispose();
  setUiLocale("en");
});
