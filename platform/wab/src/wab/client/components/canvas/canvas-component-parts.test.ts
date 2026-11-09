import { findCanvasComponentPart, getCanvasComponentPartTarget } from "@/wab/client/components/canvas/canvas-component-parts";
import { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { ModelSnapshots } from "@/wab/client/studio-ctx/model-snapshots";
import { ViewSelection } from "@/wab/client/studio-ctx/view-selection";
import { mkCodeComponent } from "@/wab/shared/code-components/code-components";
import { mkBaseVariant } from "@/wab/shared/Variants";
import { mkTplComponent } from "@/wab/shared/core/tpls";
import $ from "jquery";
import { ValComponent, ValTag } from "@/wab/shared/core/val-nodes";
import { mock } from "vitest-mock-extended";

const parts = { confirm: { selector: '[data-part="confirm"]', displayName: "Confirm", props: ["okText", "onOk"] } };
const component = mkCodeComponent("Dialog", { name: "Dialog", importPath: "./Dialog", props: {} }, {});
const tpl = mkTplComponent(component, mkBaseVariant(), []);

afterEach(() => { document.body.innerHTML = ""; });

it("finds a protected region through editable slot children without treating their component as its owner", () => {
  const root = document.body.appendChild(document.createElement("section"));
  root.innerHTML = '<div data-part="confirm"><span>Brand</span><button>Action</button></div><p>Outside</p>';
  const view = mock<ViewCtx>();
  const owner = new ValComponent({ tpl } as any);
  const childComponent = new ValComponent({ tpl: mkTplComponent(component, mkBaseVariant(), []) } as any);
  const text = new ValTag({} as any);
  view.dom2focusObj.mockImplementation(($element) => {
    const element = $element[0];
    return element === root ? owner : element instanceof Element && element.matches("button") ? childComponent : text;
  });
  view.getCodeComponentMeta.mockReturnValue({ canvasParts: parts } as any);
  for (const selector of ["span", "button", '[data-part="confirm"]']) {
    expect(getCanvasComponentPartTarget(view, root.querySelector(selector)!)).toMatchObject({ owner, part: { tpl, name: "confirm", element: root.firstElementChild } });
  }
  expect(getCanvasComponentPartTarget(view, root.querySelector("p")!)).toBeUndefined();
});

it("resolves nested click content within its owner without matching another instance or custom footer", () => {
  const owner = document.body.appendChild(document.createElement("section"));
  owner.innerHTML = '<button data-part="confirm"><span>Next</span></button><button>Custom</button>';
  const other = owner.cloneNode(true) as HTMLElement;
  document.body.appendChild(other);
  const part = findCanvasComponentPart(owner.querySelector("span")!, owner, tpl, parts);
  expect(part).toMatchObject({ name: "confirm", tpl, props: ["okText", "onOk"], element: owner.querySelector("button") });
  expect(findCanvasComponentPart(other.querySelector("span")!, owner, tpl, parts)).toBeUndefined();
  expect(findCanvasComponentPart(owner.lastElementChild!, owner, tpl, parts)).toBeUndefined();
  expect(findCanvasComponentPart(owner.querySelector("span")!, owner, tpl, undefined)).toBeUndefined();
});

it("resolves replaced DOM inside the selected instance and drops stale selection", () => {
  const owner = document.body.appendChild(document.createElement("section"));
  owner.innerHTML = '<button data-part="confirm">Next</button>';
  const part = findCanvasComponentPart(owner.firstElementChild!, owner, tpl, parts);
  let selected = tpl;
  const models = new ModelSnapshots();
  const selection = new ViewSelection(() => models);
  const view = Object.assign(Object.create(ViewCtx.prototype), {
    selection,
    studioCtx: { notifyInspectorFocusChanged: vi.fn() },
    focusedTpl: () => selected,
    focusedDomElt: () => $(owner),
  }) as ViewCtx;
  view.setFocusedComponentPart(part);
  expect(view.focusedComponentPart?.element).toBe(owner.firstElementChild);
  owner.innerHTML = '<button data-part="confirm">Changed</button>';
  expect(view.focusedComponentPart?.element).toBe(owner.firstElementChild);
  expect(view.focusedComponentPart?.element).not.toBe(part?.element);
  selected = mkTplComponent(component, mkBaseVariant(), []);
  expect(view.focusedComponentPart).toBeUndefined();
  selected = tpl;
  owner.remove();
  expect(view.focusedComponentPart).toBeUndefined();
  selection.dispose(); models.dispose();
});
