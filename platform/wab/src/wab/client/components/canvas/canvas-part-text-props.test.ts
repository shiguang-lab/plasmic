import { fakeStudioCtx } from "@/wab/client/__testonly__/fake-init-ctx";
import { ViewOps } from "@/wab/client/components/canvas/view-ops";
import { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { VariantTplMgr } from "@/wab/shared/VariantTplMgr";
import { mkBaseVariant } from "@/wab/shared/Variants";
import { mkCodeComponent } from "@/wab/shared/code-components/code-components";
import { codeLit, tryExtractJson } from "@/wab/shared/core/exprs";
import { mkParam } from "@/wab/shared/core/lang";
import { mkTplComponent } from "@/wab/shared/core/tpls";
import { CustomCode, RenderExpr, TemplatedString } from "@/wab/shared/model/classes";
import { ValComponent } from "@/wab/shared/core/val-nodes";
import $ from "jquery";
import { updateOrCreateExpr } from "@/wab/client/components/sidebar-tabs/PropEditorRow";
import { typeFactory } from "@/wab/shared/model/model-util";
import { notification } from "antd";
import { mock } from "vitest-mock-extended";

afterEach(() => { document.body.innerHTML = ""; vi.restoreAllMocks(); });

it("keeps primitive slot property edits as expressions rather than creating text nodes", () => {
  const type = typeFactory.renderable();
  const component = mkCodeComponent("Button", { name: "Button", importPath: "./Button", props: {} }, {});
  const tpl = mkTplComponent(component, mkBaseVariant(), []);
  const viewCtx = mock<ViewCtx>();
  const expr = updateOrCreateExpr(codeLit("新建模板"), type, "创建", tpl, viewCtx);
  expect(tryExtractJson(expr)).toBe("创建");
  expect(expr).toBeInstanceOf(CustomCode);
  const binding = new CustomCode({ code: "$state.label", fallback: codeLit("创建") });
  expect(updateOrCreateExpr(expr, type, binding, tpl, viewCtx)).toBe(binding);
});

it.each([codeLit("取消"), new TemplatedString({ text: ["取", "消"] })])(
  "writes the existing prop through the normal variant transaction, without a canvas node",
  (expr) => {
    const { studioCtx } = fakeStudioCtx();
    const vc = mock<ViewCtx>();
    const vtm = mock<VariantTplMgr>();
    const component = mkCodeComponent("Dialog", { name: "Dialog", importPath: "./Dialog", props: {} }, {});
    const param = mkParam({ name: "cancelText", paramType: "prop", type: typeFactory.text() });
    component.params.push(param);
    const tpl = mkTplComponent(component, mkBaseVariant(), []);
    const button = document.body.appendChild(document.createElement("button"));
    button.innerHTML = "<span>取 消</span>";
    const part = { tpl, element: button, name: "cancel", selector: "button", displayName: "Cancel button", props: ["cancelText"], text: { prop: "cancelText", selector: "span" } };
    Reflect.set(vc, "studioCtx", studioCtx);
    Reflect.set(vc, "editingComponentPartText", undefined);
    Reflect.set(vc, "canvasCtx", { resetCanvasOverlay: vi.fn(), updateCanvasOverlay: vi.fn() });
    Reflect.set(vc, "site", studioCtx.site);
    Reflect.set(vc, "focusedComponentPart", part);
    vc.currentComponent.mockReturnValue(component);
    vc.variantTplMgr.mockReturnValue(vtm);
    vc.effectiveCurrentVariantSetting.mockReturnValue({ args: [{ param, expr }], getArgSource: () => undefined } as any);
    vc.change.mockImplementation((f: any) => f());
    vtm.getTargetIndicatorComboForNode.mockReturnValue([component.variants[0]]);
    const ops = new ViewOps({ viewCtx: vc });
    try {
      ops.tryEditText();
      const editor = vc.editingComponentPartText!;
      expect(editor.input.value).toBe("取消");
      expect(ops.isEditing(editor.input)).toBe(true);
      editor.input.value = "返回";
      editor.finish();
      expect(vc.change).toHaveBeenCalledOnce();
      expect(vtm.setArg).toHaveBeenCalledOnce();
      const [target, variable, next] = vtm.setArg.mock.calls[0];
      expect(target).toBe(tpl);
      expect(variable).toBe(param.variable);
      expect(tryExtractJson(next)).toBe("返回");
      expect(vc.editingComponentPartText).toBeUndefined();
      expect(tpl.vsettings[0].args).toEqual([]);
    } finally { studioCtx.dispose(); }
  },
);

it("keeps a dynamic text binding and directs editing to its existing property control", () => {
  const { studioCtx } = fakeStudioCtx();
  const vc = mock<ViewCtx>();
  const vtm = mock<VariantTplMgr>();
  const component = mkCodeComponent("Dialog", { name: "Dialog", importPath: "./Dialog", props: {} }, {});
  const param = mkParam({ name: "okText", paramType: "prop", type: typeFactory.text() });
  component.params.push(param);
  const tpl = mkTplComponent(component, mkBaseVariant(), []);
  const expr = new CustomCode({ code: "$state.label", fallback: null });
  Reflect.set(vc, "studioCtx", studioCtx);
  Reflect.set(vc, "editingComponentPartText", undefined);
  Reflect.set(vc, "site", studioCtx.site);
  Reflect.set(vc, "focusedComponentPart", { tpl, props: ["okText"], text: { prop: "okText", selector: "span" } });
  vc.currentComponent.mockReturnValue(component);
  vc.variantTplMgr.mockReturnValue(vtm);
  vc.effectiveCurrentVariantSetting.mockReturnValue({ args: [{ param, expr }], getArgSource: () => undefined } as any);
  vtm.getTargetIndicatorComboForNode.mockReturnValue([component.variants[0]]);
  vi.spyOn(notification, "info").mockImplementation(() => {});
  try {
    new ViewOps({ viewCtx: vc }).tryEditText();
    expect(vc.editingComponentPartText).toBeUndefined();
    expect(vtm.setArg).not.toHaveBeenCalled();
    expect(vc.highlightParams).toEqual({ tpl, params: [param] });
    expect(expr.code).toBe("$state.label");
  } finally { studioCtx.dispose(); }
});

it("edits primitive slot content on its component and leaves a structured slot intact", () => {
  const { studioCtx } = fakeStudioCtx();
  const vc = mock<ViewCtx>();
  const vtm = mock<VariantTplMgr>();
  const component = mkCodeComponent("Button", { name: "Button", importPath: "./Button", props: {} }, {});
  const param = mkParam({ name: "children", paramType: "slot", type: typeFactory.renderable(), mergeWithParent: true });
  component.params.push(param);
  const tpl = mkTplComponent(component, mkBaseVariant(), []);
  const button = document.body.appendChild(document.createElement("button"));
  button.innerHTML = "<span>新建模板</span>";
  const owner = new ValComponent({ tpl } as any);
  const effective = { args: [{ param, expr: codeLit("新建模板") as import("@/wab/shared/model/classes").Expr }], getArgSource: () => undefined };
  Reflect.set(vc, "studioCtx", studioCtx);
  Reflect.set(vc, "site", studioCtx.site);
  Reflect.set(vc, "canvasCtx", { resetCanvasOverlay: vi.fn(), updateCanvasOverlay: vi.fn() });
  Reflect.set(vc, "renderState", { sel2dom: () => $(button) });
  Reflect.set(vc, "editingComponentPartText", undefined);
  vc.focusedSelectable.mockReturnValue(owner);
  Reflect.set(vc, "focusedComponentPart", undefined);
  vc.getCodeComponentMeta.mockReturnValue({ canvasText: { prop: "children", selector: "span" } } as any);
  vc.currentComponent.mockReturnValue(component);
  vc.variantTplMgr.mockReturnValue(vtm);
  vc.effectiveCurrentVariantSetting.mockReturnValue(effective as any);
  vc.change.mockImplementation((f: any) => f());
  vtm.getTargetIndicatorComboForNode.mockReturnValue([component.variants[0]]);
  const ops = new ViewOps({ viewCtx: vc });
  try {
    ops.tryEditText();
    const editor = vc.editingComponentPartText!;
    expect(editor.input.value).toBe("新建模板");
    editor.input.value = "创建";
    editor.input.dispatchEvent(new Event("input"));
    editor.finish();
    expect(vtm.setArg).toHaveBeenCalledOnce();
    expect(tryExtractJson(vtm.setArg.mock.calls[0][2])).toBe("创建");
    expect(tpl.vsettings[0].args).toEqual([]);
    expect(vc.setFocusedComponentPart).not.toHaveBeenCalled();
    const complex = new RenderExpr({ tpl: [] });
    effective.args[0].expr = complex;
    const fallback = vi.spyOn(ops as any, "getFocusObjForEditText").mockReturnValue(undefined);
    ops.tryEditText();
    expect(fallback).toHaveBeenCalledWith(owner);
    expect(vc.editingComponentPartText).toBeUndefined();
    expect(effective.args[0].expr).toBe(complex);
  } finally { studioCtx.dispose(); }
});
