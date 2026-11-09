import { lowerMemberUpdates } from "@/wab/shared/eval/lower-member-updates";
import { ensure } from "@/wab/shared/common";
import { transformSync } from "@babel/core";
import { createStateEventHandler } from "@plasmicapp/react-web";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import * as React from "react";
import { reactCompilerOptions } from "../../../../tools/react-compiler.mjs";

afterEach(cleanup);

it.each([
  ["object.value++", "4", 4, 5],
  ["++object.value", "4", 5, 5],
  ["object.value--", BigInt(4), BigInt(4), BigInt(3)],
  ["--object.value", BigInt(4), BigInt(3), BigInt(3)],
] as const)("preserves the value and coercion of %s", (expression, initial, result, stored) => {
  const object = { value: initial };
  const read = new Function("object", `return ${lowerMemberUpdates(expression)}`);
  expect(read(object)).toBe(result);
  expect(object.value).toBe(stored);
});

it("evaluates receivers and computed keys once, including nested updates", () => {
  const objects = [{ value: 3 }, { value: 5 }];
  const receiver = vi.fn(() => objects);
  const key = vi.fn(() => "value");
  const read = new Function("receiver", "key", "indexes", `return ${lowerMemberUpdates("receiver()[indexes.value++][key()]++")}`);
  const indexes = { value: 0 };
  expect(read(receiver, key, indexes)).toBe(3);
  expect(objects[0].value).toBe(4);
  expect(indexes.value).toBe(1);
  expect(receiver).toHaveBeenCalledTimes(1);
  expect(key).toHaveBeenCalledTimes(1);
});

it("preserves postfix values in an actual compiled event callback", () => {
  const expression = lowerMemberUpdates("object.value++");
  const compiled = transformSync(`function Example() { return <button onClick={createStateEventHandler(() => [source], object => () => { record(${expression}); })}>Increment</button>; }`, {
    filename: "MemberUpdate.tsx", babelrc: false, configFile: false,
    presets: [["@babel/preset-react", { runtime: "classic" }]],
    plugins: [["babel-plugin-react-compiler", reactCompilerOptions()]],
  });
  expect(compiled?.code).toContain("react/compiler-runtime");
  const source = { value: 4 };
  const results: number[] = [];
  const { c } = require("react/compiler-runtime") as { c: (size: number) => unknown[] };
  const code = ensure(compiled?.code, "Compiled member-update fixture");
  const Example = new Function("React", "_c", "createStateEventHandler", "source", "record", `${code.replace(/^import[^\n]+react\/compiler-runtime[^\n]+\n/m, "")}\nreturn Example;`)(React, c, createStateEventHandler, source, (value: number) => results.push(value));
  render(<Example />);
  fireEvent.click(screen.getByRole("button"));
  fireEvent.click(screen.getByRole("button"));
  expect(results).toEqual([4, 5]);
  expect(source.value).toBe(6);
});
