import { ComponentType, mkComponent } from "@/wab/shared/core/components";
import { mkTplComponentX, mkTplTagX } from "@/wab/shared/core/tpls";
import { ValComponent, deferValRuntimePublication } from "@/wab/shared/core/val-nodes";
import type { CanvasEnv } from "@/wab/shared/eval";
import { mock } from "vitest-mock-extended";

function mkValue() {
  const component = mkComponent({name: "Runtime", type: ComponentType.Plain, tplTree: mkTplTagX("div")});
  const tpl = mkTplComponentX({component, baseVariant: component.variants[0]});
  return new ValComponent({tpl, valOwner: null, key: "runtime", fullKey: "runtime", frameUid: 1, fibers: [], parent: undefined, className: "", slotInfo: undefined, slotArgs: new Map(), slotCanvasEnvs: new Map()});
}

it("installs all Fiber runtime fields before publishing either source", () => {
  const value = mkValue();
  const env = mock<CanvasEnv>(), wrappingEnv = mock<CanvasEnv>();
  const observed = vi.fn(() => {
    expect(value.env).toBe(env); expect(value.wrappingEnv).toBe(wrappingEnv);
    expect(value.codeComponentProps).toEqual({title: "After"}); expect(value.contents).toEqual([]);
  });
  const stops = [value.runtimeInputs.subscribe(observed), value.componentRuntimeInputs.subscribe(observed)];
  try {
    deferValRuntimePublication(() => {
      value.envs = {env, wrappingEnv};
      deferValRuntimePublication(() => {value.codeComponentProps = {title: "After"}; value.contents = [];});
      expect(observed).not.toHaveBeenCalled();
      expect(value.componentRuntimeInputs.getState().codeComponentProps).toEqual({title: "After"});
    });
    expect(observed).toHaveBeenCalledTimes(2);
    observed.mockClear(); const same = value.codeComponentProps; value.codeComponentProps = same;
    expect(observed).not.toHaveBeenCalled();
  } finally {stops.forEach(stop => stop());}
});


it("retains every other runtime field and previous immutable snapshots across replacements and explicit clears", () => {
  const value = mkValue();
  const changed = vi.fn();
  const stop = value.componentRuntimeInputs.subscribe(changed);
  try {
    const initial = value.componentRuntimeInputs.getState();
    const props = { title: "Latest" };
    const contents: NonNullable<ValComponent["contents"]> = [];
    const invalidArgs: NonNullable<ValComponent["invalidArgs"]> = [];
    value.codeComponentProps = props;
    const withProps = value.componentRuntimeInputs.getState();
    value.contents = contents;
    const withContents = value.componentRuntimeInputs.getState();
    value.invalidArgs = invalidArgs;
    const complete = value.componentRuntimeInputs.getState();
    expect(complete).toEqual({ codeComponentProps: props, contents, invalidArgs });
    expect(complete.contents).toBe(contents);
    expect(complete.invalidArgs).toBe(invalidArgs);
    expect(initial).toEqual({ codeComponentProps: undefined, contents: undefined, invalidArgs: undefined });
    expect(value.componentRuntimeInputs.getInitialState()).toBe(initial);
    expect(withProps).toEqual({ codeComponentProps: props, contents: undefined, invalidArgs: undefined });
    expect(withContents).toEqual({ codeComponentProps: props, contents, invalidArgs: undefined });
    value.codeComponentProps = undefined;
    expect(value.componentRuntimeInputs.getState()).toEqual({ codeComponentProps: undefined, contents, invalidArgs });
    value.contents = undefined;
    expect(value.componentRuntimeInputs.getState()).toEqual({ codeComponentProps: undefined, contents: undefined, invalidArgs });
    value.invalidArgs = undefined;
    expect(value.componentRuntimeInputs.getState()).toEqual(initial);
    expect(complete).toEqual({ codeComponentProps: props, contents, invalidArgs });
    expect(changed).toHaveBeenCalledTimes(6);
    value.codeComponentProps = undefined;
    value.contents = undefined;
    value.invalidArgs = undefined;
    expect(changed).toHaveBeenCalledTimes(6);
  } finally { stop(); }
});

it("retains intermediate snapshots while nested Fiber publications expose all latest fields atomically", () => {
  const value = mkValue();
  const initialEnv = value.runtimeInputs.getState();
  const initialComponent = value.componentRuntimeInputs.getState();
  const firstEnv = { env: mock<CanvasEnv>(), wrappingEnv: mock<CanvasEnv>() };
  const latestEnv = { env: mock<CanvasEnv>(), wrappingEnv: mock<CanvasEnv>() };
  const invalidArgs: NonNullable<ValComponent["invalidArgs"]> = [];
  const props = { title: "Final" };
  const contents: NonNullable<ValComponent["contents"]> = [];
  const observed = vi.fn(() => {
    expect(value.runtimeInputs.getState().envs).toBe(latestEnv);
    expect(value.componentRuntimeInputs.getState()).toEqual({ codeComponentProps: props, contents, invalidArgs });
  });
  const stops = [value.runtimeInputs.subscribe(observed), value.componentRuntimeInputs.subscribe(observed)];
  try {
    deferValRuntimePublication(() => {
      value.envs = firstEnv;
      value.codeComponentProps = props;
      const previousEnv = value.runtimeInputs.getState();
      const previousComponent = value.componentRuntimeInputs.getState();
      deferValRuntimePublication(() => {
        value.invalidArgs = invalidArgs;
        value.envs = latestEnv;
        value.contents = contents;
      });
      expect(observed).not.toHaveBeenCalled();
      expect(previousEnv.envs).toBe(firstEnv);
      expect(previousComponent).toEqual({ codeComponentProps: props, contents: undefined, invalidArgs: undefined });
    });
    expect(observed).toHaveBeenCalledTimes(2);
    expect(initialEnv).toEqual({ envs: undefined });
    expect(initialComponent).toEqual({ codeComponentProps: undefined, contents: undefined, invalidArgs: undefined });
    value.envs = latestEnv;
    expect(observed).toHaveBeenCalledTimes(2);
  } finally { stops.forEach(stop => stop()); }
});
