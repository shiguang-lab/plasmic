import { StudioSelection } from "@/wab/client/studio-ctx/studio-selection";
import type { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { mock } from "vitest-mock-extended";
import { ModelSnapshots } from "@/wab/client/studio-ctx/model-snapshots";
import { ViewSelection } from "@/wab/client/studio-ctx/view-selection";
import { mkTplTagX } from "@/wab/shared/core/tpls";
import { ValTag } from "@/wab/shared/core/val-nodes";
import $ from "jquery";

function value(tpl = mkTplTagX("div")) {
  return new ValTag({ tpl, children: [], className: "", key: "node", fullKey: "node[0]", frameUid: 1, fibers: [], parent: undefined, valOwner: undefined, slotInfo: undefined });
}

it("publishes one complete immutable selection and retains no-op identities", () => {
  const models = new ModelSnapshots();
  const selection = new ViewSelection(() => models);
  const val = value();
  const element = document.createElement("div");
  const changed = vi.fn();
  const stop = selection.store.subscribe(changed);
  selection.transaction(() => {
    selection.setTpls([val.tpl]);
    selection.setTargets([val]);
    selection.setCloneKeys(["clone"]);
    selection.setDoms([$(element)]);
    expect(changed).not.toHaveBeenCalled();
    expect(selection.tpls()[0]).toBe(val.tpl);
  });
  const committed = selection.store.getState();
  const commandDoms = selection.doms();
  const commandTargets = selection.targets();
  expect(changed).toHaveBeenCalledTimes(1);
  expect(committed.tpls[0]).toBe(models.ref(val.tpl));
  expect(committed.targets[0]?.fullKey).toBe("node[0]");
  expect(committed.cloneKeys).toEqual(["clone"]);
  expect(committed.doms).toEqual([[element]]);
  expect(Object.isFrozen(committed)).toBe(true);
  expect(Object.isFrozen(committed.tpls)).toBe(true);
  expect(Object.isFrozen(committed.doms[0])).toBe(true);
  selection.transaction(() => {
    selection.setTpls([val.tpl]); selection.setTargets([val]); selection.setCloneKeys(["clone"]); selection.setDoms([$(element)]);
  });
  expect(selection.store.getState()).toBe(committed);
  expect(selection.doms()).toBe(commandDoms);
  expect(selection.targets()).toBe(commandTargets);
  expect(changed).toHaveBeenCalledTimes(1);
  stop(); selection.dispose(); models.dispose();
});

it("rebinds runtime commands while preserving semantic targets and publishes actual DOM replacement", () => {
  const models = new ModelSnapshots();
  const selection = new ViewSelection(() => models);
  const first = value();
  const replacement = value(first.tpl);
  const element = document.createElement("div");
  selection.setTargets([first]);
  const snapshot = selection.store.getState();
  selection.setTargets([replacement]);
  expect(selection.store.getState()).toBe(snapshot);
  expect(selection.targets()[0]).toBe(replacement);
  selection.setHover(first, $(element));
  const hover = selection.store.getState();
  const commandDom = selection.hoverDom();
  selection.setHover(first, $(element));
  expect(selection.store.getState()).toBe(hover);
  expect(selection.hoverDom()).toBe(commandDom);
  const nextElement = document.createElement("span");
  selection.setHover(replacement, $(nextElement));
  expect(selection.store.getState().hover).toBe(hover.hover);
  expect(selection.store.getState().hoverDom).toEqual([nextElement]);
  expect(selection.hover()).toBe(replacement);
  selection.dispose(); models.dispose();
});

it("rolls back a failed selection and command rebinding without publishing partial arrays", () => {
  const models = new ModelSnapshots();
  const selection = new ViewSelection(() => models);
  const first = value();
  selection.transaction(() => {
    selection.setTpls([first.tpl]); selection.setTargets([first]); selection.setCloneKeys(["original"]); selection.setDoms([null]);
  });
  const original = selection.store.getState();
  const commands = selection.targets();
  const changed = vi.fn();
  selection.store.subscribe(changed);
  expect(() => selection.transaction(() => {
    selection.setTargets([value(first.tpl)]);
    selection.setTpls([mkTplTagX("span")]);
    throw new Error("selection failed");
  })).toThrow("selection failed");
  expect(selection.store.getState()).toBe(original);
  expect(selection.targets()).toBe(commands);
  expect(selection.targets()[0]).toBe(first);
  expect(changed).not.toHaveBeenCalled();
  selection.transaction(() => {
    selection.setCloneKeys(["outer"]);
    try {
      selection.transaction(() => { selection.setTargets([]); selection.setTpls([]); throw new Error("nested failed"); });
    } catch {
      selection.setDoms([null]);
    }
  });
  expect(changed).toHaveBeenCalledTimes(1);
  expect(selection.store.getState().tpls).toBe(original.tpls);
  expect(selection.targets()[0]).toBe(first);
  expect(selection.store.getState().cloneKeys).toEqual(["outer"]);
  selection.dispose(); models.dispose();
});

it("keeps the canonical snapshot when a successful transaction returns to the same selection", () => {
  const models = new ModelSnapshots();
  const selection = new ViewSelection(() => models);
  const first = value();
  selection.transaction(() => { selection.setTpls([first.tpl]); selection.setTargets([first]); selection.setCloneKeys(["first"]); selection.setDoms([null]); });
  const snapshot = selection.store.getState();
  const commands = selection.targets();
  const changed = vi.fn();
  selection.store.subscribe(changed);
  selection.transaction(() => { selection.setTpls([]); selection.setTargets([]); selection.setCloneKeys([]); selection.setDoms([]); selection.setTpls([first.tpl]); selection.setTargets([first]); selection.setCloneKeys(["first"]); selection.setDoms([null]); });
  expect(selection.store.getState()).toBe(snapshot);
  expect(selection.targets()).toBe(commands);
  expect(changed).not.toHaveBeenCalled();
  selection.dispose(); models.dispose();
});


it("owner exit overrides staged and deferred selections even when the command later throws", () => {
  const models = new ModelSnapshots();
  const view = new ViewSelection(() => models);
  const studio = new StudioSelection(() => models);
  const commandView = mock<ViewCtx>();
  const original = value();
  view.setTpls([original.tpl]);
  studio.set(commandView, []);
  const publish = vi.fn();
  studio.store.subscribe(publish);
  expect(() => studio.deferPublication(() => view.deferPublication(() => studio.transaction(() => view.transaction(() => {
    view.setTpls([mkTplTagX("span")]);
    studio.set(undefined, []);
    studio.dispose();
    view.dispose();
    models.dispose();
    throw new Error("closed during selection");
  }))))).toThrow("closed during selection");
  expect(studio.store.getState().view).toBeUndefined();
  expect(studio.current().view).toBeUndefined();
  expect(studio.frames()).toEqual([]);
  expect(view.store.getState().tpls).toEqual([]);
  expect(view.tpls()).toEqual([]);
  expect(view.targets()).toEqual([]);
  expect(publish).toHaveBeenCalledOnce();
  expect(() => studio.set(commandView, [])).toThrow("disposed Studio selection");
  expect(() => view.setTpls([original.tpl])).toThrow("disposed canvas selection");
});

it("installs staged Studio/canvas focus before publication and rolls back prepared nested failures", () => {
  const models = new ModelSnapshots(); const view = new ViewSelection(() => models); const studio = new StudioSelection(() => models);
  const first = value(); const second = value(mkTplTagX("span")); const commandView = mock<ViewCtx>();
  view.transaction(() => { view.setTpls([first.tpl]); view.setTargets([first]); view.setCloneKeys(["first"]); view.setDoms([null]); });
  studio.set(commandView, []);
  const beforeView = view.store.getState(); const beforeStudio = studio.store.getState(); const beforeCommands = view.targets(); const changed = vi.fn();
  const stops = [view.store.subscribe(changed), studio.store.subscribe(changed)];
  try {
    expect(() => studio.deferPublication(() => view.deferPublication(() => studio.transaction(() => view.transaction(() => {
      studio.set(undefined, []); view.setTpls([second.tpl]); view.setTargets([second]); view.setCloneKeys(["second"]); view.setDoms([null]);
      studio.prepareCommit(); view.prepareCommit();
      expect(studio.store.getState().view).toBeUndefined(); expect(view.store.getState().tpls).toEqual([models.ref(second.tpl)]);
      expect(changed).not.toHaveBeenCalled();
      try { view.transaction(() => { view.setTargets([value(second.tpl)]); view.prepareCommit(); throw new Error("nested prepared"); }); } catch (error) { expect(error).toEqual(new Error("nested prepared")); }
      expect(view.targets()[0]).toBe(second);
      throw new Error("prepared command failed");
    }))))).toThrow("prepared command failed");
    expect(studio.store.getState()).toBe(beforeStudio); expect(view.store.getState()).toBe(beforeView); expect(view.targets()).toBe(beforeCommands); expect(view.targets()[0]).toBe(first); expect(changed).not.toHaveBeenCalled();
    view.transaction(() => { view.setTpls([]); view.setTargets([]); view.setCloneKeys([]); view.setDoms([]); view.prepareCommit(); view.setTpls([first.tpl]); view.setTargets([first]); view.setCloneKeys(["first"]); view.setDoms([null]); view.prepareCommit(); });
    expect(view.store.getState()).toBe(beforeView); expect(changed).not.toHaveBeenCalled();
  } finally { stops.forEach((stop) => stop()); view.dispose(); studio.dispose(); models.dispose(); }
});
