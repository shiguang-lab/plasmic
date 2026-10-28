import { fakeStudioCtx } from "@/wab/client/__testonly__/fake-init-ctx";
import { CanvasCtx } from "@/wab/client/components/canvas/canvas-ctx";
import { ViewOps } from "@/wab/client/components/canvas/view-ops";
import { PreviewCtx } from "@/wab/client/components/live/PreviewCtx";
import { ViewEditor } from "@/wab/client/components/studio/view-editor";
import { CanvasContentEditor } from "@/wab/client/studio-ctx/canvas-content-editor";
import { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { mkTplTagX } from "@/wab/shared/core/tpls";
import { notification } from "antd";
import $ from "jquery";
import { mock } from "vitest-mock-extended";

afterEach(() => {
  document.body.innerHTML = "";
  vi.restoreAllMocks();
});

function fixture() {
  const { studioCtx } = fakeStudioCtx();
  const source = mock<ViewCtx>();
  Object.defineProperty(source, "studioCtx", { value: studioCtx });
  const canvas = mock<CanvasCtx>();
  const viewOps = mock<ViewOps>();
  Object.defineProperty(source, "canvasCtx", { value: canvas });
  Object.defineProperty(source, "contentEditor", { value: new CanvasContentEditor(source) });
  source.getViewOps.mockReturnValue(viewOps);
  canvas.$body.mockReturnValue($(document.body));
  const ancestor = document.body.appendChild(document.createElement("section"));
  const root = ancestor.appendChild(document.createElement("div"));
  root.setAttribute("data-plasmic-content-target", "");
  const cell = root.appendChild(document.createElement("span"));
  const sibling = ancestor.appendChild(document.createElement("aside"));
  const target = vi.spyOn(source.contentEditor, "target", "get").mockReturnValue({
    tpl: mkTplTagX("div"), fullKey: "target", element: root,
  });
  const editor = new ViewEditor({ studioCtx, viewCtx: source,
    previewCtx: mock<PreviewCtx>(), canvasLoading: false });
  const eventFor = (element: HTMLElement) => {
    const event = new MouseEvent("pointerdown", { bubbles: true, cancelable: true });
    element.dispatchEvent(event);
    return event;
  };
  return { studioCtx, source, viewOps, ancestor, root, cell, sibling, target, editor, eventFor };
}

it("limits selection, hover and context-menu hit testing to the isolated component's current DOM", () => {
  const f = fixture();
  try {
    const extract = (element: HTMLElement) =>
      Reflect.get(f.editor, "extractEventTarget").call(f.editor, f.eventFor(element), f.source);
    expect(extract(f.root)[1]).toBe(f.source);
    expect(extract(f.cell)[1]).toBe(f.source);
    for (const outside of [f.ancestor, f.sibling, document.body]) {
      expect(extract(outside)[1]).toBeUndefined();
    }
    // React can replace the rendered root while the editing target is retained.
    const replacement = f.root.cloneNode(true) as HTMLElement;
    f.root.replaceWith(replacement);
    expect(extract(replacement)[1]).toBe(f.source);
    f.target.mockReturnValue(undefined);
    expect(extract(f.ancestor)[1]).toBe(f.source);
  } finally {
    f.studioCtx.dispose();
  }
});

it("treats the iframe gutter as canvas background without unknown-element warnings or parent hover", async () => {
  const f = fixture();
  try {
    const warning = vi.spyOn(notification, "warning");
    const focusFrame = vi.spyOn(f.studioCtx, "setStudioFocusOnFrame").mockImplementation(() => undefined);
    const event = f.eventFor(f.ancestor);
    await Reflect.get(f.editor, "handleMouseDown").call(f.editor, event, f.source);
    expect(warning).not.toHaveBeenCalled();
    expect(focusFrame).toHaveBeenCalledWith({ frame: undefined, autoZoom: false });
    Reflect.get(f.editor, "genericHandleMouseOver").call(f.editor, event, f.source);
    expect(f.viewOps.tryHoverObj).toHaveBeenCalledWith(undefined, { exact: true });
    expect(f.viewOps.tryHoverDomElt).not.toHaveBeenCalled();
    Reflect.get(f.editor, "handleContextMenu").call(f.editor, event, f.source);
    expect(f.viewOps.getFinalFocusable).not.toHaveBeenCalled();
    expect(f.source.contentEditor.target).toBeDefined();
  } finally {
    f.studioCtx.dispose();
  }
});
