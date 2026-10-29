import { registrationContract, withRegisteredContracts, validateRegisteredValue } from "@/wab/shared/copilot/model-read";
import { runInNewContext } from "node:vm";

test("dynamic choices expose metadata without a fake static enum or callback evaluation", () => {
  const options = vi.fn(() => ["id"]);
  const [prop] = withRegisteredContracts([{ name: "rowKey", type: "enum", options: ["Dynamic options"] }], { rowKey: { type: "choice", options } });
  expect(prop).not.toHaveProperty("options");
  expect(prop.registration).toMatchObject({ type: "choice", optionsDynamic: true });
  expect(options).not.toHaveBeenCalled();
});

test("declared custom rule shapes reject raw Antd rules and preserve dynamic bindings", () => {
  const metadata = { type: "formValidationRules", itemType: { type: "object", fields: {
    ruleType: { type: "choice", options: ["required", "regex", "advanced"], required: true }, message: "string", custom: { type: "function", argNames: ["rule", "value"] },
  } } };
  expect(validateRegisteredValue([{ required: true }], metadata, "rules")).toBe("rules[0].ruleType is required");
  expect(validateRegisteredValue([{ ruleType: "unknown" }], metadata, "rules")).toContain("rules[0].ruleType must be one of");
  expect(validateRegisteredValue([{ ruleType: "required", message: "Enter a value" }], metadata, "rules")).toBeUndefined();
  expect(validateRegisteredValue("{{ $state.rules }}", metadata, "rules")).toBeUndefined();
  expect(validateRegisteredValue([{ ruleType: "advanced", custom: "value => true" }], metadata, "rules")).toBe("rules[0].custom expects a function binding");
  expect(validateRegisteredValue([{ ruleType: "advanced", custom: "{{ (rule, value) => value !== '' }}" }], metadata, "rules")).toBeUndefined();
});

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

test("array contracts reject dictionaries even without an item schema", () => {
  expect(validateRegisteredValue({ a: 1 }, { type: "array" }, "items")).toBe("items expects an array");
  expect(validateRegisteredValue([], { type: "array" }, "items")).toBeUndefined();
  expect(validateRegisteredValue("{{ $state.items }}", { type: "array" }, "items")).toBeUndefined();
});

test("contracts distinguish current registered defaults from older stored definition defaults without executing factories", () => {
  const stored = [{ value: "old", label: "Old" }], current = [{ key: "create", label: "Create" }];
  const [prop] = withRegisteredContracts([{ name: "items", default: stored }], { items: { type: "array", defaultValue: current } });
  expect(prop.default).toEqual(stored);
  expect(prop.registration).toEqual({ type: "array", defaultValue: current });
  expect(withRegisteredContracts([{ name: "items", default: current }], { items: { type: "array", defaultValue: current } })[0].registration).toEqual({ type: "array" });
  const factory = vi.fn();
  expect(registrationContract({ type: "object", defaultValue: factory })).toEqual({ type: "object" });
  expect(registrationContract({ type: "object", defaultValue: { toJSON: factory } })).toEqual({ type: "object" });
  const cyclic: Record<string, unknown> = {}; cyclic.self = cyclic;
  expect(registrationContract({ type: "object", defaultValue: cyclic })).toEqual({ type: "object" });
  expect(factory).not.toHaveBeenCalled();
});

test("literal insertion defaults survive the canvas registration realm", () => {
  const metadata = runInNewContext('({type:"array",defaultValue:[{key:"create",label:"Create"}]})');
  const result = registrationContract(metadata);
  expect(result).toEqual({ type: "array", defaultValue: [{ key: "create", label: "Create" }] });
  expect(result?.defaultValue).not.toBe(metadata.defaultValue);
});

test("optional object and template editor metadata preserve the nested string contract", () => {
  const metadata = { type: "object", toggleable: true, fields: {
    formatter: { type: "string", control: "large", templateVariables: ["count", "maxLength"] },
  } };
  expect(registrationContract(metadata)).toEqual({ type: "object", toggleable: true, fields: {
    formatter: { type: "string", templateVariables: ["count", "maxLength"] },
  } });
  expect(validateRegisteredValue({}, metadata, "showCount")).toBeUndefined();
  expect(validateRegisteredValue({ formatter: "{count}/{maxLength}" }, metadata, "showCount")).toBeUndefined();
  expect(validateRegisteredValue({ formatter: () => "count" }, metadata, "showCount")).toBe("showCount.formatter expects a string");
});
