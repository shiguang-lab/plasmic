import { CanvasGlobalContexts } from "@/wab/client/components/canvas/canvas-global-contexts";
import { CanvasModelInputs } from "@/wab/client/components/canvas/canvas-model-inputs";
import { ModelSnapshots } from "@/wab/client/studio-ctx/model-snapshots";
import type { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { mkArenaFrame } from "@/wab/shared/Arenas";
import { mkCodeComponent } from "@/wab/shared/code-components/code-components";
import { ComponentType, mkComponent } from "@/wab/shared/core/components";
import { codeLit } from "@/wab/shared/core/exprs";
import { mkParam } from "@/wab/shared/core/lang";
import type { ModelChange } from "@/wab/shared/core/observable-model";
import { createSite } from "@/wab/shared/core/sites";
import { mkTplComponentX, mkTplTagX } from "@/wab/shared/core/tpls";
import { ensureKnownTplComponent, ensureKnownRenderExpr, ensureKnownCustomCode, ObjInst } from "@/wab/shared/model/classes";
import { typeFactory } from "@/wab/shared/model/model-util";

function provider(name: string) {
  const children = mkParam({ name: "children", type: typeFactory.renderable(), paramType: "slot" });
  const label = mkParam({ name: "label", type: typeFactory.text(), paramType: "prop" });
  const component = mkCodeComponent(name, { name, importPath: `./${name}`, props: { label: "string" } }, {});
  component.params.push(children, label);
  component.codeComponentMeta.isContext = true;
  return mkTplComponentX({ component, baseVariant: component.variants[0], args: { label: codeLit(name) } });
}

function fixture() {
  const site = createSite();
  const component = mkComponent({ name: "Page", type: ComponentType.Plain, tplTree: mkTplTagX("main") });
  const frame = mkArenaFrame({ site, component, name: "Page", width: 800, height: 600 });
  const first = provider("First"), second = provider("Second");
  site.globalContexts.push(first, second);
  const models = new ModelSnapshots(), inputs = new CanvasModelInputs(models);
  const view = { site, studioCtx: { modelSnapshots: models }, arenaFrame: () => frame, componentArgsContainer: () => frame.container } as unknown as ViewCtx;
  const contexts = new CanvasGlobalContexts(view, inputs);
  const change = (inst: ObjInst, field: string): ModelChange => ({ type: "update", oldValue: undefined, newValue: Reflect.get(inst, field), changeNode: { inst, field } });
  const commit = (changes: ModelChange[]) => {
    models.sync(changes);
    inputs.prepareCommit(); contexts.prepareCommit(); inputs.prepareCommit();
    inputs.publishCommit(); contexts.publishCommit();
  };
  return { site, frame, first, second, models, inputs, contexts, change, commit,
    dispose: () => { contexts.dispose(); inputs.dispose(); models.dispose(); } };
}

it("installs nonobservable provider-clone updates before publishing native model inputs", () => {
  const f = fixture();
  const root = ensureKnownTplComponent(f.models.resolve(f.contexts.store.getState().root));
  const model = f.inputs.node(root);
  const notify = vi.fn(); model.subscribe(notify);
  const rootBefore = f.contexts.store.getState();
  const oldArg = root.vsettings[0].args.find((arg) => arg.param.variable.name === "label");
  const sourceArg = f.first.vsettings[0].args[0];
  sourceArg.expr = codeLit("Changed");
  f.commit([f.change(sourceArg, "expr")]);
  expect(f.contexts.store.getState()).toBe(rootBefore);
  expect(notify).toHaveBeenCalledTimes(1);
  expect(ensureKnownCustomCode(oldArg?.expr).code).toContain("Changed");
  const after = model.getState();
  f.commit([f.change(sourceArg, "expr")]);
  expect(model.getState()).toBe(after);
  expect(notify).toHaveBeenCalledTimes(1);
  f.dispose();
});

it("publishes provider order/root identity and flags while preserving business parent pointers", () => {
  const f = fixture();
  const root = f.frame.container, parent = root.parent;
  const original = f.contexts.store.getState();
  const notify = vi.fn(); f.contexts.store.subscribe(notify);
  f.site.globalContexts.reverse();
  f.commit([f.change(f.site, "globalContexts")]);
  expect(f.contexts.store.getState().root).not.toBe(original.root);
  const outer = ensureKnownTplComponent(f.models.resolve(f.contexts.store.getState().root));
  expect(outer.uuid).toBe(f.second.uuid);
  const inner = ensureKnownTplComponent(ensureKnownRenderExpr(outer.vsettings[0].args.find((arg) => arg.param.variable.name === "children")?.expr).tpl[0]);
  expect(inner.uuid).toBe(f.first.uuid);
  expect(root.parent).toBe(parent);
  f.site.flags.testInput = true;
  f.commit([f.change(f.site, "flags")]);
  expect(f.contexts.store.getState().flags.testInput).toBe(true);
  expect(notify).toHaveBeenCalledTimes(2);
  f.site.globalContexts = [];
  f.commit([f.change(f.site, "globalContexts")]);
  expect(f.models.resolve(f.contexts.store.getState().root)).toBe(root);
  f.dispose();
});

it("publishes parent/provider changes atomically and detaches disposed context listeners", () => {
  const f = fixture();
  const outer = ensureKnownTplComponent(f.models.resolve(f.contexts.store.getState().root));
  const outerInput = f.inputs.node(outer);
  const sourceArg = f.second.vsettings[0].args[0];
  const outerArg = f.first.vsettings[0].args[0];
  const before = outerInput.getState();
  const observed: unknown[] = [];
  outerInput.subscribe(() => observed.push([outerInput.getState(), f.contexts.store.getState()]));
  outerArg.expr = codeLit("Outer"); sourceArg.expr = codeLit("Inner"); f.site.flags.atomic = true;
  f.commit([f.change(outerArg, "expr"), f.change(sourceArg, "expr"), f.change(f.site, "flags")]);
  expect(observed).toHaveLength(1);
  expect(observed[0]).toEqual([outerInput.getState(), f.contexts.store.getState()]);
  expect(outerInput.getState()).not.toBe(before);
  const listener = vi.fn(); f.contexts.store.subscribe(listener);
  f.contexts.dispose(); f.contexts.dispose();
  f.site.globalContexts = [];
  f.commit([f.change(f.site, "globalContexts")]);
  expect(listener).not.toHaveBeenCalled();
  f.dispose();
});
