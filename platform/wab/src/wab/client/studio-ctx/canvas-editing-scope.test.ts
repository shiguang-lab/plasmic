import { buildValTree } from "@/wab/__testonly__/tpls";
import { fakeStudioCtx } from "@/wab/client/__testonly__/fake-init-ctx";
import { getMarqueeFrames } from "@/wab/client/components/canvas/marquee-selection";
import { getFrameSelectionBounds } from "@/wab/client/components/canvas/selection-bounds";
import { CanvasContentEditor } from "@/wab/client/studio-ctx/canvas-content-editor";
import { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { ensure, ensureInstance } from "@/wab/shared/common";
import { mkComponent, ComponentType } from "@/wab/shared/core/components";
import { mkTplComponent, mkTplTag } from "@/wab/shared/core/tpls";
import { flattenVals, ValTag, ValNode } from "@/wab/shared/core/val-nodes";
import { ValState } from "@/wab/shared/eval/val-state";
import { Box } from "@/wab/shared/geom";
import { mock } from "vitest-mock-extended";

afterEach(() => { document.body.innerHTML = ""; vi.restoreAllMocks(); });

function fixture() {
  const leaf = mkTplTag("span");
  const rootTpl = mkTplTag("section", [leaf]);
  const outsideTpl = mkTplTag("aside");
  const component = mkComponent({ name: "Page", type: ComponentType.Page,
    tplTree: mkTplTag("main", [rootTpl, outsideTpl]) });
  const owner = buildValTree(mkTplComponent(component, ensure(component.variants[0])));
  const vals = flattenVals(owner);
  const root = ensureInstance(vals.find((val) => val.tpl === rootTpl), ValTag);
  const child = ensureInstance(vals.find((val) => val.tpl === leaf), ValTag);
  const outside = ensureInstance(vals.find((val) => val.tpl === outsideTpl), ValTag);
  const ancestor = ensureInstance(owner.contents?.[0], ValTag);
  const { studioCtx } = fakeStudioCtx();
  const vc = mock<ViewCtx>();
  Object.defineProperty(vc, "studioCtx", { value: studioCtx });
  const editor = new CanvasContentEditor(vc);
  Object.defineProperty(vc, "contentEditor", { value: editor });
  studioCtx.viewCtxs.push(vc);
  vi.spyOn(studioCtx, "focusedViewCtx").mockReturnValue(vc);
  vc.valState.mockReturnValue(new ValState({ sysRoot: owner, globalRoot: undefined }));
  vc.maybeTpl2ValsInContext.mockImplementation((tpl) => vals.filter((val) => val.tpl === tpl));
  const outerElement = document.body.appendChild(document.createElement("main"));
  const rootElement = outerElement.appendChild(document.createElement("section"));
  const childElement = rootElement.appendChild(document.createElement("span"));
  const outsideElement = outerElement.appendChild(document.createElement("aside"));
  const doms = new Map<ValNode, HTMLElement>([[root, rootElement], [child, childElement], [outside, outsideElement], [ancestor, outerElement]]);
  vc.eltFinder.mockImplementation((val) => doms.has(val) ? [ensure(doms.get(val))] : []);
  const target = vi.spyOn(editor, "target", "get").mockReturnValue({tpl: rootTpl, fullKey: root.fullKey, element: rootElement});
  return { studioCtx, vc, editor, root, child, outside, ancestor, rootElement, childElement, outsideElement, outerElement, target };
}

it("shares one root boundary across selection and rendered elements, including nodes with no DOM", () => {
  const f = fixture();
  try {
    expect(f.editor.root).toBe(f.root);
    expect(f.editor.contains(f.root)).toBe(true);
    expect(f.editor.contains(f.child)).toBe(true);
    expect(f.editor.contains(f.ancestor)).toBe(false);
    expect(f.editor.contains(f.outside)).toBe(false);
    expect(f.editor.containsTpl(f.child.tpl)).toBe(true);
    expect(f.editor.containsTpl(f.outside.tpl)).toBe(false);
    expect(f.editor.containsElement(f.childElement)).toBe(true);
    expect(f.editor.containsElement(f.outerElement)).toBe(false);
    f.vc.eltFinder.mockReturnValue([]);
    expect(f.editor.contains(f.child)).toBe(true);
    expect(f.editor.contains(f.outside)).toBe(false);
    f.target.mockReturnValue(undefined);
    expect(f.editor.contains(f.ancestor)).toBe(true);
  } finally { f.studioCtx.viewCtxs.splice(0); f.studioCtx.dispose(); }
});

it("never falls back to an artboard outline or artboard marquee while a content scene is active", () => {
  const f = fixture();
  try {
    f.vc.focusedSelectables.mockReturnValue([]);
    f.vc.focusedSelectable.mockReturnValue(null);
    expect(f.studioCtx.hoverBoxControlledObjs).toEqual([]);
    expect(f.studioCtx.hoverBoxControlledObj).toBeUndefined();
    expect(getMarqueeFrames(f.studioCtx, new Box(0, 0, 5000, 5000))).toEqual([]);
    expect(getFrameSelectionBounds(f.studioCtx)).toBeUndefined();
    f.vc.focusedSelectables.mockReturnValue([f.ancestor, f.child]);
    expect(f.studioCtx.hoverBoxControlledObjs).toEqual([f.child]);
  } finally { f.studioCtx.viewCtxs.splice(0); f.studioCtx.dispose(); }
});

it("excludes other frames and repeated rendered instances from the same active scene", () => {
  const f = fixture();
  try {
    const other = mock<ViewCtx>();
    Object.defineProperty(other, "studioCtx", { value: f.studioCtx });
    const editor = new CanvasContentEditor(other);
    expect(editor.contains(f.child)).toBe(false);
    expect(editor.containsElement(f.childElement)).toBe(false);
    const repeatedRoot = f.rootElement.cloneNode(true) as HTMLElement;
    document.body.append(repeatedRoot);
    expect(f.editor.containsElement(repeatedRoot)).toBe(false);
  } finally { f.studioCtx.viewCtxs.splice(0); f.studioCtx.dispose(); }
});
