import { fakeStudioCtx } from "@/wab/client/__testonly__/fake-init-ctx";
import { PreviewCtx } from "@/wab/client/components/live/PreviewCtx";
import { ViewEditorController } from "@/wab/client/components/studio/view-editor";
import { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { fireEvent, waitFor } from "@testing-library/react";
import { mock } from "vitest-mock-extended";

beforeEach(() => {
  vi.spyOn(window, "focus").mockImplementation(() => undefined);
  vi.stubGlobal("ResizeObserver", class {
    observe = vi.fn();
    disconnect = vi.fn();
  });
});
afterEach(() => {
  document.getSelection()?.removeAllRanges();
  document.body.innerHTML = "";
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

async function fixture() {
  const { studioCtx } = fakeStudioCtx();
  Reflect.set(studioCtx.app, "isDragging", vi.fn(() => false));
  await waitFor(() => expect(studioCtx.initialRouteReady).toBe(true));
  const view = mock<ViewCtx>();
  const copy = vi.spyOn(studioCtx, "copy").mockResolvedValue(undefined);
  const cut = vi.spyOn(studioCtx, "cut").mockResolvedValue(undefined);
  const paste = vi.spyOn(studioCtx, "paste").mockResolvedValue(undefined);
  const bottomModal = vi.spyOn(studioCtx, "isBottomModalFocused").mockReturnValue(false);
  const editor = new ViewEditorController({
    renderInteractive: studioCtx.renderPolicy.store.getState().interactive,
    renderDocs: studioCtx.renderPolicy.store.getState().docs,
    renderDevMode: studioCtx.renderPolicy.store.getState().devMode,
    panelsHidden: studioCtx.leftPanelState.panelsHidden,
    studioCtx, viewCtx: view, previewCtx: mock<PreviewCtx>(), canvasLoading: false,
  });
  const canvas = document.body.appendChild(document.createElement("div"));
  const scaler = canvas.appendChild(document.createElement("div"));
  const clipper = document.body.appendChild(document.createElement("div"));
  clipper.scrollTo = vi.fn(); clipper.scrollBy = vi.fn();
  Reflect.set(Reflect.get(editor, "canvas"), "current", canvas);
  Reflect.set(Reflect.get(editor, "canvasScaler"), "current", scaler);
  Reflect.get(editor, "initializeCanvas").call(editor, clipper);
  const outline = document.body.appendChild(document.createElement("div"));
  outline.className = "tpltree-scroller";
  outline.setAttribute("data-studio-model-input", "");
  const viewport = outline.appendChild(document.createElement("div"));
  viewport.setAttribute("data-overlayscrollbars-viewport", ""); viewport.tabIndex = -1;
  const clipboardEvent = (type: "copy" | "cut" | "paste") => {
    const event = new Event(type, { bubbles: true, cancelable: true });
    Object.defineProperty(event, "clipboardData", { value: { items: [], setData: vi.fn(), getData: vi.fn() } });
    document.activeElement?.dispatchEvent(event);
    return event;
  };
  return { studioCtx, view, editor, clipper, copy, cut, paste, bottomModal, viewport, clipboardEvent,
    dispose: () => { editor.dispose(); studioCtx.dispose(); } };
}

it("routes real copy, cut and paste events from the outline's shared scrolling viewport to Studio", async () => {
  const f = await fixture();
  try {
    f.viewport.focus();
    expect(document.activeElement).toBe(f.viewport);
    for (const type of ["copy", "cut", "paste"] as const) {
      expect(f.clipboardEvent(type).defaultPrevented).toBe(true);
    }
    expect(f.copy).toHaveBeenCalledWith(expect.anything(), f.view);
    expect(f.cut).toHaveBeenCalledWith(expect.anything(), f.view);
    expect(f.paste).toHaveBeenCalledOnce();
  } finally { f.dispose(); }
});

it("keeps body and selected panel text native, and resumes model copying only on a focused model surface", async () => {
  const f = await fixture();
  try {
    const text = document.body.appendChild(document.createElement("p"));
    text.textContent = "Copy these query instructions";
    const range = document.createRange(); range.selectNodeContents(text);
    const selection = document.getSelection(); selection?.addRange(range);
    expect(document.activeElement).toBe(document.body);
    for (const type of ["copy", "cut"] as const) {
      expect(f.clipboardEvent(type).defaultPrevented).toBe(false);
    }
    expect(f.copy).not.toHaveBeenCalled(); expect(f.cut).not.toHaveBeenCalled();
    expect(selection?.toString()).toBe("Copy these query instructions");
    selection?.removeAllRanges();
    expect(f.clipboardEvent("copy").defaultPrevented).toBe(false);
    f.clipper.focus();
    expect(f.clipboardEvent("copy").defaultPrevented).toBe(true);
    expect(f.copy).toHaveBeenCalledOnce();
  } finally { f.dispose(); }
});

it("lets portal pointer events bubble without starting canvas gestures, and still handles canvas pointerdown", async () => {
  const f = await fixture();
  try {
    const handle = vi.spyOn(f.editor as any, "handleMouseDown").mockResolvedValue(undefined);
    const bubbled = vi.fn(); document.body.addEventListener("pointerdown", bubbled);
    try {
      const popup = document.body.appendChild(document.createElement("div"));
      const event = new MouseEvent("pointerdown", { bubbles: true, cancelable: true });
      popup.dispatchEvent(event);
      expect(event.defaultPrevented).toBe(false);
      expect(bubbled).toHaveBeenCalledOnce();
      expect(handle).not.toHaveBeenCalled();
      f.clipper.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true, cancelable: true }));
      expect(handle).toHaveBeenCalledOnce();
    } finally { document.body.removeEventListener("pointerdown", bubbled); }
  } finally { f.dispose(); }
});

it("handles idle moves only inside the canvas, and owns a press until release outside it", async () => {
  const f = await fixture();
  const move = vi.spyOn(f.editor as any, "handleMouseMove").mockResolvedValue(undefined);
  const up = vi.spyOn(f.editor as any, "handleMouseUp").mockResolvedValue(undefined);
  const down = vi.spyOn(f.editor as any, "handleMouseDown").mockImplementation(async () => {
    Reflect.set(f.editor, "pendingCanvasClick", { viewCtx: f.view });
  });
  try {
    document.body.dispatchEvent(new MouseEvent("pointermove", { bubbles: true }));
    document.body.dispatchEvent(new MouseEvent("pointerup", { bubbles: true }));
    expect(move).not.toHaveBeenCalled(); expect(up).not.toHaveBeenCalled();
    f.clipper.dispatchEvent(new MouseEvent("pointermove", { bubbles: true }));
    expect(move).toHaveBeenCalledOnce(); move.mockClear();
    f.clipper.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true }));
    expect(down).toHaveBeenCalledOnce();
    document.body.dispatchEvent(new MouseEvent("pointermove", { bubbles: true }));
    f.clipper.dispatchEvent(new MouseEvent("pointermove", { bubbles: true }));
    expect(move).toHaveBeenCalledTimes(2);
    document.body.dispatchEvent(new MouseEvent("pointerup", { bubbles: true }));
    expect(up).toHaveBeenCalledOnce();
    move.mockClear(); document.body.dispatchEvent(new MouseEvent("pointermove", { bubbles: true }));
    expect(move).not.toHaveBeenCalled();
  } finally { f.dispose(); }
});

it.each(["pointercancel", "blur", "mode", "dispose"])("cancels a canvas gesture on %s and releases its global listeners", async reason => {
  const f = await fixture();
  const move = vi.spyOn(f.editor as any, "handleMouseMove").mockResolvedValue(undefined);
  vi.spyOn(f.editor as any, "handleMouseDown").mockImplementation(async () => {
    Reflect.set(f.editor, "pendingCanvasClick", { viewCtx: f.view });
  });
  try {
    f.clipper.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true }));
    if (reason === "mode") {
      f.studioCtx.isInteractiveMode = true;
    } else if (reason === "dispose") { f.editor.dispose(); }
    else if (reason === "blur") { window.dispatchEvent(new Event("blur")); }
    else { document.dispatchEvent(new Event("pointercancel")); }
    document.body.dispatchEvent(new MouseEvent("pointermove", { bubbles: true }));
    expect(move).not.toHaveBeenCalled();
    expect(Reflect.get(f.editor, "pendingCanvasClick")).toBeUndefined();
  } finally { if (reason !== "dispose") { f.editor.dispose(); } f.studioCtx.dispose(); }
});

it("consumes the release click after Escape without swallowing a new press or native panel interaction", async () => {
  const f = await fixture();
  vi.spyOn(f.editor as any, "handleMouseDown").mockImplementation(async () => { Reflect.set(f.editor, "pendingCanvasClick", { viewCtx: f.view }); });
  const click = () => { const event = new MouseEvent("click", { bubbles: true, cancelable: true, detail: 1 }); f.clipper.dispatchEvent(event); return event; };
  try {
    f.clipper.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true }));
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
    expect(click().defaultPrevented).toBe(true);
    f.clipper.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true }));
    expect(click().defaultPrevented).toBe(false);
  } finally { f.dispose(); }
});

it.each(["input", "contenteditable", "ordinary-div", "other-scroll-owner"] as const)("keeps native clipboard behavior for %s focus", async (kind) => {
  const f = await fixture();
  try {
    let focused: HTMLElement;
    if (kind === "input") {
      focused = f.viewport.appendChild(document.createElement("input"));
    } else if (kind === "contenteditable") {
      focused = f.viewport.appendChild(document.createElement("div"));
      focused.setAttribute("contenteditable", "true"); focused.tabIndex = 0;
    } else if (kind === "ordinary-div") {
      focused = f.viewport.appendChild(document.createElement("div")); focused.tabIndex = 0;
    } else {
      const owner = document.body.appendChild(document.createElement("div"));
      owner.className = "property-panel";
      focused = owner.appendChild(document.createElement("div"));
      focused.setAttribute("data-overlayscrollbars-viewport", ""); focused.tabIndex = -1;
    }
    focused.focus(); expect(document.activeElement).toBe(focused);
    for (const type of ["copy", "cut", "paste"] as const) {
      expect(f.clipboardEvent(type).defaultPrevented).toBe(false);
    }
    expect(f.copy).not.toHaveBeenCalled(); expect(f.cut).not.toHaveBeenCalled(); expect(f.paste).not.toHaveBeenCalled();
  } finally { f.dispose(); }
});

it.each(["bottom-modal", "non-dev-mode", "interactive"] as const)("keeps the %s clipboard guard even when the outline viewport is focused", async (guard) => {
  const f = await fixture();
  try {
    if (guard === "bottom-modal") { f.bottomModal.mockReturnValue(true); }
    else if (guard === "interactive") { f.studioCtx.isInteractiveMode = true; }
    else { vi.spyOn(f.studioCtx, "isDevMode", "get").mockReturnValue(false); }
    f.viewport.focus();
    for (const type of ["copy", "cut", "paste"] as const) {
      expect(f.clipboardEvent(type).defaultPrevented).toBe(false);
    }
    expect(f.copy).not.toHaveBeenCalled(); expect(f.cut).not.toHaveBeenCalled(); expect(f.paste).not.toHaveBeenCalled();
  } finally { f.dispose(); }
});

it.each(["blur", "mode"])("releases pressed keys and their undo group on %s without a keyup", async (reason) => {
  const f = await fixture();
  const viewOps = mock<ViewCtx["viewOps"]>();
  Object.defineProperty(f.view, "viewOps", { value: viewOps });
  f.view.getViewOps.mockReturnValue(viewOps);
  try {
    f.clipper.focus();
    fireEvent.keyDown(f.clipper, { key: " ", keyCode: 32, which: 32 });
    fireEvent.keyDown(f.clipper, { key: "ArrowDown", keyCode: 40, which: 40 });
    await waitFor(() => expect(viewOps.nudgePosition).toHaveBeenCalledWith("down", false));
    expect(f.studioCtx.isSpaceDown()).toBe(true);
    expect(f.studioCtx.isUnlogged()).toBe(true);
    if (reason === "mode") {
      f.studioCtx.isInteractiveMode = true;
    } else {
      fireEvent(window, new Event("blur"));
    }
    expect(f.studioCtx.isSpaceDown()).toBe(false);
    expect(f.studioCtx.isUnlogged()).toBe(false);
  } finally { f.dispose(); }
});
