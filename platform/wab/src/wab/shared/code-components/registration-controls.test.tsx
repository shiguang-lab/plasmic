import { _testonly, getPropTypeLayout } from "@/wab/shared/code-components/code-components";
import React from "react";
import { vi } from "vitest";
it("places inline custom controls below their property label", () => {
  const control = () => null;
  expect(getPropTypeLayout({ type: "custom", control, display: "inline" })).toBe("vertical");
  expect(getPropTypeLayout({ type: "custom", control })).toBe("horizontal");
  expect(getPropTypeLayout({ type: "function", argNames: [], argValues: [], control: { type: "custom", control, display: "inline" } })).toBe("vertical");
});

it("validates custom React controls without a browser and still rejects invalid implementations", () => {
  const validate = (control: unknown) => _testonly.typeCheckRegistrations({
    codeComponentsRegistry: { getRegisteredComponentsAndContexts: () => [{meta:{name:"test-control",importPath:"test",props:{value:{type:"custom",control}}}}] },
    getRootSubReact: () => React,
  } as any);
  vi.stubGlobal("window", undefined);
  try {
    expect(validate(React.forwardRef(() => null)).isOk()).toBe(true);
    expect(validate({}).isErr()).toBe(true);
  } finally { vi.unstubAllGlobals(); }
});

it("places array controls below their property label, including function controls", () => {
  const array = { type: "array" as const, itemType: { type: "object" as const, fields: { name: "string" as const } } };
  expect(getPropTypeLayout(array)).toBe("vertical");
  expect(getPropTypeLayout({ type: "function", argNames: [], argValues: [], control: array })).toBe("vertical");
  expect(getPropTypeLayout("string")).toBe("horizontal");
});
