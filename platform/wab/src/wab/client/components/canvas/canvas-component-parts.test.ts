import { findCanvasComponentPart } from "@/wab/client/components/canvas/canvas-component-parts";
import { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { mkCodeComponent } from "@/wab/shared/code-components/code-components";
import { mkBaseVariant } from "@/wab/shared/Variants";
import { mkTplComponent } from "@/wab/shared/core/tpls";
import { observable } from "mobx";
import $ from "jquery";

const parts = { confirm: { selector: '[data-part="confirm"]', displayName: "Confirm", props: ["okText", "onOk"] } };
const component = mkCodeComponent("Dialog", { name: "Dialog", importPath: "./Dialog", props: {} }, {});
const tpl = mkTplComponent(component, mkBaseVariant(), []);

afterEach(() => { document.body.innerHTML = ""; });

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
  const view = Object.assign(Object.create(ViewCtx.prototype), {
    _focusedComponentPart: observable.box(undefined, { deep: false }),
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
});
