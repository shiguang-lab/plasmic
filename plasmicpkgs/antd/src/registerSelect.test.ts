import type { CodeComponentMeta } from "@plasmicapp/host/registerComponent";
import { expect, it, vi } from "vitest";
import { registerOption, registerOptGroup } from "./registerOption";
import { registerSelect } from "./registerSelect";

it("resolves every Select child restriction to a registered option component", () => {
  const registerComponent = vi.fn();
  const loader = { registerComponent };
  registerOption(loader);
  registerOptGroup(loader);
  registerSelect(loader);
  const registrations = registerComponent.mock.calls.map(
    ([, meta]) => meta as CodeComponentMeta<any>,
  );
  const select = registrations.find((meta) => meta.name === "AntdSelect")!;
  const children = select.props.children;
  expect(typeof children).toBe("object");
  if (typeof children !== "object" || children.type !== "slot") {
    throw new Error("Select must expose its native children slot");
  }
  const allowed = children.allowedComponents ?? [];
  expect(allowed).toHaveLength(2);
  expect(new Set(allowed).size).toBe(2);
  for (const name of allowed) {
    expect(registrations.filter((meta) => meta.name === name)).toHaveLength(1);
  }
});
