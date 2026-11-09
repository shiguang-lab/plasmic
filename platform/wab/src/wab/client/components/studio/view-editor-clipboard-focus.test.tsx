import { fakeStudioCtx } from "@/wab/client/__testonly__/fake-init-ctx";
import { PreviewCtx } from "@/wab/client/components/live/PreviewCtx";
import { ViewEditorController } from "@/wab/client/components/studio/view-editor";
import { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { waitFor } from "@testing-library/react";
import { mock } from "vitest-mock-extended";

beforeEach(() => {
  vi.spyOn(window, "focus").mockImplementation(() => undefined);
  vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
});
afterEach(() => {
  document.body.innerHTML = "";
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

async function fixture() {
  const { studioCtx } = fakeStudioCtx();
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
  const viewport = outline.appendChild(document.createElement("div"));
  viewport.setAttribute("data-overlayscrollbars-viewport", ""); viewport.tabIndex = -1;
  const clipboardEvent = (type: "copy" | "cut" | "paste") => {
    const event = new Event(type, { bubbles: true, cancelable: true });
    Object.defineProperty(event, "clipboardData", { value: { items: [], setData: vi.fn(), getData: vi.fn() } });
    document.activeElement?.dispatchEvent(event);
    return event;
  };
  return { studioCtx, view, copy, cut, paste, bottomModal, viewport, clipboardEvent,
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

it.each(["bottom-modal", "non-dev-mode"] as const)("keeps the %s clipboard guard even when the outline viewport is focused", async (guard) => {
  const f = await fixture();
  try {
    if (guard === "bottom-modal") { f.bottomModal.mockReturnValue(true); }
    else { vi.spyOn(f.studioCtx, "isDevMode", "get").mockReturnValue(false); }
    f.viewport.focus();
    for (const type of ["copy", "cut", "paste"] as const) {
      expect(f.clipboardEvent(type).defaultPrevented).toBe(false);
    }
    expect(f.copy).not.toHaveBeenCalled(); expect(f.cut).not.toHaveBeenCalled(); expect(f.paste).not.toHaveBeenCalled();
  } finally { f.dispose(); }
});
