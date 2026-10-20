import { registrationContract, withRegisteredContracts } from "@/wab/shared/copilot/model-read";

test("contract reads preserve return-function signatures and nested registration fields without executing callbacks", () => {
  const callback = vi.fn(() => { throw new Error("Must not run metadata"); });
  const registration = {
    type: "object", fields: {
      renderSummary: { type: "function", argNames: ["total", "range"], argValues: callback },
      items: { type: "array", itemType: { type: "object", fields: { key: "string", enabled: "boolean" } } },
      onChange: { type: "eventHandler", argTypes: [{ name: "value", type: "number" }] },
      selection: { type: "choice", options: callback },
      custom: { type: "custom", control: callback },
    },
  };
  const result = registrationContract(registration);
  expect(result).toMatchObject({ type: "object", fields: {
    renderSummary: { type: "function", args: [{ name: "total", type: "any" }, { name: "range", type: "any" }] },
    items: { type: "array", itemType: { type: "object", fields: { key: { type: "string" }, enabled: { type: "boolean" } } } },
    onChange: { type: "eventHandler", args: [{ name: "value", type: "number" }] },
    selection: { type: "choice", optionsDynamic: true }, custom: { type: "custom" },
  } });
  expect(callback).not.toHaveBeenCalled();
  const props = [{ name: "settings", type: "any", uuid: "native-param" }];
  expect(withRegisteredContracts(props, { settings: registration })[0]).toEqual({ ...props[0], registration: result });
  expect(props[0]).not.toHaveProperty("registration");
  const recursive: Record<string, unknown> = { type: "object" };
  recursive.fields = { self: recursive };
  expect(registrationContract(recursive)).toEqual({ type: "object", fields: {} });
});

test("existing normalized signatures, descriptions and choices are not repeated in registration metadata", () => {
  const props = [{ name: "choose", description: "Choose one", type: "enum", options: [{ value: "one", label: "one" }] },
    { name: "onChange", type: "func", args: [{ name: "value", type: "number" }] }];
  const result = withRegisteredContracts(props, {
    choose: { type: "choice", description: "Choose one", options: ["one"] },
    onChange: { type: "eventHandler", argTypes: [{ name: "value", type: "number" }] },
  });
  expect(result[0].registration).toEqual({ type: "choice" });
  expect(result[1].registration).toEqual({ type: "eventHandler" });
});
