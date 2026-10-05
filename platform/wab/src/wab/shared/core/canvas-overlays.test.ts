import { ensureVariantSetting, mkBaseVariant } from "@/wab/shared/Variants";
import { mkCodeComponent } from "@/wab/shared/code-components/code-components";
import { getCanvasOverlayTargets } from "@/wab/shared/core/canvas-overlays";
import { ComponentType, mkComponent } from "@/wab/shared/core/components";
import {
  codeLit,
  createExprForDataPickerValue,
  customCode,
} from "@/wab/shared/core/exprs";
import { mkParam, mkParamsForState } from "@/wab/shared/core/lang";
import { mkInteraction, mkNamedState } from "@/wab/shared/core/states";
import { mkTplComponent, mkTplTagX } from "@/wab/shared/core/tpls";
import {
  Arg,
  EventHandler,
  RenderExpr,
  isKnownTplTag,
} from "@/wab/shared/model/classes";
import { typeFactory } from "@/wab/shared/model/model-util";

const base = mkBaseVariant();
function prop(name: string) {
  return mkParam({ name, paramType: "prop", type: typeFactory.any() });
}
function fixture() {
  const label = mkTplTagX("span", { baseVariant: base });
  const button = mkTplTagX("button", { baseVariant: base }, [label]);
  const wrapperComponent = mkCodeComponent(
    "Dropdown",
    { name: "Dropdown", importPath: "overlay-test", props: {} },
    {},
  );
  wrapperComponent.params.push(
    prop("previewOpen"),
    prop("open"),
    prop("onAction"),
    mkParam({
      name: "children",
      paramType: "slot",
      type: typeFactory.renderable(),
    }),
  );
  const wrapper = mkTplComponent(wrapperComponent, base, {}, [button]);
  const modalComponent = mkCodeComponent(
    "Modal",
    { name: "Modal", importPath: "overlay-test", props: {} },
    {},
  );
  modalComponent.params.push(prop("previewOpen"), prop("open"));
  const modal = mkTplComponent(modalComponent, base, {
    open: customCode("$state.action === 'export'"),
  });
  const { valueParam, onChangeParam } = mkParamsForState({
    name: "action",
    variableType: "text",
    accessType: "private",
    onChangeProp: "onActionChange",
  });
  const component = mkComponent({
    name: "Page",
    type: ComponentType.Plain,
    tplTree: mkTplTagX("div", { baseVariant: base }, [wrapper, modal]),
    states: [
      mkNamedState({
        name: "action",
        variableType: "text",
        param: valueParam,
        onChangeParam,
      }),
    ],
  });
  const context = {
    getMeta: () => ({
      canvasOverlay: { triggerSlot: "children" },
      canvasEventBindings: [
        {
          slot: "menuItems",
          event: "onAction",
          args: { key: { prop: "key" } },
        },
      ],
    }),
    getProp: () => undefined,
  };
  return { label, button, wrapper, modal, component, context };
}

test("selecting a wrapper child exposes its ancestor overlay without selecting the wrapper", () => {
  const { label, button, wrapper, component, context } = fixture();
  expect(
    getCanvasOverlayTargets(component, [label, button, wrapper], context),
  ).toEqual([wrapper]);
});

test("a button handler exposes a sibling modal without executing the handler or changing open", () => {
  const { label, button, modal, component } = fixture();
  const open = modal.vsettings[0].args[0].expr;
  ensureVariantSetting(button, [base]).attrs.onClick = customCode(
    "() => { externalSideEffect(); $state.action = 'export'; }",
  );
  expect(getCanvasOverlayTargets(component, [label, button])).toEqual([modal]);
  expect(modal.vsettings[0].args[0].expr).toBe(open);
});

test("Plasmic updateVariable interactions also expose the related modal", () => {
  const { button, modal, component } = fixture();
  const handler = new EventHandler({ interactions: [] });
  handler.interactions.push(
    mkInteraction(handler, "updateVariable", "Open export", {
      variable: customCode("$state.action"),
      value: customCode("'export'"),
    }),
  );
  ensureVariantSetting(button, [base]).attrs.onClick = handler;
  expect(getCanvasOverlayTargets(component, [button])).toEqual([modal]);
});

test("reading state in a label does not associate unrelated modals", () => {
  const { button, component } = fixture();
  ensureVariantSetting(button, [base]).attrs.title =
    customCode("$state.action");
  expect(getCanvasOverlayTargets(component, [button])).toEqual([]);
});

test("a wrapper handler never adds sibling modals to its own controls", () => {
  const { label, button, wrapper, component, context } = fixture();
  wrapper.vsettings[0].args.push(
    new Arg({
      param: wrapper.component.params[2],
      expr: customCode("key => { $state.action = key; }"),
    }),
  );
  expect(
    getCanvasOverlayTargets(component, [label, button, wrapper], context),
  ).toEqual([wrapper]);
  expect(getCanvasOverlayTargets(component, [wrapper])).toEqual([wrapper]);
});

test("nested overlays expose only the closest overlay", () => {
  const { wrapper, modal, component } = fixture();
  expect(getCanvasOverlayTargets(component, [modal, wrapper])).toEqual([modal]);
});

function delegatedFixture() {
  const setup = fixture();
  const itemComponent = mkCodeComponent(
    "Action item",
    { name: "Action item", importPath: "overlay-test", props: {} },
    {},
  );
  itemComponent.params.push(
    prop("key"),
    mkParam({
      name: "children",
      paramType: "slot",
      type: typeFactory.renderable(),
    }),
  );
  const item = mkTplComponent(itemComponent, base, { key: codeLit("export") }, [
    setup.label,
  ]);
  const slot = mkParam({
    name: "menuItems",
    paramType: "slot",
    type: typeFactory.renderable(),
  });
  setup.wrapper.component.params.push(slot);
  setup.wrapper.vsettings[0].args.push(
    new Arg({ param: slot, expr: new RenderExpr({ tpl: [item] }) }),
  );
  setup.wrapper.vsettings[0].args.push(
    new Arg({
      param: setup.wrapper.component.params[2],
      expr: createExprForDataPickerValue(
        "if(key==='export'){$state.action='export';}",
        null,
        true,
        ["key"],
      ),
    }),
  );
  const unrelated = mkTplComponent(setup.modal.component, base, {
    open: customCode("$state.action === 'edit'"),
  });
  if (isKnownTplTag(setup.component.tplTree))
    setup.component.tplTree.children.push(unrelated);
  return { ...setup, item, unrelated };
}

test("delegated item action exposes only the modal whose open condition becomes true", () => {
  const { component, label, item, wrapper, modal, context } =
    delegatedFixture();
  expect(getCanvasOverlayTargets(component, [item, wrapper], context)).toEqual([
    modal,
  ]);
  expect(
    getCanvasOverlayTargets(component, [label, item, wrapper], context),
  ).toEqual([modal]);
  expect(getCanvasOverlayTargets(component, [wrapper], context)).toEqual([
    wrapper,
  ]);
});

test("a delegated content item with no opening action never controls its parent overlay", () => {
  const { component, item, wrapper, context } = delegatedFixture();
  item.vsettings[0].args[0].expr = codeLit("navigate");
  expect(getCanvasOverlayTargets(component, [item, wrapper], context)).toEqual(
    [],
  );
});

test("ordinary content is not a trigger even without event delegation", () => {
  const { component, item, wrapper, context } = delegatedFixture();
  const withoutDelegation = {
    ...context,
    getMeta: () => ({ canvasOverlay: { triggerSlot: "children" } }),
  };
  expect(
    getCanvasOverlayTargets(component, [item, wrapper], withoutDelegation),
  ).toEqual([]);
});

test("an explicit action inside content takes priority over the parent's trigger", () => {
  const { component, item, wrapper, modal, context } = delegatedFixture();
  item.vsettings[0].attrs.onClick = customCode(
    "() => {$state.action='export'}",
  );
  expect(getCanvasOverlayTargets(component, [item, wrapper], context)).toEqual([
    modal,
  ]);
});

test("undeclared delegation and unknown keys never guess all shared-state modals", () => {
  const { component, item, wrapper, context } = delegatedFixture();
  expect(getCanvasOverlayTargets(component, [item, wrapper])).toEqual([]);
  const unknownKey = { ...context, getProp: () => ({ dynamic: true }) };
  expect(
    getCanvasOverlayTargets(component, [item, wrapper], unknownKey),
  ).toEqual([]);
});

test("selecting an overlay content slot is distinct from selecting the overlay itself", () => {
  const { component, wrapper, context } = fixture();
  expect(
    getCanvasOverlayTargets(component, [wrapper], {
      ...context,
      selectedSlot: "menuItems",
    }),
  ).toEqual([]);
  expect(
    getCanvasOverlayTargets(component, [wrapper], {
      ...context,
      selectedSlot: "children",
    }),
  ).toEqual([wrapper]);
});

test("content of a nested overlay cannot inherit an outer trigger control", () => {
  const { component, label, wrapper, modal, context } = fixture();
  const body = mkParam({
    name: "children",
    paramType: "slot",
    type: typeFactory.renderable(),
  });
  modal.component.params.push(body);
  modal.vsettings[0].args.push(
    new Arg({ param: body, expr: new RenderExpr({ tpl: [label] }) }),
  );
  const trigger = wrapper.vsettings[0].args.find(
    (arg) => arg.param.variable.name === "children",
  );
  if (trigger) trigger.expr = new RenderExpr({ tpl: [modal] });
  const nestedContext = {
    ...context,
    getMeta: (tpl: typeof wrapper) => ({
      canvasOverlay: tpl === wrapper ? { triggerSlot: "children" } : {},
    }),
  };
  expect(
    getCanvasOverlayTargets(component, [label, modal, wrapper], nestedContext),
  ).toEqual([]);
});
