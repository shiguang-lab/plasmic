import { mockDeepAuto } from "@/wab/__testonly__/mock";
import { fakeStudioCtx } from "@/wab/client/__testonly__/fake-init-ctx";
import { COPILOT_TOOLS } from "@/wab/client/copilot";
import { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { getArenaFrames } from "@/wab/shared/Arenas";
import { ensure } from "@/wab/shared/common";

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
    studioCtx.site.components.find((c) => c.uuid === created.results[0].uuid),
    "Page missing",
  );
  await call("navigate", { componentUuid: page.uuid });
  const frame = ensure(
    getArenaFrames(studioCtx.currentArena)[0],
    "Frame missing",
  );
  const vc = mockDeepAuto<ViewCtx>();
  vc.arenaFrame.mockReturnValue(frame);
  vc.renderState.tpl2fullKeys.mockReturnValue(["first", "second"]);
  vc.renderState.fullKey2val.mockReturnValue({} as any);
  studioCtx.viewCtxs.push(vc);
  vi.spyOn(studioCtx, "focusedViewCtx").mockReturnValue(vc);
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
  expect((await f.call("scrollElementIntoView", f.input)).visible).toBe(false);
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

it("selects an explicit rendered instance without mutating the design", async () => {
  const f = await fixture();
  f.vc.change.mockImplementation(async (fn) => {
    fn();
    return undefined as any;
  });
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
  });
  expect(f.vc.setStudioFocusBySelectable).toHaveBeenCalledWith(
    f.vc.renderState.fullKey2val.mock.results[0].value,
  );
  expect(f.change).not.toHaveBeenCalled();
  await expect(
    f.call("selectElement", { ...f.input, frameUuid: "missing" }),
  ).rejects.toThrow("not rendered");
});
