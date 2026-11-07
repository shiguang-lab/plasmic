import { fakeStudioCtx } from "@/wab/client/__testonly__/fake-init-ctx";
import { CanvasCtx } from "@/wab/client/components/canvas/canvas-ctx";
import { ViewOps } from "@/wab/client/components/canvas/view-ops";
import { PreviewCtx } from "@/wab/client/components/live/PreviewCtx";
import { ViewEditor_ } from "@/wab/client/components/studio/view-editor";
import { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { RightTabKey } from "@/wab/client/studio-ctx/StudioCtx";
import { mkCodeComponent } from "@/wab/shared/code-components/code-components";
import { mkBaseVariant } from "@/wab/shared/Variants";
import { mkTplComponent } from "@/wab/shared/core/tpls";
import { ValComponent } from "@/wab/shared/core/val-nodes";
import $ from "jquery";
import { mock } from "vitest-mock-extended";

vi.mock("@/wab/client/components/canvas/studio-canvas-util", async (original) => ({
  ...await original<typeof import("@/wab/client/components/canvas/studio-canvas-util")>(),
  closestTaggedNonTextDomElt: (target: JQuery) => target.closest("[data-owner]"),
}));

afterEach(() => { document.body.innerHTML = ""; vi.restoreAllMocks(); });

it("selects the native part's owner and props without starting a drag or a deep-selection click", async () => {
  const { studioCtx } = fakeStudioCtx();
  const source = mock<ViewCtx>();
  const canvas = mock<CanvasCtx>();
  const viewOps = mock<ViewOps>();
  Reflect.set(source, "studioCtx", studioCtx);
  Reflect.set(source, "canvasCtx", canvas);
  Reflect.set(source, "viewOps", viewOps);
  const component = mkCodeComponent("Dialog", { name: "Dialog", importPath: "./Dialog", props: {} }, {});
  const tpl = mkTplComponent(component, mkBaseVariant(), []);
  const owner = new ValComponent({ tpl } as any);
  const root = document.body.appendChild(document.createElement("section"));
  root.dataset.owner = "";
  root.innerHTML = '<button data-part="ok"><span>Next</span></button>';
  source.getViewOps.mockReturnValue(viewOps);
  source.dom2focusObj.mockReturnValue(owner);
  source.sel2cloneKey.mockReturnValue("instance[1]");
  source.getCodeComponentMeta.mockReturnValue({ canvasParts: { ok: { selector: '[data-part="ok"]', displayName: "Confirm button", props: ["okText", "onOk"] } } } as any);
  source.changeSelection.mockImplementation((callback) => callback());
  source.change.mockImplementation((callback: any) => callback());
  canvas.$wabInternalElements.mockReturnValue([]);
  const tab = vi.spyOn(studioCtx, "switchRightTab");
  const editor = new ViewEditor_({
    renderInteractive: studioCtx.renderPolicy.store.getState().interactive,
    renderDocs: studioCtx.renderPolicy.store.getState().docs,
    renderDevMode: studioCtx.renderPolicy.store.getState().devMode,
    panelsHidden: studioCtx.leftPanelState.panelsHidden,
    studioCtx, viewCtx: source, previewCtx: mock<PreviewCtx>(), canvasLoading: false });
  vi.spyOn(editor as any, "extractEventTarget").mockImplementation(() => [$(root.querySelector("span")!), source]);
  const event = new MouseEvent("pointerdown", { bubbles: true, cancelable: true, button: 0 });
  root.querySelector("span")!.dispatchEvent(event);
  try {
    await Reflect.get(editor, "handleMouseDown").call(editor, event, source);
    expect(viewOps.tryFocusObj).toHaveBeenCalledWith(owner, { exact: true, anchorCloneKey: "instance[1]" });
    expect(source.setFocusedComponentPart).toHaveBeenLastCalledWith(expect.objectContaining({ tpl, name: "ok", element: root.querySelector("button") }));
    expect(tab).toHaveBeenCalledWith(RightTabKey.style);
    expect(Reflect.get(editor, "dragState")).toBeUndefined();
    expect(Reflect.get(editor, "pendingCanvasClick")).toMatchObject({ componentPart: true });
    expect(event.defaultPrevented).toBe(true);
    const release = new MouseEvent("pointerup", { bubbles: true, button: 0 });
    root.querySelector("span")!.dispatchEvent(release);
    await Reflect.get(editor, "handleMouseUp").call(editor, release, source);
    expect(viewOps.tryEditText).not.toHaveBeenCalled();
    // Canvas reconciliation can replace native DOM while keeping the same model target.
    root.innerHTML = '<button data-part="ok"><span>Next</span></button>';
    const second = new MouseEvent("pointerdown", { bubbles: true, cancelable: true, button: 0 });
    root.querySelector("span")!.dispatchEvent(second);
    await Reflect.get(editor, "handleMouseDown").call(editor, second, source);
    const secondRelease = new MouseEvent("pointerup", { bubbles: true, button: 0 });
    root.querySelector("span")!.dispatchEvent(secondRelease);
    await Reflect.get(editor, "handleMouseUp").call(editor, secondRelease, source);
    expect(viewOps.tryEditText).toHaveBeenCalledOnce();
    expect(viewOps.deepFocusElement).not.toHaveBeenCalled();
  } finally { studioCtx.dispose(); }
});
