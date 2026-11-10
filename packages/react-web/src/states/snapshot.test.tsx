// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import * as React from "react";
import { afterEach, expect, it } from "vitest";
import { proxy } from "valtio";
import { StateInitializer, useDollarStateSnapshot } from "./snapshot";
import { getStateCommandEnv, getStateCommandValue } from "./command-values";
import { getStateSpecInPlasmicProxy } from "./helpers";
import { $State, $StateSpec } from "./types";
import { useDollarState } from "./valtio";

afterEach(cleanup);

it("reads state specifications through an environment containing an immutable render snapshot", () => {
  const views: Readonly<$State>[] = [];
  function Counter() {
    const commands = useDollarState();
    const state = useDollarStateSnapshot(commands, { $props: {} }, [
      { path: "count", type: "private", variableType: "number", initVal: 0 },
    ]);
    views.push(state);
    return <output>{state.count}</output>;
  }
  render(<Counter />);
  const env = { $state: views.at(-1) };
  const result = getStateSpecInPlasmicProxy(env, ["$state", "count"]);
  expect(result?.spec.variableType).toBe("number");
  expect(result?.isImplicitStateArray).toBe(false);
  expect(getStateSpecInPlasmicProxy(env, ["$state", "missing"])).toBeUndefined();
  expect(env.$state?.count).toBe(0);
});

it("keeps render values immutable while commands read their own writes", () => {
  let commands: $State;
  const renders: Readonly<$State>[] = [];
  function Counter() {
    const stateSpecs: $StateSpec<any>[] = [
      { path: "data", type: "private", variableType: "object", initVal: { count: 0, rows: ["first"] } },
    ];
    const stateEnv = { $props: {} };
    const state = useDollarState();
    commands = state;
    const view = useDollarStateSnapshot(state, stateEnv, stateSpecs);
    renders.push(view);
    return <button onClick={() => {
      state.data.count++;
      state.data.count = state.data.count + 1;
      state.data.rows.push("next");
    }}>{view.data.count}:{view.data.rows.join(",")}</button>;
  }
  render(<React.StrictMode><Counter /></React.StrictMode>);
  const first = renders.at(-1)!;
  fireEvent.click(screen.getByRole("button"));
  expect(screen.getByRole("button").textContent).toBe("2:first,next");
  expect(commands!.data.count).toBe(2);
  expect(first.data).toEqual({ count: 0, rows: ["first"] });
  expect(() => Reflect.set(first, "data", {})).toThrow(/snapshot/);
  expect(() => { first.data.count = 10; }).toThrow();
});

it("updates private initial values and controlled nested state without changing old views", () => {
  const controlled = proxy({ nested: { count: 1 } });
  const views: Readonly<$State>[] = [];
  function Example({ initial }: { initial: boolean }) {
    const stateSpecs: $StateSpec<any>[] = [
      { path: "active", type: "private", variableType: "boolean", initFunc: ({ $props }) => $props.initial },
      { path: "data", type: "writable", variableType: "object", valueProp: "controlled" },
    ];
    const stateEnv = { $props: { initial, controlled } };
    const commands = useDollarState();
    const state = useDollarStateSnapshot(commands, stateEnv, stateSpecs);
    views.push(state);
    return <output>{String(state.active)}:{state.data.nested.count}</output>;
  }
  const view = render(<Example initial={false} />);
  const first = views.at(-1)!;
  view.rerender(<Example initial />);
  expect(screen.getByRole("status").textContent).toBe("true:1");
  act(() => { controlled.nested.count = 2; });
  expect(screen.getByRole("status").textContent).toBe("true:2");
  expect(first.active).toBe(false);
  expect(first.data.nested.count).toBe(1);
});

it("registers repeated initializers and preserves captured views across later commands", () => {
  const views: Readonly<$State>[] = [];
  let commands: $State;
  function Repeated() {
    const stateSpecs: $StateSpec<any>[] = [
      { path: "rows[].value", type: "private", variableType: "text" },
    ];
    const stateEnv = { $props: {} };
    commands = useDollarState();
    const state = useDollarStateSnapshot(commands, stateEnv, stateSpecs);
    views.push(state);
    return <>{["one", "two"].map((initial, index) => {
      return <StateInitializer key={index} state={state} initializers={[{ path: "rows[].value", initFunc: () => initial, repetitionIndex: [index] }]}>
        <output>{state.rows[index].value}</output>
      </StateInitializer>;
    })}</>;
  }
  render(<Repeated />);
  expect(screen.getAllByRole("status").map((el) => el.textContent)).toEqual(["one", "two"]);
  const before = views.at(-1)!;
  act(() => { commands.rows[0].value = "changed"; });
  expect(screen.getAllByRole("status")[0].textContent).toBe("changed");
  expect(before.rows[0].value).toBe("one");
});

it("preserves command object identities across child props and reordered repetitions", () => {
  let commands: $State;
  let before: Readonly<$State>;
  function Child({ row }: { row: { title: string } }) {
    const stateSpecs: $StateSpec<any>[] = [
      { path: "row", type: "writable", variableType: "object", valueProp: "row" },
    ];
    const stateEnv = { $props: { row } };
    const state = useDollarState();
    const view = useDollarStateSnapshot(state, stateEnv, stateSpecs);
    const edit = getStateCommandEnv({ row });
    return <button onClick={() => { edit.row.title += "!"; }}>{view.row.title}</button>;
  }
  function Parent() {
    const stateSpecs: $StateSpec<any>[] = [
      { path: "rows", type: "private", variableType: "array", initVal: [{ title: "one" }, { title: "two" }] },
    ];
    const stateEnv = { $props: {} };
    commands = useDollarState();
    const state = useDollarStateSnapshot(commands, stateEnv, stateSpecs);
    before ??= state;
    return <>{state.rows.map((row: { title: string }, index: number) => <Child key={index} row={row} />)}</>;
  }
  render(<Parent />);
  const oldRow = before!.rows[0];
  const source = commands!.rows[0];
  fireEvent.click(screen.getByRole("button", { name: "one" }));
  expect(screen.getByRole("button", { name: "one!" })).toBeTruthy();
  expect(before!.rows[0].title).toBe("one");
  act(() => { commands.rows.reverse(); });
  expect(getStateCommandValue(oldRow)).toBe(source);
  expect(getStateCommandValue(oldRow).title).toBe("one!");
});
