// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import * as React from "react";
import { afterEach, expect, it, vi } from "vitest";
import { usePlasmicRefs } from "./refs";
import { mergeRefs } from "../react-utils";

afterEach(cleanup);

it("publishes committed nodes in StrictMode with stable commands and releases removed nodes", () => {
  const commands: ReturnType<typeof usePlasmicRefs>[] = [];
  function Example({ show }: { show: boolean }) {
    const refs = usePlasmicRefs();
    const outerRef = React.useRef<HTMLInputElement>(null);
    commands.push(refs);
    return show ? <input aria-label="Target" ref={mergeRefs(refs.registerRef("target"), outerRef)} /> : null;
  }
  const mounted = render(<React.StrictMode><Example show /></React.StrictMode>);
  const first = screen.getByRole("textbox");
  const { getRefs, registerRef } = commands[0];
  expect(getRefs().target).toBe(first);
  const record = getRefs();
  mounted.rerender(<React.StrictMode><Example show={false} /></React.StrictMode>);
  expect(getRefs()).toBe(record);
  expect(record.target).toBeNull();
  mounted.rerender(<React.StrictMode><Example show /></React.StrictMode>);
  expect(record.target).toBe(screen.getByRole("textbox"));
  expect(record.target).not.toBe(first);
  expect(commands.every((command) => command.getRefs === getRefs && command.registerRef === registerRef)).toBe(true);
  mounted.unmount();
  expect(record.target).toBeNull();
});

it("keeps a later repeated instance when an earlier instance releases the same ref name", () => {
  let commands: ReturnType<typeof usePlasmicRefs> | undefined;
  function Example() { commands = usePlasmicRefs(); return null; }
  render(<Example />);
  if (!commands) { throw new Error("Refs Hook did not render"); }
  const { getRefs } = commands;
  const register = commands.registerRef("target");
  const first = register("first");
  const last = register("last");
  first();
  expect(getRefs().target).toBe("last");
  last();
  expect(getRefs().target).toBeNull();
  const sameFirst = register("same handle"), sameLast = register("same handle");
  sameFirst();
  expect(getRefs().target).toBe("same handle");
  sameLast();
  expect(getRefs().target).toBeNull();
});

it("accepts a fresh useImperativeHandle on every commit and events read the latest actual handle", () => {
  const observed = vi.fn();
  const published = vi.fn();
  const Child = React.forwardRef<{ read(): string }, { label: string }>(function Child({ label }, ref) {
    React.useImperativeHandle(ref, () => {
      const handle = { read: () => label };
      published(handle);
      return handle;
    });
    return <input aria-label="Target" defaultValue={label} />;
  });
  function Example({ label }: { label: string }) {
    const { getRefs, registerRef } = usePlasmicRefs();
    return <>
      <button onClick={() => observed((getRefs().target as { read(): string }).read())}>Read ref</button>
      <Child label={label} ref={registerRef("target")} />
    </>;
  }
  const mounted = render(<React.StrictMode><Example label="first" /></React.StrictMode>);
  fireEvent.click(screen.getByRole("button"));
  expect(observed).toHaveBeenLastCalledWith("first");
  const first = published.mock.lastCall?.[0];
  mounted.rerender(<React.StrictMode><Example label="second" /></React.StrictMode>);
  expect(published.mock.lastCall?.[0]).not.toBe(first);
  fireEvent.click(screen.getByRole("button"));
  expect(observed).toHaveBeenLastCalledWith("second");
});

it("keeps ref commands live across await while an intentionally captured handle retains its identity", async () => {
  const observed = vi.fn();
  let resume: (() => void) | undefined;
  const wait = new Promise<void>((resolve) => { resume = resolve; });
  const Child = React.forwardRef<{ read(): string }, { label: string }>(function Child({ label }, ref) {
    React.useImperativeHandle(ref, () => ({ read: () => label }));
    return null;
  });
  function Example({ label }: { label: string }) {
    const { getRefs, registerRef } = usePlasmicRefs();
    return <>
      <button onClick={async () => {
        const $refs = getRefs();
        const captured = $refs.target as { read(): string };
        await wait;
        observed(($refs.target as { read(): string }).read(), captured.read());
      }}>Wait and read</button>
      <Child label={label} ref={registerRef("target")} />
    </>;
  }
  const mounted = render(<React.StrictMode><Example label="first" /></React.StrictMode>);
  fireEvent.click(screen.getByRole("button"));
  mounted.rerender(<React.StrictMode><Example label="second" /></React.StrictMode>);
  await act(async () => resume?.());
  expect(observed).toHaveBeenCalledWith("second", "first");
});

it("supports changing inline override callbacks and genuine DOM replacements for multiple refs", () => {
  const observed = vi.fn();
  let getRefs: ReturnType<typeof usePlasmicRefs>["getRefs"] | undefined;
  function Example({ generation, showSecond }: { generation: string; showSecond: boolean }) {
    const commands = usePlasmicRefs();
    getRefs = commands.getRefs;
    return <>
      <input aria-label="First" key={generation} ref={mergeRefs(commands.registerRef("first"), (node) => observed(generation, node))} />
      {showSecond && <input aria-label="Second" ref={commands.registerRef("second")} />}
    </>;
  }
  const mounted = render(<React.StrictMode><Example generation="one" showSecond /></React.StrictMode>);
  if (!getRefs) { throw new Error("Refs Hook did not render"); }
  const refs = getRefs();
  const first = screen.getByRole("textbox", { name: "First" });
  expect(refs.first).toBe(first);
  expect(refs.second).toBe(screen.getByRole("textbox", { name: "Second" }));
  mounted.rerender(<React.StrictMode><Example generation="two" showSecond={false} /></React.StrictMode>);
  const replacement = screen.getByRole("textbox", { name: "First" });
  expect(replacement).not.toBe(first);
  expect(refs.first).toBe(replacement);
  expect(refs.second).toBeNull();
  expect(observed).toHaveBeenCalledWith("one", null);
  expect(observed).toHaveBeenCalledWith("two", replacement);
  mounted.unmount();
  expect(refs.first).toBeNull();
});

it("state onMutate reads the latest committed ref while initializers receive only render data", async () => {
  const { proxy } = await import("valtio");
  const { useDollarState } = await import("../states/valtio");
  const { useDollarStateSnapshot } = await import("../states/snapshot");
  const controlled = proxy({ count: 0 });
  const mutated = vi.fn();
  const commandReads = vi.fn();
  const Child = React.forwardRef<{ label: string }, { label: string }>(function Child({ label }, ref) {
    React.useImperativeHandle(ref, () => ({ label }));
    return null;
  });
  function Example({ label }: { label: string }) {
    const { getRefs, registerRef } = usePlasmicRefs();
    const getRefCommands = React.useCallback(() => { commandReads(); return getRefs(); }, [getRefs]);
    const state = useDollarStateSnapshot(useDollarState(), { $props: { controlled }, getRefs: getRefCommands }, [
      { path: "data", type: "writable", variableType: "object", valueProp: "controlled", refName: "target", onMutate: (value, ref) => mutated(value.count, ref.label) },
      { path: "initial", type: "private", variableType: "number", initFunc: (env) => {
        expect(Object.keys(env).sort()).toEqual(["$ctx", "$props", "$q", "$queries", "$state"]);
        return 0;
      } },
    ]);
    return <><output>{state.data.count}:{state.initial}</output><Child label={label} ref={registerRef("target")} /></>;
  }
  const mounted = render(<React.StrictMode><Example label="first" /></React.StrictMode>);
  mounted.rerender(<React.StrictMode><Example label="second" /></React.StrictMode>);
  expect(commandReads).not.toHaveBeenCalled();
  await act(async () => { controlled.count = 1; });
  expect(mutated).toHaveBeenLastCalledWith(1, "second");
  expect(commandReads).toHaveBeenCalled();
  expect(screen.getByRole("status").textContent).toBe("1:0");
});

it("registers special dictionary names as own values without changing the canonical record prototype", () => {
  let commands: ReturnType<typeof usePlasmicRefs> | undefined;
  function Example() { commands = usePlasmicRefs(); return null; }
  render(<Example />);
  if (!commands) { throw new Error("Refs Hook did not render"); }
  const refs = commands.getRefs(), prototype = Object.getPrototypeOf(refs);
  const value = { read: () => "special target" };
  const release = commands.registerRef("__proto__")(value);
  expect(Object.getPrototypeOf(refs)).toBe(prototype);
  expect(Object.keys(refs)).toEqual(["__proto__"]);
  expect(refs.__proto__).toBe(value);
  release();
  expect(refs.__proto__).toBeNull();
  expect(Object.getPrototypeOf(refs)).toBe(prototype);
});
