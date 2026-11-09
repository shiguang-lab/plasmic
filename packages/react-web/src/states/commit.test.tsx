import { generateStateOnChangeProp } from "./helpers";
import { getStateCommandValue } from "./command-values";
// @vitest-environment jsdom
import * as React from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { StateInitializer, useDollarStateQueryInput, useDollarStateSnapshot } from "./snapshot";
import { useDollarState } from "./valtio";
import type { $State, $StateSpec } from "./types";

afterEach(cleanup);

it("keeps the committed command environment and schema while a new render suspends", async () => {
  const pending = new Promise<void>(() => {});
  const previousChange = vi.fn(), abandonedChange = vi.fn();
  let commands: $State;
  const firstSpecs: $StateSpec<any>[] = [{ path: "value", type: "writable", variableType: "number", valueProp: "value", onChangeProp: "onChange" }];
  function Example({ value, suspend }: { value: number; suspend: boolean }) {
    const engine = useDollarState();
    commands = engine;
    const specs = suspend ? [...firstSpecs, { path: "extra", type: "private", variableType: "text", initVal: "abandoned" } as $StateSpec<any>] : firstSpecs;
    const state = useDollarStateSnapshot(engine, { $props: { value, onChange: suspend ? abandonedChange : previousChange } }, specs);
    if (suspend) { throw pending; }
    return <output>{state.value}</output>;
  }
  const view = render(<React.Suspense fallback="pending"><Example value={1} suspend={false} /></React.Suspense>);
  await act(async () => { React.startTransition(() => view.rerender(<React.Suspense fallback="pending"><Example value={9} suspend /></React.Suspense>)); });
  expect(screen.getByRole("status").textContent).toBe("1");
  expect(commands!.value).toBe(1);
  expect(commands!.extra).toBeUndefined();
  act(() => { commands!.value = 2; });
  expect(previousChange).toHaveBeenCalledWith(2, expect.anything());
  expect(abandonedChange).not.toHaveBeenCalled();
});

it("commits only the final query environment when query inputs and a state view share one engine", () => {
  let commands: $State;
  const specs: $StateSpec<any>[] = [{ path: "answer", type: "private", variableType: "number", initFunc: ({ $queries }) => $queries.answer }];
  function StateView({ engine, answer }: { engine: $State; answer: number }) {
    const state = useDollarStateSnapshot(engine, { $props: {}, $queries: { answer } }, specs);
    return <output>{state.answer}</output>;
  }
  function Owner({ answer }: { answer: number }) {
    commands = useDollarState();
    useDollarStateQueryInput(commands, { $props: {}, $queries: { answer: -1 } }, specs);
    return <StateView engine={commands} answer={answer} />;
  }
  const view = render(<Owner answer={42} />);
  expect(screen.getByRole("status").textContent).toBe("42");
  expect(commands!.answer).toBe(42);
  view.rerender(<Owner answer={43} />);
  expect(screen.getByRole("status").textContent).toBe("43");
  expect(commands!.answer).toBe(43);
});

it("does not commit a suspended child initializer into the current owner", async () => {
  const pending = new Promise<void>(() => {});
  let setValue!: React.Dispatch<React.SetStateAction<number>>;
  let commands: $State;
  let ownerRenders = 0;
  const specs: $StateSpec<any>[] = [{ path: "value", type: "private", variableType: "number" }];
  function Suspend({value}: {value: number}) { if (value === 9) { throw pending; } return null; }
  const Child = React.memo(function Child({ state }: { state: Readonly<$State> }) {
    const [value, update] = React.useState(1);
    setValue = update;
    return <><StateInitializer state={state} initializers={[{ path: "value", initFunc: () => value }]} /><Suspend value={value} /></>;
  });
  function Owner() {
    ownerRenders++;
    commands = useDollarState();
    const state = useDollarStateSnapshot(commands, { $props: {} }, specs);
    return <><Child state={state} /><button onClick={() => { commands.value++; }}>{state.value}</button></>;
  }
  render(<React.Suspense fallback="pending"><Owner /></React.Suspense>);
  const rendered = ownerRenders;
  await act(async () => { React.startTransition(() => setValue(9)); });
  expect(screen.getByRole("button").textContent).toBe("1");
  expect(commands!.value).toBe(1);
  expect(ownerRenders).toBe(rendered);
  fireEvent.click(screen.getByRole("button"));
  expect(commands!.value).toBe(2);
});

it("does not traverse an unused loading prop while initializing another field", () => {
  const loading = new Proxy({}, { ownKeys() { throw new Error("unused loading value"); } });
  const specs: $StateSpec<any>[] = [{ path: "value", type: "private", variableType: "number", initFunc: ({ $props }) => $props.initial }];
  function Example() {
    const state = useDollarStateSnapshot(useDollarState(), { $props: { initial: 7, loading } }, specs);
    return <output>{state.value}</output>;
  }
  render(<Example />);
  expect(screen.getByRole("status").textContent).toBe("7");
});

it.each([false, true])("replays child initializer commands after the parent schema commits (repeated: %s)", (repeated) => {
  let parentCommands!: $State;
  const observed: number[] = [];
  const parentSpecs: $StateSpec<any>[] = [{ path: repeated ? "counter[].count" : "counter.count", type: "private", variableType: "number", initVal: 0 }];
  const childSpecs: $StateSpec<any>[] = [{ path: "count", type: "readonly", variableType: "number", initVal: 3, onChangeProp: "onChange" }];
  function Child({ onChange }: { onChange: (value: number) => void }) {
    useDollarStateSnapshot(useDollarState(), { $props: { onChange } }, childSpecs);
    return null;
  }
  function Parent() {
    parentCommands = useDollarState();
    const state = useDollarStateSnapshot(parentCommands, { $props: {} }, parentSpecs);
    return <><Child onChange={(value) => {
      generateStateOnChangeProp(state, repeated ? ["counter", 0, "count"] : ["counter", "count"])(value);
      const commands = getStateCommandValue(state);
      const counter = repeated ? commands.counter[0] : commands.counter;
      counter.count++;
      observed.push(counter.count);
    }} /><output>{repeated ? state.counter[0].count : state.counter.count}</output></>;
  }
  render(<Parent />);
  expect(observed).toEqual([4]);
  expect((repeated ? parentCommands.counter[0] : parentCommands.counter).count).toBe(4);
  expect(screen.getByRole("status").textContent).toBe("4");
  expect(() => { parentCommands.unknown = 1; }).toThrow(TypeError);
});

it("validates buffered child commands against the first committed schema", () => {
  const specs: $StateSpec<any>[] = [{ path: "declared", type: "private", variableType: "number", initVal: 0 }];
  function Child({ state }: { state: Readonly<$State> }) {
    React.useLayoutEffect(() => { generateStateOnChangeProp(state, ["unknown"])(1); }, [state]);
    return null;
  }
  function Parent() {
    const state = useDollarStateSnapshot(useDollarState(), { $props: {} }, specs);
    return <Child state={state} />;
  }
  expect(() => render(<Parent />)).toThrow("Unknown state field during initial commit: unknown");
});
