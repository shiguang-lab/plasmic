import { fakeStudioCtx } from "@/wab/client/__testonly__/fake-init-ctx";
import { productTheme } from "@/wab/client/antd-theme";
import {
  activityBounds,
  CopilotActivityOverlay,
} from "@/wab/client/components/canvas/CopilotActivityOverlay";
import { ActivityTarget } from "@/wab/client/copilot/activity";
import { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { IArenaFrame } from "@/wab/shared/Arenas";
import { ensure } from "@/wab/shared/common";
import { mkTplTagX } from "@/wab/shared/core/tpls";
import { ValTag } from "@/wab/shared/core/val-nodes";
import { Component, TplComponent } from "@/wab/shared/model/classes";
import { act, cleanup, render } from "@testing-library/react";
import { theme } from "antd";
import { ThemeProvider } from "antd-style";
import { observable } from "mobx";
import React from "react";
import { afterEach, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  document.body.replaceChildren();
});

function nestedActivity() {
  vi.useFakeTimers();
  vi.spyOn(window, "requestAnimationFrame").mockReturnValue(1);
  const { studioCtx } = fakeStudioCtx();
  const descendant = mkTplTagX("span");
  const child = mkTplTagX("div", {}, [descendant]);
  const parent = mkTplTagX("div", {}, [child]);
  const sibling = mkTplTagX("div");
  const component = mock<Component>({
    uuid: "page",
    type: "page",
  });
  const frame = mock<IArenaFrame>({
    uuid: "frame",
    width: 1440,
    height: 1024,
    _height: observable.box(1024),
    container: mock<TplComponent>({ component }),
  });
  component.tplTree = mkTplTagX("div", {}, [parent, sibling]);
  const element = document.createElement("div");
  document.body.append(element);
  rect(element, 10, 10, 100, 100);
  const renderState = mock<ViewCtx["renderState"]>();
  renderState.tpl2bestVal.mockReturnValue(mock<ValTag>());
  renderState.sel2dom.mockReturnValue([element]);
  const viewCtx = mock<ViewCtx>();
  viewCtx.arenaFrame.mockReturnValue(frame);
  Object.defineProperties(viewCtx, {
    studioCtx: { value: mock<StudioCtx>({ zoom: 1 }) },
    renderState: { value: renderState },
  });
  vi.spyOn(studioCtx, "tryGetViewCtxForFrame").mockReturnValue(viewCtx);
  const target = (elementUuid?: string): ActivityTarget => ({
    componentUuid: component.uuid,
    elementUuid,
    label: elementUuid ?? "Page",
  });
  return { studioCtx, frame, parent, child, descendant, sibling, target };
}

it("reuses the cursor while switching operation owners and clears failed work", () => {
  const { studioCtx, frame, child, sibling, target } = nestedActivity();
  let callbacks: FrameRequestCallback[] = [];
  vi.mocked(window.requestAnimationFrame).mockImplementation((callback) => { callbacks.push(callback); return callbacks.length; });
  const finish = studioCtx.copilotActivity.begin([target(child.uuid)], "edit", { id: "codex", name: "Codex" });
  const { container, unmount } = render(<CopilotActivityOverlay studioCtx={studioCtx} frame={frame} />);
  const step = () => act(() => {
    const batch = callbacks;
    callbacks = [];
    batch.forEach((callback) => callback(performance.now() + 250));
  });
  step(); step();
  const root = ensure(container.querySelector<HTMLElement>("[data-plasmic-agent-cursor]"), "Edit cursor was not mounted");
  expect(root.style.display).toBe("block");
  expect(root.shadowRoot?.querySelector("span")?.textContent).toBe("Codex");
  let finishNext = finish;
  act(() => {
    finishNext = studioCtx.copilotActivity.begin([target(sibling.uuid)], "edit", { id: "chatgpt", name: "ChatGPT" });
  });
  step();
  expect(container.querySelectorAll("[data-plasmic-agent-cursor]")).toHaveLength(1);
  expect(container.querySelector("[data-plasmic-agent-cursor]")).toBe(root);
  expect(root.shadowRoot?.querySelector("span")?.textContent).toBe("ChatGPT");
  act(() => finishNext("error"));
  step();
  expect(root.shadowRoot?.querySelector("span")?.textContent).toBe("Codex");
  act(() => { finishNext = studioCtx.copilotActivity.begin([target(sibling.uuid)]); });
  step();
  expect(root.shadowRoot?.querySelector("span")?.textContent).toBe("AI assistant");
  act(() => { finish("error"); finishNext("error"); });
  expect(root.style.display).toBe("none");
  unmount();
  expect(root.isConnected).toBe(false);
});

it.each(["inspection", "edit"] as const)("merges overlapping scope aliases for the same %s node without releasing other requests", (kind) => {
  const { studioCtx, frame, child, target } = nestedActivity();
  const activity = studioCtx.copilotActivity;
  const finishFirst = activity.begin([target(child.uuid)], kind);
  const { container } = render(<CopilotActivityOverlay studioCtx={studioCtx} frame={frame} />);
  const region = container.querySelector("[data-copilot-target]");
  let finishSecond = finishFirst;
  act(() => {
    finishSecond = activity.begin([
      { ...target(child.uuid), frameUuid: frame.uuid },
      { elementUuid: child.uuid, label: "Child" },
    ], kind);
  });
  expect(activity.regions).toHaveLength(3);
  expect(container.querySelectorAll("[data-copilot-target]")).toHaveLength(1);
  expect(container.querySelector("[data-copilot-target]")).toBe(region);
  act(() => {
    finishSecond("success");
    vi.advanceTimersByTime(2000);
  });
  expect(container.querySelector("[data-copilot-target]")).toBe(region);
  expect(region?.getAttribute("data-status")).toBe("running");
  act(() => finishFirst("error"));
  expect(container.querySelector("[data-copilot-target]")).toBeNull();
  activity.dispose();
});

it.each(["inspection", "edit"] as const)("merges whole-component and root-node %s requests", (kind) => {
  const { studioCtx, frame, target } = nestedActivity();
  studioCtx.copilotActivity.begin([target(), target(frame.container.component.tplTree.uuid)], kind);
  const { container } = render(<CopilotActivityOverlay studioCtx={studioCtx} frame={frame} />);
  expect(container.querySelectorAll("[data-copilot-target]")).toHaveLength(1);
  studioCtx.copilotActivity.dispose();
});

it.each([
  ["inspection", "element"],
  ["edit", "element"],
  ["inspection", "page"],
  ["edit", "page"],
] as const)("shows only the outermost %s scan within a %s target and restores children after it expires", (kind, scope) => {
  const { studioCtx, frame, parent, child, descendant, sibling, target } = nestedActivity();
  const activity = studioCtx.copilotActivity;
  activity.begin([target(descendant.uuid), target(child.uuid), target(sibling.uuid)], kind);
  const parentUuid = scope === "page" ? undefined : parent.uuid;
  const finishParent = activity.begin([target(parentUuid)], kind);
  const { container } = render(
    <CopilotActivityOverlay studioCtx={studioCtx} frame={frame} />,
  );
  const visibleTargets = () => Array.from(container.querySelectorAll("[data-copilot-target]"), (region) => region.getAttribute("data-copilot-target"));
  const expected = scope === "page" ? ["page"] : [sibling.uuid, parent.uuid];
  expect(visibleTargets()).toEqual(expected);
  expect(activity.regions).toHaveLength(4);
  act(() => {
    finishParent("success");
    vi.advanceTimersByTime(1999);
  });
  expect(visibleTargets()).toEqual(expected);
  act(() => {
    vi.advanceTimersByTime(1);
  });
  expect(visibleTargets()).toEqual([child.uuid, sibling.uuid]);
  activity.dispose();
});

it.each([
  ["inspection", "edit"],
  ["edit", "inspection"],
] as const)("keeps a child %s scan under a parent %s scan while hiding same-kind descendants", (childKind, parentKind) => {
  const { studioCtx, frame, parent, child, descendant, target } = nestedActivity();
  const activity = studioCtx.copilotActivity;
  activity.begin([target(parent.uuid), target(descendant.uuid)], parentKind);
  activity.begin([target(child.uuid)], childKind);
  const { container } = render(
    <CopilotActivityOverlay studioCtx={studioCtx} frame={frame} />,
  );
  expect(container.querySelectorAll("[data-copilot-target]")).toHaveLength(2);
  expect(container.querySelector(`[data-copilot-target="${parent.uuid}"]`)?.getAttribute("data-kind")).toBe(parentKind);
  expect(container.querySelector(`[data-copilot-target="${child.uuid}"]`)?.getAttribute("data-kind")).toBe(childKind);
  expect(container.querySelector(`[data-copilot-target="${descendant.uuid}"]`)).toBeNull();
  activity.dispose();
});

it("does not suppress a child for ancestors targeted in another component or frame", () => {
  const { studioCtx, frame, parent, child, target } = nestedActivity();
  const activity = studioCtx.copilotActivity;
  activity.begin([
    { ...target(parent.uuid), componentUuid: "other-page" },
    { ...target(parent.uuid), frameUuid: "other-frame" },
    target(child.uuid),
  ]);
  const { container } = render(
    <CopilotActivityOverlay studioCtx={studioCtx} frame={frame} />,
  );
  expect(container.querySelectorAll("[data-copilot-target]")).toHaveLength(1);
  expect(container.querySelector("[data-copilot-target]")?.getAttribute("data-copilot-target")).toBe(child.uuid);
  activity.dispose();
});

it("uses captured ancestors for removed targets and releases suppression when a parent fails", () => {
  const { studioCtx, frame, parent, target } = nestedActivity();
  const activity = studioCtx.copilotActivity;
  activity.begin([{ ...target("removed"), ancestorUuids: [parent.uuid] }]);
  const finishParent = activity.begin([target(parent.uuid)]);
  const { container } = render(
    <CopilotActivityOverlay studioCtx={studioCtx} frame={frame} />,
  );
  expect(container.querySelectorAll("[data-copilot-target]")).toHaveLength(1);
  expect(container.querySelector('[data-copilot-target="removed"]')).toBeNull();
  act(() => finishParent("error"));
  expect(container.querySelectorAll("[data-copilot-target]")).toHaveLength(1);
  expect(container.querySelector('[data-copilot-target="removed"]')).toBeTruthy();
  activity.dispose();
});

it("renders a single persistent scan DOM node until its last reference expires", () => {
  vi.useFakeTimers();
  vi.spyOn(window, "requestAnimationFrame").mockReturnValue(1);
  const { studioCtx } = fakeStudioCtx();
  const activity = studioCtx.copilotActivity;
  const component = mock<Component>({ uuid: "page", type: "page", tplTree: mkTplTagX("div") });
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
  const first = activity.begin([target, target]);
  const { container } = render(
    <CopilotActivityOverlay studioCtx={studioCtx} frame={frame} />,
  );
  const region = container.querySelector('[data-copilot-target="page"]');
  expect(region).toBeTruthy();
  expect(region?.getAttribute("data-kind")).toBe("edit");
  let second = first;
  act(() => {
    second = activity.begin([target], "inspection");
  });
  expect(container.querySelectorAll("[data-copilot-target]")).toHaveLength(1);
  expect(container.querySelector("[data-copilot-target]")).toBe(region);
  expect(region?.getAttribute("data-kind")).toBe("inspection");
  act(() => {
    second("error");
    vi.advanceTimersByTime(2000);
  });
  expect(container.querySelector("[data-copilot-target]")).toBe(region);
  expect(region?.getAttribute("data-status")).toBe("running");
  expect(region?.getAttribute("data-kind")).toBe("edit");
  act(() => {
    first("success");
    vi.advanceTimersByTime(400);
  });
  expect(container.querySelectorAll("[data-copilot-target]")).toHaveLength(0);
  activity.dispose();
});

it.each([
  ["inspection", "light"],
  ["edit", "light"],
  ["inspection", "dark"],
  ["edit", "dark"],
] as const)("preserves the %s color through scanning and completion in %s appearance", (kind, appearance) => {
  vi.useFakeTimers();
  vi.spyOn(window, "requestAnimationFrame").mockReturnValue(1);
  const { studioCtx } = fakeStudioCtx();
  const component = mock<Component>({ uuid: "page", type: "page", tplTree: mkTplTagX("div") });
  const frame = mock<IArenaFrame>({
    width: 1440,
    height: 1024,
    _height: observable.box(1024),
    container: mock<TplComponent>({ component }),
  });
  const viewCtx = mock<ViewCtx>();
  viewCtx.arenaFrame.mockReturnValue(frame);
  Object.defineProperty(viewCtx, "studioCtx", {
    value: mock<StudioCtx>({ zoom: 1 }),
  });
  vi.spyOn(studioCtx, "tryGetViewCtxForFrame").mockReturnValue(viewCtx);
  const finish = studioCtx.copilotActivity.begin([
    { componentUuid: "page", label: "Page" },
  ], kind);
  const { container } = render(
    <ThemeProvider appearance={appearance} theme={productTheme(appearance)}>
      <CopilotActivityOverlay studioCtx={studioCtx} frame={frame} />
    </ThemeProvider>,
  );
  const region = ensure(container.querySelector("[data-copilot-target]"), "Expected activity region");
  const token = theme.getDesignToken(productTheme(appearance));
  const color = kind === "inspection" ? token.colorInfo : token.colorPrimary;
  expect(token.colorInfo).not.toBe(token.colorPrimary);
  expect(region.getAttribute("data-kind")).toBe(kind);
  expect(getComputedStyle(region).getPropertyValue("--scan-color").trim()).toBe(color);
  act(() => finish("success"));
  expect(region?.getAttribute("data-status")).toBe("success");
  expect(region?.getAttribute("data-scanning")).toBe("true");
  expect(getComputedStyle(region).getPropertyValue("--scan-color").trim()).toBe(color);
  act(() => {
    vi.advanceTimersByTime(1599);
  });
  expect(region?.getAttribute("data-scanning")).toBe("true");
  act(() => {
    vi.advanceTimersByTime(1);
  });
  expect(region?.getAttribute("data-scanning")).toBe("false");
  expect(getComputedStyle(region).getPropertyValue("--scan-color").trim()).toBe(color);
  expect(container.querySelector("[data-copilot-target]")).toBe(region);
  act(() => {
    vi.advanceTimersByTime(400);
  });
  expect(container.querySelector("[data-copilot-target]")).toBeNull();
  studioCtx.copilotActivity.dispose();
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
