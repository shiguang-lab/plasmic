import { FrameContextData } from "@/wab/client/react-global-hook/frame-context-data";
import { act, render, renderHook } from "@testing-library/react";
import { Form, Input } from "antd";
import React from "react";

it("publishes only the changed context key and retains deep no-op identities", () => {
  const data = new FrameContextData();
  const first = data.getStore("first"), second = data.getStore("second");
  const changed = vi.fn(), untouched = vi.fn();
  first.subscribe(changed); second.subscribe(untouched);
  const value = { options: ["one"] };
  data.set("first", value);
  const committed = first.getState();
  expect(committed).toBe(value);
  data.set("first", { options: ["one"] });
  expect(first.getState()).toBe(committed);
  expect(changed).toHaveBeenCalledTimes(1);
  expect(untouched).not.toHaveBeenCalled();
  data.dispose();
  expect(first.getState()).toBeUndefined();
  expect(changed).toHaveBeenCalledTimes(2);
  data.set("first", { options: ["after disposal"] });
  expect(changed).toHaveBeenCalledTimes(2);
});

it("preserves a connected Form's command handle and runtime payload identity", () => {
  const data = new FrameContextData();
  const hook = renderHook(() => Form.useForm());
  const [form] = hook.result.current;
  const view = render(React.createElement(Form, { form },
    React.createElement(Form.Item, { name: "label" }, React.createElement(Input)),
  ));
  const payload = { formInstance: form, layout: "horizontal", internalFieldCtx: { registeredFields: [] } };
  const store = data.getStore("form");
  const changed = vi.fn();
  store.subscribe(changed);
  data.set("form", payload);
  // A copied plain FormInstance can contain the same functions yet violate the
  // registered control-context contract. Keep the actual payload and handle.
  expect(store.getState()).toBe(payload);
  data.set("form", { ...payload });
  expect(store.getState()).toBe(payload);
  expect(changed).toHaveBeenCalledTimes(1);
  act(() => payload.formInstance.setFieldValue("label", "updated through context"));
  expect(view.getByDisplayValue("updated through context")).toBeTruthy();
  view.unmount(); hook.unmount(); data.dispose();
});
