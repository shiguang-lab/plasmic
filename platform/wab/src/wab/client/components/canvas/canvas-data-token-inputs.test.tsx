import { fakeStudioCtx } from "@/wab/client/__testonly__/fake-init-ctx";
import { useCanvasDataTokenLease, useCanvasDataTokens, type RenderingCtx } from "@/wab/client/components/canvas/canvas-rendering";
import { mkUseCanvasObserver } from "@/wab/client/components/canvas/canvas-observer";
import type { SubDeps } from "@/wab/client/components/canvas/subdeps";
import { mkArenaFrame, mkMixedArena } from "@/wab/shared/Arenas";
import { ensure } from "@/wab/shared/common";
import { ComponentType, mkComponent } from "@/wab/shared/core/components";
import { mkTplTagX } from "@/wab/shared/core/tpls";
import { DEVFLAGS } from "@/wab/shared/devflags";
import { makeShortProjectId, toVarName } from "@/wab/shared/codegen/util";
import { act, cleanup, render, waitFor } from "@testing-library/react";
import { useDollarState } from "@plasmicapp/react-web";
import { computed } from "mobx";
import React from "react";
import { mock } from "vitest-mock-extended";
import { CanvasDataTokenInputs } from "@/wab/client/components/canvas/canvas-data-token-inputs";
import { ModelSnapshots } from "@/wab/client/studio-ctx/model-snapshots";
import { captureDataTokenDefinitions, computeDataTokens, evaluateDataTokenDefinitions, mkDataToken } from "@/wab/commons/DataToken";
import type { ProjectId } from "@/wab/shared/ApiSchema";
import { makeDataTokenIdentifier } from "@/wab/shared/eval/expression-parser";
import { createSite } from "@/wab/shared/core/sites";
import { ProjectDependency } from "@/wab/shared/model/classes";
import { OverrideableToken, toFinalToken } from "@/wab/shared/core/tokens";
import type { ModelChange } from "@/wab/shared/core/observable-model";

const projectId = "local-project" as ProjectId;
function dependency(name: string, id: string, site = createSite()) {
  return new ProjectDependency({ name, uuid: id, projectId: id, pkgId: id, version: "1", site });
}
function fixture() {
  const site = createSite(), models = new ModelSnapshots();
  const local = mkDataToken({ name: "Local number", value: "1" });
  const direct = dependency("Direct library", "direct-project");
  const transitive = dependency("Hidden library", "hidden-project");
  const directToken = mkDataToken({ name: "Direct value", value: '"direct"' });
  const hiddenToken = mkDataToken({ name: "Hidden value", value: "true" });
  direct.site.dataTokens.push(directToken); transitive.site.dataTokens.push(hiddenToken);
  direct.site.projectDependencies.push(transitive); site.projectDependencies.push(direct); site.dataTokens.push(local);
  const owner = new CanvasDataTokenInputs({ site, modelSnapshots: models, projectId });
  return { site, models, local, direct, transitive, directToken, hiddenToken, owner,
    commit(changes: ModelChange[]) { models.sync(changes); owner.prepareCommit(); owner.publishCommit(); },
    dispose() { owner.dispose(); models.dispose(); } };
}

it("preserves the original local/direct/transitive namespace, override, invalid-expression and duplicate-id semantics", () => {
  const f = fixture();
  const empty = dependency("Empty library", "empty-project");
  f.site.projectDependencies.push(empty, f.direct);
  f.transitive.site.projectDependencies.push(f.direct);
  f.site.dataTokens.push(mkDataToken({ name: "Object", value: '{"items":[1]}' }), mkDataToken({ name: "Broken", value: "not valid ! code" }));
  try {
    const evaluated = computeDataTokens(f.site, projectId, {});
    expect(evaluated?.$dataTokens).toMatchObject({
      [makeDataTokenIdentifier("local", "localNumber")]: 1,
      [makeDataTokenIdentifier("direc", "directValue")]: "direct",
      [makeDataTokenIdentifier("hidde", "hiddenValue")]: true,
      [makeDataTokenIdentifier("local", "object")]: { items: [1] },
      [makeDataTokenIdentifier("local", "broken")]: undefined,
    });
    expect(evaluated?.pickerEnv.localNumber).toBe(1);
    expect(evaluated?.pickerEnv.directLibrary).toMatchObject({ directValue: "direct" });
    expect(evaluated?.pickerEnv).not.toHaveProperty("hiddenLibrary");
    expect(evaluateDataTokenDefinitions(captureDataTokenDefinitions(f.site, projectId), {})).toEqual(evaluated);
    expect(computeDataTokens(f.site, projectId, {})?.pickerEnv).not.toHaveProperty("emptyLibrary");
    expect(computeDataTokens(createSite(), projectId, {})).toBeUndefined();
  } finally { f.dispose(); }
});

it("installs an atomic multi-field definition, invalidates before notifying, and ignores unrelated model inputs", () => {
  const f = fixture(); const publish = vi.fn(); const prepare = vi.fn(() => publish);
  const before = f.owner.store.getState(); const notify = vi.fn(() => {
    expect(prepare).toHaveBeenCalledOnce();
    expect(f.owner.store.getState()[0].tokens[0]).toMatchObject({ name: "Renamed", value: "2" });
    expect(f.owner.store.getState()[1].pickerName).toBe("Renamed library");
    expect(publish).not.toHaveBeenCalled();
  });
  const stops = [f.owner.subscribeBeforePublish(prepare), f.owner.store.subscribe(notify)];
  try {
    f.local.name = "Renamed"; f.local.value = "2"; f.direct.name = "Renamed library";
    f.models.sync([
      { type: "update", oldValue: "Local number", newValue: "Renamed", changeNode: { inst: f.local, field: "name" } },
      { type: "update", oldValue: "1", newValue: "2", changeNode: { inst: f.local, field: "value" } },
      { type: "update", oldValue: "Direct library", newValue: "Renamed library", changeNode: { inst: f.direct, field: "name" } },
    ]);
    f.owner.prepareCommit();
    expect(f.owner.store.getState()).not.toBe(before); expect(notify).not.toHaveBeenCalled();
    f.owner.publishCommit(); expect(notify).toHaveBeenCalledOnce(); expect(publish).toHaveBeenCalledOnce();
    expect(f.owner.store.getState()[2]).toBe(before[2]);
    notify.mockClear(); prepare.mockClear(); publish.mockClear();
    const settled = f.owner.store.getState();
    f.local.isRegistered = true;
    f.commit([{ type: "update", oldValue: false, newValue: true, changeNode: { inst: f.local, field: "isRegistered" } }]);
    expect(f.owner.store.getState()).toBe(settled);
    expect(prepare).not.toHaveBeenCalled(); expect(notify).not.toHaveBeenCalled();
  } finally { stops.forEach((stop) => stop()); f.dispose(); }
});

it("uses registered/direct overrides and releases replaced dependency, token and override fields", () => {
  const f = fixture(); const changed = vi.fn(); f.owner.store.subscribe(changed);
  try {
    f.local.isRegistered = true;
    const localProducer = toFinalToken(f.local, f.site), directProducer = toFinalToken(f.directToken, f.site);
    if (!(localProducer instanceof OverrideableToken) || !(directProducer instanceof OverrideableToken)) {
      throw new Error("Registered local and direct dependency tokens require override producers");
    }
    const hiddenProducer = new OverrideableToken(f.hiddenToken, f.site);
    localProducer.setValue("7"); directProducer.setValue('"direct override"'); hiddenProducer.setValue("false");
    const override = ensure(localProducer.override, "Local producer override");
    const directOverride = ensure(directProducer.override, "Direct producer override");
    const hiddenOverride = ensure(hiddenProducer.override, "Hidden producer override");
    f.commit([
      { type: "update", oldValue: false, newValue: true, changeNode: { inst: f.local, field: "isRegistered" } },
      { type: "update", oldValue: [], newValue: [override, directOverride, hiddenOverride], changeNode: { inst: f.site, field: "styleTokenOverrides" } },
    ]);
    expect(f.owner.store.getState()[0].tokens[0].value).toBe("7");
    expect(f.owner.store.getState()[1].tokens[0].value).toBe('"direct override"');
    expect(f.owner.store.getState()[2].tokens[0].value).toBe("true");
    const replacement = createSite(); replacement.dataTokens.push(mkDataToken({ name: "Replacement", value: "3" }));
    const oldSite = f.direct.site; f.direct.site = replacement;
    f.commit([{ type: "update", oldValue: oldSite, newValue: replacement, changeNode: { inst: f.direct, field: "site" } }]);
    expect(f.owner.store.getState()).toHaveLength(2);
    f.site.styleTokenOverrides.splice(0);
    f.commit([{ type: "update", oldValue: [override, directOverride, hiddenOverride], newValue: [], changeNode: { inst: f.site, field: "styleTokenOverrides" } }]);
    const settled = f.owner.store.getState(); changed.mockClear();
    f.directToken.value = '"detached"'; f.hiddenToken.value = "false"; override.value = "8";
    f.commit([
      { type: "update", oldValue: '"direct"', newValue: '"detached"', changeNode: { inst: f.directToken, field: "value" } },
      { type: "update", oldValue: "true", newValue: "false", changeNode: { inst: f.hiddenToken, field: "value" } },
      { type: "update", oldValue: "7", newValue: "8", changeNode: { inst: override, field: "value" } },
    ]);
    expect(f.owner.store.getState()).toBe(settled); expect(changed).not.toHaveBeenCalled();
    f.owner.dispose(); f.local.value = "9";
    f.commit([{ type: "update", oldValue: "1", newValue: "9", changeNode: { inst: f.local, field: "value" } }]);
    expect(f.owner.store.getState()).toEqual([]); expect(changed).not.toHaveBeenCalled();
  } finally { f.dispose(); }
});

it("shares frozen source text only, evaluating independent mutable and opaque graphs per caller", () => {
  const f = fixture();
  try {
    f.local.value = "({ items: [1], command() { return this.items[0]; } })";
    f.commit([{ type: "update", oldValue: "1", newValue: f.local.value, changeNode: { inst: f.local, field: "value" } }]);
    const definitions = f.owner.store.getState();
    const first = evaluateDataTokenDefinitions(definitions, {}), second = evaluateDataTokenDefinitions(definitions, {});
    const key = makeDataTokenIdentifier("local", "localNumber");
    expect(Object.isFrozen(definitions[0].tokens[0])).toBe(true);
    expect(first?.$dataTokens[key]).not.toBe(second?.$dataTokens[key]);
    expect(first?.$dataTokens[key]).not.toBe(first?.pickerEnv.localNumber);
    expect(Object.isFrozen(first?.$dataTokens[key])).toBe(false);
    first?.$dataTokens[key].items.push(2);
    expect(second?.$dataTokens[key].items).toEqual([1]);
    expect(first?.$dataTokens[key].command()).toBe(1);
  } finally { f.dispose(); }
});


afterEach(() => { cleanup(); vi.restoreAllMocks(); });

async function renderFixture() {
  const site = createSite();
  const token = mkDataToken({ name: "Mutable", value: "({ items: [1], command() { return this.items[0]; } })" });
  site.dataTokens.push(token);
  const component = mkComponent({ name: "Runtime", type: ComponentType.Plain, tplTree: mkTplTagX("div") });
  site.components.push(component);
  const empty = mkMixedArena("Empty");
  const frame = mkArenaFrame({ site, component, name: "Inactive", width: 100, height: 100 });
  const target = mkMixedArena("Target", [frame]); site.arenas.push(empty, target);
  const { studioCtx: studio } = fakeStudioCtx({ site, initialUrl: "/projects/test?arena_type=custom&arena=Empty" });
  await waitFor(() => expect(studio.initialRouteReady).toBe(true));
  studio.arenaState.activate(target, performance.now());
  expect(studio.getArenaStatus(target)).toBe("cached");
  const view = ensure(studio.tryGetViewCtxForFrame(frame), "Actual inactive ViewCtx");
  const sub = mock<SubDeps>(); Object.defineProperty(sub, "React", { value: React });
  const key = makeDataTokenIdentifier(makeShortProjectId(studio.siteInfo.id), toVarName(token.name));
  const contexts = new Map<string, RenderingCtx>();
  const runtime = new Map<string, { items: number[]; command: () => number }>();
  const renders = new Map<string, ReturnType<typeof vi.fn<() => void>>>();
  function useCachedNode(id: string, tokens?: ReturnType<typeof useCanvasDataTokens>) {
    const [, invalidate] = React.useReducer((x) => x + 1, 0);
    const unusedCommand = React.useCallback(() => undefined, []);
    const $state = useDollarState([], { $props: {}, $queries: {}, $q: {}, $ctx: {}, $refs: {} }, { inCanvas: true });

      const env = { $ctx: {}, $props: {}, $queries: {}, $q: {}, $state, $refs: {}, $$: {}, ...tokens?.evaluated?.$dataTokens };
      const ctx: RenderingCtx = {
        sub, viewCtx: view, site, valKey: id, rootClassName: "", projectFlags: DEVFLAGS,
        ownerComponent: component, ownerKey: undefined, nodeNamer: undefined,
        env, wrappingEnv: env, activeVariants: new Set(), ownersStack: [], reactHookSpecs: [], triggerProps: {}, overrides: {},
        $stateSnapshot: {}, $ccVariants: {}, updateVariant: unusedCommand,
        stateSpecs: [],
        setDollarQueries: unusedCommand, setDollarQ: unusedCommand, plasmicInvalidate: undefined,
        onRenderInvalidated: invalidate, dataTokenDefinitions: tokens?.definitions,
      };
      contexts.set(id, ctx);
      const value = tokens?.evaluated?.$dataTokens[key];
      if (value) { runtime.set(id, value); }
      let draw = renders.get(id);
      if (!draw) { draw = vi.fn<() => void>(); renders.set(id, draw); }
      const output = mkUseCanvasObserver(sub, view)(() => view.canvasRenderOwner.render(component.tplTree, ctx, () => {
        draw();
        return React.createElement("output", { "data-testid": id }, value ? String(value.command()) : "unrelated");
      }), `DataTokenProbe-${id}`);
      return { ctx, output };
  }
  function Probe({ id }: { id: string }) {
    const tokens = useCanvasDataTokens(sub, view);
    const { ctx, output } = useCachedNode(id, tokens);
    useCanvasDataTokenLease(sub, view, ctx);
    return output;
  }
  function Unrelated({ id }: { id: string }) { return useCachedNode(id).output; }

  return { studio, view, site, token, component, Probe, Unrelated, contexts, runtime, renders };
}

it("feeds the real mounted consumer/cache chain with per-instance mutable values and leaves unrelated cache entries intact", async () => {
  const f = await renderFixture();
  const mounted = render(<><f.Probe id="first" /><f.Probe id="second" /><f.Unrelated id="unrelated" /></>);
  try {
    const first = ensure(f.runtime.get("first"), "First runtime"), second = ensure(f.runtime.get("second"), "Second runtime");
    expect(first).not.toBe(second); expect(first.command).not.toBe(second.command); expect(Object.isFrozen(first)).toBe(false);
    first.items.push(99); expect(second.items).toEqual([1]);
    mounted.rerender(<><f.Probe id="first" /><f.Probe id="second" /><f.Unrelated id="unrelated" /></>);
    expect(f.runtime.get("first")).toBe(first); expect(f.runtime.get("second")).toBe(second);
    const firstCtx = ensure(f.contexts.get("first"), "Cached context");
    const source = f.view.canvasRenderOwner.dataTokenInputs(f.view).store;
    const atNotification = vi.fn(() => {
      // Use the OLD context/hash deliberately. The root entry must already be
      // invalidated before the source notification, even before React rerenders.
      const observed = computed(() => f.view.canvasRenderOwner.render(f.component.tplTree, firstCtx, () => React.createElement("output", { children: source.getState()[0].tokens[0].value }))).get();
      expect(observed.props.children).toBe("({ items: [2], command() { return this.items[0]; } })");
    });
    const off = source.subscribe(atNotification);
    try {
      await act(async () => { await f.studio.changeUnsafe(() => { f.token.value = "({ items: [2], command() { return this.items[0]; } })"; }); });
    } finally { off(); }
    expect(atNotification).toHaveBeenCalledOnce();
    expect(mounted.getByTestId("first").textContent).toBe("2"); expect(mounted.getByTestId("second").textContent).toBe("2");
    expect(f.runtime.get("first")).not.toBe(f.runtime.get("second"));
    expect(f.renders.get("unrelated")).toHaveBeenCalledOnce();
    const settled = source.getState(), payload = f.runtime.get("first");
    await act(async () => { await f.studio.changeUnsafe(() => { f.site.flags.unrelatedDataTokenFlag = true; }); });
    expect(source.getState()).toBe(settled); expect(f.runtime.get("first")).toBe(payload);
  } finally { mounted.unmount(); f.studio.dispose(); }
});

it("releases component leases and seals the real owner on View disposal", async () => {
  const f = await renderFixture();
  const mounted = render(<f.Probe id="one" />);
  const owner = f.view.canvasRenderOwner, source = owner.dataTokenInputs(f.view).store;
  const changed = vi.fn(); source.subscribe(changed);
  mounted.unmount();
  // Repeated cleanup of the same lease cannot release another active lease.
  const first = owner.retainDataTokenConsumer("one"), second = owner.retainDataTokenConsumer("one");
  first(); first();
  await f.studio.changeUnsafe(() => { f.token.value = "3"; });
  expect(changed).toHaveBeenCalledOnce(); second(); second();
  f.studio.disposeViewCtx(f.view); expect(f.view.isDisposed).toBe(true); changed.mockClear();
  const subscribe = vi.spyOn(f.studio, "subscribeModelChanges");
  expect(() => owner.dataTokenInputs(f.view)).toThrow("Cannot read data-token inputs for a disposed canvas owner");
  expect(subscribe).not.toHaveBeenCalled();
  await f.studio.changeUnsafe(() => { f.token.value = "4"; });
  expect(changed).not.toHaveBeenCalled(); expect(source.getState()).toEqual([]);
  f.studio.dispose();
});


it("captures installed field values before delayed UI notifications and never publishes a half-old definition", () => {
  const f = fixture(); const field = f.models.field(f.local, "value"), publicField = vi.fn();
  const off = field.subscribe(publicField);
  try {
    f.models.deferPublication(() => {
      f.local.value = "8";
      f.models.sync([{ type: "update", oldValue: "1", newValue: "8", changeNode: { inst: f.local, field: "value" } }]);
      expect(field.getState()).toBe("8"); expect(publicField).not.toHaveBeenCalled();
      f.owner.prepareCommit();
      expect(f.owner.store.getState()[0].tokens[0].value).toBe("8");
      f.owner.publishCommit(); expect(publicField).not.toHaveBeenCalled();
    });
    expect(publicField).toHaveBeenCalledOnce();
  } finally { off(); f.dispose(); }
});


it("keeps empty-library metadata outside the value input while following its first token arrival", () => {
  const f = fixture(), empty = dependency("Empty library", "empty-project"), changed = vi.fn();
  f.owner.store.subscribe(changed);
  try {
    const before = f.owner.store.getState(), previous = f.site.projectDependencies.slice();
    f.site.projectDependencies.push(empty);
    f.commit([{ type: "update", oldValue: previous, newValue: f.site.projectDependencies, changeNode: { inst: f.site, field: "projectDependencies" } }]);
    expect(f.owner.store.getState()).toBe(before); expect(changed).not.toHaveBeenCalled();
    empty.name = "Renamed empty";
    f.commit([{ type: "update", oldValue: "Empty library", newValue: "Renamed empty", changeNode: { inst: empty, field: "name" } }]);
    expect(f.owner.store.getState()).toBe(before); expect(changed).not.toHaveBeenCalled();
    const arrived = mkDataToken({ name: "Arrived", value: "5" }); empty.site.dataTokens.push(arrived);
    f.commit([{ type: "update", oldValue: [], newValue: [arrived], changeNode: { inst: empty.site, field: "dataTokens" } }]);
    expect(changed).toHaveBeenCalledOnce();
    expect(evaluateDataTokenDefinitions(f.owner.store.getState(), {})?.pickerEnv.renamedEmpty.arrived).toBe(5);
  } finally { f.dispose(); }
});
