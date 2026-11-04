import { mockDeepAuto } from "@/wab/__testonly__/mock";
import { fakeStudioCtx } from "@/wab/client/__testonly__/fake-init-ctx";
import { COPILOT_TOOLS } from "@/wab/client/copilot";
import { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import type { ViewportCtx } from "@/wab/client/studio-ctx/ViewportCtx";
import { getArenaFrames } from "@/wab/shared/Arenas";
import { ensure } from "@/wab/shared/common";
import { Box } from "@/wab/shared/geom";
import { runInAction } from "mobx";

async function fixture() {
  const { studioCtx } = fakeStudioCtx();
  const call = async (name: string, input: Record<string, unknown>) =>
    JSON.parse(
      await ensure(COPILOT_TOOLS[name], "Tool missing").execute(
        studioCtx,
        input,
      ),
    );
  const created = await call("createComponent", {
    name: "Scroll",
    type: "page",
    path: "/scroll",
  });
  const page = ensure(
    studioCtx.site.components.find((c) => c.uuid === created.created[0].uuid),
    "Page missing",
  );
  await call("navigate", { componentUuid: page.uuid });
  const frame = ensure(
    getArenaFrames(studioCtx.currentArena)[0],
    "Frame missing",
  );
  const vc = mockDeepAuto<ViewCtx>();
  vc.awaitSync.mockResolvedValue(undefined);
  vc.arenaFrame.mockReturnValue(frame);
  vc.renderState.tpl2fullKeys.mockReturnValue(["first", "second"]);
  vc.renderState.fullKey2val.mockReturnValue({} as any);
  studioCtx.viewCtxs.push(vc);
  vi.spyOn(studioCtx, "focusedViewCtx").mockReturnValue(vc);
  vi.spyOn(studioCtx, "tryGetViewCtxForFrame").mockReturnValue(vc);
  vi.spyOn(studioCtx, "canEditProject").mockReturnValue(false);
  const selection = vi.spyOn(studioCtx, "setStudioFocusOnFrame");
  const change = vi.spyOn(studioCtx, "changeObserved");
  const parent = document.createElement("div");
  parent.style.overflowY = "auto";
  document.body.append(parent);
  for (const [key, value] of Object.entries({
    clientWidth: 200,
    clientHeight: 100,
    scrollWidth: 200,
    scrollHeight: 600,
    offsetWidth: 200,
    offsetHeight: 100,
    clientLeft: 0,
    clientTop: 0,
  })) {
    Object.defineProperty(parent, key, { value });
  }
  vi.spyOn(parent, "getBoundingClientRect").mockReturnValue(
    new DOMRect(0, 0, 200, 100),
  );
  parent.scrollTo = vi.fn((options?: ScrollToOptions | number, y?: number) => {
    const opts =
      typeof options === "number" ? { left: options, top: y } : (options ?? {});
    parent.scrollTop = opts.top ?? parent.scrollTop;
  });
  const target = document.createElement("div");
  parent.append(target);
  const rect = () => new DOMRect(10, 500 - parent.scrollTop, 100, 20);
  vi.spyOn(target, "getBoundingClientRect").mockImplementation(rect);
  vi.spyOn(target, "getClientRects").mockImplementation(
    () => [rect()] as unknown as DOMRectList,
  );
  vc.renderState.val2dom.mockReturnValue([target]);
  studioCtx.copilotActivity.dispose();
  const input = { componentUuid: page.uuid, elementUuid: page.tplTree.uuid };
  return {
    studioCtx,
    call,
    vc,
    frame,
    parent,
    target,
    input,
    selection,
    change,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
  document.body.innerHTML = "";
});

async function visibleEditorFixture() {
  const f = await fixture();
  f.studioCtx.studioIsVisible = true;
  Object.defineProperty(f.vc, "isDisposed", { value: false });
  Object.defineProperty(f.vc, "studioCtx", { value: f.studioCtx });
  Object.defineProperty(f.vc, "component", { value: f.studioCtx.site.components.find(c => c.uuid === f.input.componentUuid) });
  f.vc.renderState.tpl2fullKeys.mockReturnValue(["first"]);
  vi.spyOn(f.studioCtx, "change").mockImplementation(async fn => fn());
  const viewport = document.createElement("iframe");
  f.vc.canvasCtx.viewport.mockReturnValue(viewport);
  const viewportCtx = mockDeepAuto<ViewportCtx>();
  viewportCtx.scale.mockReturnValue(1);
  viewportCtx.clipperBox.mockReturnValue(Box.fromRect(new DOMRect(0, 0, 800, 600)));
  vi.spyOn(f.studioCtx, "viewportCtx", "get").mockReturnValue(viewportCtx);
  const fit = vi.spyOn(f.studioCtx, "tryZoomToFitDomElement").mockImplementation(() => undefined);
  return { ...f, viewport, fit };
}

it("automatically presents a targeted model read by selection reveal followed by nested scrolling", async () => {
  const f = await visibleEditorFixture();
  const page = ensure(f.studioCtx.site.components.find(c => c.uuid === f.input.componentUuid), "Page missing");
  const counter = f.studioCtx._changeCounter;
  const before = f.studioCtx.appCtx.bundler.bundle(f.studioCtx.site, f.studioCtx.siteInfo.id, f.studioCtx.appCtx.lastBundleVersion);
  const businessHandler = vi.fn();
  f.target.onclick = businessHandler;
  f.target.hidden = true;
  f.vc.setStudioFocusByTpl.mockImplementation(() => { f.target.hidden = false; });
  const result = await f.call("read", { view: "properties", elements: [f.input] });
  expect(result.presentation, result.presentation?.message).toMatchObject({ ...f.input, visible: true, reason: "visible", phase: "after" });
  expect(f.vc.setStudioFocusByTpl).toHaveBeenCalledWith(page.tplTree);
  expect(f.parent.scrollTop).toBe(420);
  expect(f.fit).not.toHaveBeenCalled();
  expect(businessHandler).not.toHaveBeenCalled();
  expect(f.studioCtx.isInteractiveMode).toBe(false);
  expect(f.studioCtx._changeCounter).toBe(counter);
  expect(f.studioCtx.appCtx.bundler.bundle(f.studioCtx.site, f.studioCtx.siteInfo.id, f.studioCtx.appCtx.lastBundleVersion)).toEqual(before);
});

it("locates a target outside the visible Studio workspace using the existing viewport fit", async () => {
  const f = await visibleEditorFixture();
  vi.spyOn(f.viewport, "getBoundingClientRect").mockReturnValue(new DOMRect(1200, 0, 600, 400));
  expect((await f.call("read", { elements: [f.input] })).presentation.visible).toBe(true);
  expect(f.fit).toHaveBeenCalledExactlyOnceWith(f.target);
});

it("returns from interaction to editing before automatically selecting the read target", async () => {
  const f = await visibleEditorFixture();
  runInAction(() => { f.studioCtx.isInteractiveMode = true; });
  f.vc.setStudioFocusByTpl.mockImplementation(() => {
    expect(f.studioCtx.isInteractiveMode).toBe(false);
  });
  const result = await f.call("read", { elements: [f.input] });
  expect(result.presentation).toMatchObject({ visible: true, reason: "visible" });
  expect(f.vc.setStudioFocusByTpl).toHaveBeenCalled();
  expect(f.studioCtx.isInteractiveMode).toBe(false);
});

it("preserves a successful mutation when automatic presentation throws", async () => {
  const f = await visibleEditorFixture();
  vi.mocked(f.studioCtx.canEditProject).mockReturnValue(true);
  f.vc.setStudioFocusByTpl.mockImplementation(() => { throw new Error("Canvas unavailable"); });
  const result = await f.call("changeElement", { ...f.input, name: "Updated" });
  expect(result.presentation).toMatchObject({ visible: false, reason: "presentation-failed", message: expect.stringContaining("Do not repeat a successful mutation") });
  expect(f.studioCtx.site.components.find(c => c.uuid === f.input.componentUuid)?.tplTree).toMatchObject({ name: "Updated" });
});

it("automatically presents an edited target without an extra Agent call", async () => {
  const f = await visibleEditorFixture();
  vi.mocked(f.studioCtx.canEditProject).mockReturnValue(true);
  const names: (string | null)[] = [];
  f.vc.setStudioFocusByTpl.mockImplementation(tpl => { if (tpl && "name" in tpl) { names.push(tpl.name ?? null); } });
  const result = await f.call("changeElement", { ...f.input, name: "Updated" });
  expect(result.presentation, result.presentation?.message).toMatchObject({ ...f.input, visible: true, reason: "visible", phase: "after" });
  expect(f.vc.setStudioFocusByTpl).toHaveBeenCalled();
  expect(f.parent.scrollTop).toBe(420);
  expect(names[0]).not.toBe("Updated");
  expect(names.at(-1)).toBe("Updated");
});

it("reports non-scrollable clipping accurately after automatic selection instead of toggling interaction", async () => {
  const f = await visibleEditorFixture();
  f.parent.style.overflowY = "hidden";
  const result = await f.call("read", { view: "properties", elements: [f.input] });
  expect(result.presentation).toMatchObject({ visible: false, reason: "layout-clipped", message: expect.stringContaining("non-scrollable") });
  expect(f.parent.scrollTop).toBe(0);
  expect(f.studioCtx.isInteractiveMode).toBe(false);
});

it("presents a newly inserted node only after its model identity exists", async () => {
  const f = await visibleEditorFixture();
  vi.mocked(f.studioCtx.canEditProject).mockReturnValue(true);
  const result = await f.call("insertHtml", { ...f.input, location: "append", html: "<div>New content</div>" });
  const created = ensure(result.created.find((item: { kind: string }) => item.kind === "Element"), "Created element missing");
  expect(created.uuid).not.toBe(f.input.elementUuid);
  expect(result.presentation).toMatchObject({ componentUuid: f.input.componentUuid, elementUuid: created.uuid, visible: true, phase: "after" });
});

it("shows a deletion target before removal and labels that presentation phase", async () => {
  const f = await visibleEditorFixture();
  vi.mocked(f.studioCtx.canEditProject).mockReturnValue(true);
  const inserted = await f.call("insertHtml", { ...f.input, location: "append", html: "<div>Remove me</div>" });
  const created = ensure(inserted.created.find((item: { kind: string }) => item.kind === "Element"), "Created element missing");
  const result = await f.call("deleteElement", { componentUuid: f.input.componentUuid, elementUuid: created.uuid });
  expect(result.presentation).toMatchObject({ elementUuid: created.uuid, visible: true, phase: "before" });
  await expect(f.call("read", { elements: [{ componentUuid: f.input.componentUuid, elementUuid: created.uuid }] })).rejects.toThrow("not found");
});

it("does not mistake a CSS-hidden target for a scroll problem or run its business trigger", async () => {
  const f = await visibleEditorFixture();
  f.target.hidden = true;
  const result = await f.call("read", { view: "properties", elements: [f.input] });
  expect(result.presentation).toMatchObject({ visible: false, reason: "hidden", message: expect.stringContaining("display-state transition is confirmed") });
  expect(f.studioCtx.isInteractiveMode).toBe(false);
});

it("keeps model data when a target has no rendered instance and does not infer it is uncreated", async () => {
  const f = await visibleEditorFixture();
  f.vc.renderState.val2dom.mockReturnValue([]);
  const result = await f.call("read", { view: "properties", elements: [f.input] });
  expect(result.results).toHaveLength(1);
  expect(result.presentation).toMatchObject({ visible: false, reason: "not-rendered", message: expect.stringContaining("do not infer") });
});

it("does not invent a node or change the view for a failed model lookup or empty query", async () => {
  const f = await visibleEditorFixture();
  const count = f.studioCtx._changeCounter;
  await expect(f.call("read", { elements: [{ ...f.input, elementUuid: "missing" }] })).rejects.toThrow("not found");
  expect((await f.call("queryElements", { componentUuid: f.input.componentUuid, nameContains: "missing" })).presentation).toBeUndefined();
  expect(f.vc.setStudioFocusByTpl).not.toHaveBeenCalled();
  expect(f.studioCtx._changeCounter).toBe(count);
});

it("does not silently select a repeated instance during a model read", async () => {
  const f = await visibleEditorFixture();
  f.vc.renderState.tpl2fullKeys.mockReturnValue(["first", "second"]);
  const result = await f.call("read", { elements: [f.input] });
  expect(result.presentation).toMatchObject({ visible: false, reason: "ambiguous-instance", message: expect.stringContaining("instanceIndex") });
  expect(f.vc.setStudioFocusByTpl).not.toHaveBeenCalled();
});

it("reveals content on a read-only project without changing selection, mode or design", async () => {
  const f = await fixture();
  const count = f.studioCtx.copilotActivity.requests.length;
  const interactive = f.studioCtx.isInteractiveMode;
  const result = await f.call("scrollElementIntoView", f.input);
  expect(f.parent.scrollTop).toBe(420);
  expect(result).toEqual({
    ...f.input,
    frameUuid: f.frame.uuid,
    instanceIndex: 0,
    visible: true,
    visibilityBefore: { visible: false, reason: "scroll-clipped" },
    visibility: { visible: true, reason: "visible" },
    guidance: expect.stringContaining("workspace screenshot"),
    bounds: { x: 10, y: 80, width: 100, height: 20 },
  });
  expect(f.change).not.toHaveBeenCalled();
  expect(f.selection).not.toHaveBeenCalled();
  expect(f.studioCtx.isInteractiveMode).toBe(interactive);
  expect(f.studioCtx.copilotActivity.requests).toHaveLength(count);
  await f.call("scrollElementIntoView", f.input);
  expect(f.parent.scrollTo).toHaveBeenCalledTimes(1);
});

it("accepts an explicit artboard and repeated instance index", async () => {
  const f = await fixture();
  await f.call("scrollElementIntoView", {
    ...f.input,
    frameUuid: f.frame.uuid,
    instanceIndex: 1,
  });
  expect(f.vc.renderState.fullKey2val).toHaveBeenCalledWith("second");
  await expect(
    f.call("scrollElementIntoView", { ...f.input, instanceIndex: 2 }),
  ).rejects.toThrow("instanceIndex");
  await expect(
    f.call("scrollElementIntoView", { ...f.input, instanceIndex: -1 }),
  ).rejects.toThrow();
  await expect(
    f.call("scrollElementIntoView", { ...f.input, frameUuid: "missing" }),
  ).rejects.toThrow("not rendered");
});

it("rejects missing and unrendered targets without pretending to reveal them", async () => {
  const f = await fixture();
  await expect(
    f.call("scrollElementIntoView", { ...f.input, elementUuid: "missing" }),
  ).rejects.toThrow("not found");
  f.vc.renderState.tpl2fullKeys.mockReturnValue([]);
  await expect(f.call("scrollElementIntoView", f.input)).rejects.toThrow(
    "not rendered",
  );
  f.vc.renderState.tpl2fullKeys.mockReturnValue(["first"]);
  f.target.remove();
  await expect(f.call("scrollElementIntoView", f.input)).rejects.toThrow(
    "hidden",
  );
});

it("reports false when a hidden clipping ancestor prevents scrolling into view", async () => {
  const f = await fixture();
  f.parent.style.overflowY = "hidden";
  expect(await f.call("scrollElementIntoView", f.input)).toMatchObject({
    visible: false,
    visibilityBefore: { visible: false, reason: "layout-clipped" },
    visibility: { visible: false, reason: "layout-clipped" },
    guidance: expect.stringContaining("clipping and sizing"),
  });
  expect(f.parent.scrollTop).toBe(0);
});

it("requires an artboard when the target has multiple unfocused renderings", async () => {
  const f = await fixture();
  vi.mocked(f.studioCtx.canEditProject).mockReturnValue(true);
  await f.call("createCanvas", { name: "Both" });
  for (let i = 0; i < 2; i++) {
    await f.call("createArtboard", {
      canvasName: "Both",
      componentUuid: f.input.componentUuid,
      width: 600,
      height: 400,
      x: i * 700,
      y: 0,
    });
  }
  const arena = ensure(
    f.studioCtx.site.arenas.find((item) => item.name === "Both"),
    "Canvas missing",
  );
  vi.spyOn(f.studioCtx, "currentArena", "get").mockReturnValue(arena);
  const frames = getArenaFrames(f.studioCtx.currentArena);
  f.vc.arenaFrame.mockReturnValue(frames[0]);
  const second = mockDeepAuto<ViewCtx>();
  second.arenaFrame.mockReturnValue(frames[1]);
  second.renderState.tpl2fullKeys.mockReturnValue(["first"]);
  f.studioCtx.viewCtxs.push(second);
  vi.mocked(f.studioCtx.focusedViewCtx).mockReturnValue(undefined);
  await expect(f.call("scrollElementIntoView", f.input)).rejects.toThrow(
    "specify frameUuid",
  );
  expect(
    (
      await f.call("scrollElementIntoView", {
        ...f.input,
        frameUuid: frames[0].uuid,
      })
    ).frameUuid,
  ).toBe(frames[0].uuid);
});

it("selects and reveals an explicit rendered instance without mutating the design", async () => {
  const f = await fixture();
  vi.spyOn(f.studioCtx, "change").mockImplementation(async (fn) => fn());
  f.vc.setStudioFocusBySelectable.mockClear();
  const result = await f.call("selectElement", {
    ...f.input,
    frameUuid: f.frame.uuid,
    instanceIndex: 1,
  });
  expect(result).toEqual({
    ...f.input,
    frameUuid: f.frame.uuid,
    instanceIndex: 1,
    visibility: { visible: true, reason: "visible" },
    guidance: expect.stringContaining("workspace screenshot"),
  });
  expect(f.vc.setStudioFocusBySelectable).toHaveBeenCalledWith(
    f.vc.renderState.fullKey2val.mock.results[0].value,
  );
  expect(f.vc.renderState.fullKey2val).toHaveBeenLastCalledWith("second");
  expect(f.parent.scrollTop).toBe(420);
  expect(f.target.getBoundingClientRect().bottom).toBe(100);
  await f.call("selectElement", {
    ...f.input,
    frameUuid: f.frame.uuid,
    instanceIndex: 1,
  });
  expect(f.parent.scrollTo).toHaveBeenCalledTimes(1);
  expect(f.change).not.toHaveBeenCalled();
  await expect(
    f.call("selectElement", { ...f.input, frameUuid: "missing" }),
  ).rejects.toThrow("not rendered");
});

it.each(["layout-clipped", "no-layout", "hidden", "not-rendered"])(
  "keeps selection when the target cannot be revealed: %s",
  async (reason) => {
    const f = await fixture();
    vi.spyOn(f.studioCtx, "change").mockImplementation(async (fn) => fn());
    if (reason === "layout-clipped") {
      f.parent.style.overflowY = "hidden";
    } else if (reason === "no-layout") {
      vi.mocked(f.target.getClientRects).mockReturnValue([] as unknown as DOMRectList);
    } else if (reason === "hidden") {
      f.target.hidden = true;
      vi.mocked(f.target.getClientRects).mockReturnValue([] as unknown as DOMRectList);
    } else {
      f.vc.renderState.val2dom.mockReturnValue([]);
    }
    await expect(f.call("selectElement", f.input)).resolves.toMatchObject({
      ...f.input,
      visibility: { visible: false, reason },
      guidance: expect.any(String),
    });
    expect(f.vc.setStudioFocusBySelectable).toHaveBeenCalled();
    expect(f.parent.scrollTo).not.toHaveBeenCalled();
    expect(f.change).not.toHaveBeenCalled();
  },
);

it("waits for selection and resolves the refreshed rendered instance before scrolling", async () => {
  const f = await fixture();
  const selectedVal = {} as any;
  f.vc.renderState.val2dom.mockReturnValue([]);
  vi.spyOn(f.studioCtx, "change").mockImplementation(async (fn) => {
    await Promise.resolve();
    return fn();
  });
  f.vc.awaitSync.mockImplementation(async () => {
    if (f.vc.setStudioFocusBySelectable.mock.calls.length) {
      await Promise.resolve();
      f.vc.renderState.fullKey2val.mockReturnValue(selectedVal);
      f.vc.renderState.val2dom.mockImplementation((val) =>
        val === selectedVal ? [f.target] : [],
      );
    }
  });
  await f.call("selectElement", f.input);
  expect(f.parent.scrollTop).toBe(420);
});
