import type { Fiber } from "@/wab/client/react-global-hook/fiber";
import { FrameVariantInputs } from "@/wab/client/react-global-hook/frame-variant-inputs";
import { TplMgr } from "@/wab/shared/TplMgr";
import { ensure } from "@/wab/shared/common";
import { ComponentType } from "@/wab/shared/core/components";
import { createSite } from "@/wab/shared/core/sites";
import { mkTplComponent } from "@/wab/shared/core/tpls";
import { ValComponent } from "@/wab/shared/core/val-nodes";
import { mock } from "vitest-mock-extended";

function fixture() {
  const site = createSite(), manager = new TplMgr({ site });
  const component = manager.addComponent({ name: "Card", type: ComponentType.Plain });
  const group = manager.createVariantGroup({ component, name: "Mode" });
  const first = manager.createVariant(component, group, "First"), second = manager.createVariant(component, group, "Second");
  const tpl = mkTplComponent(component, component.variants[0]);
  const value = (key: string, mode: unknown) => new ValComponent({
    tpl, key, fullKey: `${key}[0]`, frameUid: 1, valOwner: undefined, parent: undefined,
    fibers: [Object.assign(mock<Fiber>(), { memoizedProps: { variants: { mode } } })],
    className: "", slotInfo: undefined, slotArgs: new Map(), slotCanvasEnvs: new Map(),
  });
  const a = value("first", ["first"]), b = value("second", ["second"]);
  const values = new Map([[a.fullKey, a], [b.fullKey, b]]);
  const owner = new FrameVariantInputs((key) => values.get(key));
  const props = (val: ValComponent, mode: unknown) => {
    ensure(val.fibers[0], "The fixture must have a component Fiber").memoizedProps = { variants: { mode } };
  };
  return { owner, values, a, b, first, second, group, props };
}

it("publishes demanded Fiber variants for a stable runtime component without a root revision", () => {
  const f = fixture(), a = f.owner.getStore(f.a.fullKey), b = f.owner.getStore(f.b.fullKey);
  const before = a.getState(), other = b.getState(), changed = vi.fn(), untouched = vi.fn();
  a.subscribe(changed); b.subscribe(untouched);
  expect(before?.flags).toEqual({ [f.first.uid]: true, [f.second.uid]: false });
  f.props(f.a, ["second"]);
  f.owner.prepareCurrent(f.a.fullKey);
  expect(changed).not.toHaveBeenCalled();
  f.owner.publishCommit();
  expect(a.getState()?.flags).toEqual({ [f.first.uid]: false, [f.second.uid]: true });
  expect(a.getState()).not.toBe(before); expect(b.getState()).toBe(other);
  expect(changed).toHaveBeenCalledTimes(1); expect(untouched).not.toHaveBeenCalled();
  f.owner.prepareCurrent(f.a.fullKey); f.owner.publishCommit();
  expect(changed).toHaveBeenCalledTimes(1);
  f.owner.dispose();
});

it("installs all component flags before notification and restores no-op alternate identities", () => {
  const f = fixture(), a = f.owner.getStore(f.a.fullKey), b = f.owner.getStore(f.b.fullKey);
  const observed: unknown[] = []; a.subscribe(() => observed.push([a.getState(), b.getState()]));
  f.props(f.a, "second"); f.props(f.b, { first: true, second: false });
  f.owner.prepareCurrent(f.a.fullKey); f.owner.prepareCurrent(f.b.fullKey); f.owner.publishCommit();
  expect(observed).toEqual([[a.getState(), b.getState()]]);
  expect(b.getState()?.flags).toEqual({ [f.first.uid]: true, [f.second.uid]: false });
  const before = a.getState();
  f.values.delete(f.a.fullKey); f.owner.prepareCurrent(f.a.fullKey);
  f.values.set(f.a.fullKey, f.a); f.owner.prepareCurrent(f.a.fullKey); f.owner.publishCommit();
  expect(a.getState()).toBe(before);
  expect(observed).toHaveLength(1);
  f.owner.dispose();
});

it("refreshes model-only variant renames and releases keyed listeners on removal/disposal", () => {
  const f = fixture(), a = f.owner.getStore(f.a.fullKey), changed = vi.fn(); a.subscribe(changed);
  f.first.name = "Renamed";
  f.owner.prepareCurrent(f.a.fullKey); f.owner.publishCommit();
  expect(a.getState()?.flags).toEqual({ [f.first.uid]: false, [f.second.uid]: false });
  f.values.delete(f.a.fullKey); f.owner.prepareCurrent(f.a.fullKey); f.owner.publishCommit();
  expect(a.getState()).toBeUndefined();
  expect(changed).toHaveBeenCalledTimes(2);
  f.owner.dispose(); f.owner.dispose();
  f.values.set(f.a.fullKey, f.a); f.owner.prepareCurrent(f.a.fullKey); f.owner.publishCommit();
  expect(changed).toHaveBeenCalledTimes(2);
  expect(a.getState()).toBeUndefined();
});
