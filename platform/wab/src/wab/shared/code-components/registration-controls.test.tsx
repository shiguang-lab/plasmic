import { _testonly } from "@/wab/shared/code-components/code-components";
import React from "react";
import { vi } from "vitest";
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
