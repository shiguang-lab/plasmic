import { createLiveRuntime } from "../../../../../../live-frame/src/runtime";

it.each(["toString", "constructor", "__proto__"])(
  "rejects inherited builtin name %s instead of loading it",
  (name) => {
    const runtime = createLiveRuntime({ react: {} });
    expect(() => runtime.require(name)).toThrow(
      `Live preview cannot import unknown module "${name}"`,
    );
  },
);

it("loads an explicitly registered builtin with a prototype-like name", () => {
  const builtin = { value: 7 };
  const runtime = createLiveRuntime({ toString: builtin });
  expect(runtime.require("toString")).toBe(builtin);
});

it("recovers a failed module and its importer without keeping the failed exports", () => {
  const runtime = createLiveRuntime({});
  runtime.update([
    { type: "code", fileName: "root.js", code: 'exports.value = require("./dependency").value', imports: ["./dependency"] },
    { type: "code", fileName: "dependency.js", code: 'throw new Error("broken dependency")', imports: [] },
  ]);
  expect(() => runtime.require("./root")).toThrow("broken dependency");
  runtime.update([{ type: "code", fileName: "dependency.js", code: "exports.value = 0", imports: [] }]);
  expect(runtime.require("./root")).toEqual({ value: 0 });
});
