import { FrameContextData } from "@/wab/client/react-global-hook/frame-context-data";
import { InspectorSelection } from "@/wab/client/studio-ctx/inspector-selection";
import type { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { ensure } from "@/wab/shared/common";
import { getContextDependentValue } from "@/wab/shared/context-dependent-value";
import { mkTplTagX } from "@/wab/shared/core/tpls";
import { act, render, renderHook } from "@testing-library/react";
import { Form, Input } from "antd";
import React from "react";
import { registerForm } from "../../../../../../plasmicpkgs/antd6/src/form/registerForm";

it("preserves the real Form command through Inspector and registered action metadata", async () => {
  const warn = vi.spyOn(console, "warn");
  const error = vi.spyOn(console, "error");
  const runtime = new FrameContextData();
  const hook = renderHook(() => Form.useForm());
  const [form] = hook.result.current;
  const view = render(<Form form={form}><Form.Item name="label"><Input /></Form.Item></Form>);
  const payload = { formInstance: form, layout: "horizontal", internalFieldCtx: { registeredFields: [] } };
  runtime.set("form", payload);
  const tpl = mkTplTagX("div");
  const canvas = {
    currentComponentCtx: () => null,
    focusedTpl: () => tpl,
    focusedTpls: () => [tpl],
    focusedSelectable: () => null,
    focusedCloneKey: () => "form-clone",
    getComponentEvalContext: () => ({ componentPropValues: {}, invalidArgs: [], ccContextData: runtime.getStore("form").getState() }),
  } as unknown as ViewCtx;
  const selection = new InspectorSelection(canvas, 1);
  try {
    const context = selection.componentEvalStore(tpl).getState();
    expect(context.ccContextData).toBe(payload);
    expect(context.ccContextData.formInstance).toBe(form);
    expect(Object.isFrozen(context)).toBe(true);
    expect(Object.isFrozen(context.componentPropValues)).toBe(true);
    expect(Object.isFrozen(context.invalidArgs)).toBe(true);
    const registerComponent = vi.fn();
    registerForm({ registerComponent, registerGlobalContext: vi.fn(), registerToken: vi.fn() });
    const metadata = ensure(registerComponent.mock.calls[0]?.[1], "Form registration metadata");
    const selector = metadata.refActions.setFieldValue.argTypes[0].type.data;
    await act(() => context.ccContextData.formInstance.setFieldValue("label", "updated through Inspector"));
    expect(view.getByDisplayValue("updated through Inspector")).toBeTruthy();
    expect(getContextDependentValue(selector, context.componentPropValues, context.ccContextData, { path: [] })).toEqual({ label: "updated through Inspector" });
    expect(context.ccContextData.formInstance).toBe(form);
    expect(warn).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
  } finally {
    selection.dispose(); view.unmount(); hook.unmount(); runtime.dispose(); warn.mockRestore(); error.mockRestore();
  }
});
