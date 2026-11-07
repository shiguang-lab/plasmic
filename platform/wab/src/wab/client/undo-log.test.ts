import { fakeStudioCtx } from "@/wab/client/__testonly__/fake-init-ctx";
import { MAX_UNDO_STEPS } from "@/wab/client/undo-log";
import { ComponentType, mkComponent } from "@/wab/shared/core/components";
import { createSite } from "@/wab/shared/core/sites";
import { mkTplTagX } from "@/wab/shared/core/tpls";
import { ensureKnownTplTag } from "@/wab/shared/model/classes";

function setup() {
  const site = createSite();
  const component = mkComponent({
    name: "History",
    type: ComponentType.Plain,
    tplTree: (baseVariant) =>
      mkTplTagX("div", { baseVariant, name: "Initial" }),
  });
  site.components.push(component);
  const { studioCtx: sc } = fakeStudioCtx({ site });
  sc.dbCtx().maybeObserveComponents([component]);
  sc.createViewStateUndoRecord();
  const root = ensureKnownTplTag(component.tplTree);
  const edit = (name: string, noUndoRecord = false) =>
    sc.changeUnsafe(
      () => {
        root.name = name;
      },
      { noUndoRecord },
    );
  return { sc, root, edit };
}

it("retains exactly the latest 50 steps and a view-only anchor without changing pending save events", async () => {
  const { sc, root, edit } = setup();
  try {
    expect(MAX_UNDO_STEPS).toBe(50);
    await edit("Step1");
    const first = sc.undoLog._log[1],
      events = first.changes.changes;
    for (let i = 2; i <= 250; i++) {await edit("Step" + i);}
    expect(sc.undoLog._log.length).toBe(MAX_UNDO_STEPS + 1);
    expect(sc.undoLog._nextInsertPos).toBe(MAX_UNDO_STEPS + 1);
    expect(sc.undoLog._log[0].changes).toEqual({
      changes: [],
      newInsts: [],
      removedInsts: [],
    });
    expect(first.changes.changes).toBe(events);
    expect(events.length).toBeGreaterThan(0);
    expect(sc["_changeRecords"].length).toBe(250);
    for (let i = 0; i < MAX_UNDO_STEPS; i++) {await sc.undo();}
    expect(root.name).toBe(`Step${250 - MAX_UNDO_STEPS}`);
    expect(sc.canUndo()).toBe(false);
    for (let i = 0; i < MAX_UNDO_STEPS; i++) {await sc.redo();}
    expect(root.name).toBe("Step250");
    expect(sc.canRedo()).toBe(false);
  } finally {
    sc.dispose();
  }
});

it("keeps redo during selection changes and discards only the redo branch on a new edit", async () => {
  const { sc, root, edit } = setup();
  try {
    for (let i = 1; i <= 130; i++) {await edit("Step" + i);}
    for (let i = 0; i < 40; i++) {await sc.undo();}
    sc.createViewStateUndoRecord();
    expect(sc.canRedo()).toBe(true);
    await edit("Branch");
    expect(sc.canRedo()).toBe(false);
    expect(sc.undoLog._log.length).toBe(MAX_UNDO_STEPS + 2 - 40);
    await sc.undo();
    expect(root.name).toBe("Step90");
    for (let i = 0; i < MAX_UNDO_STEPS - 40; i++) {await sc.undo();}
    expect(root.name).toBe(`Step${130 - MAX_UNDO_STEPS}`);
    expect(sc.canUndo()).toBe(false);
  } finally {
    sc.dispose();
  }
});

it("preserves grouped interaction boundaries through rollover", async () => {
  const { sc, root, edit } = setup();
  try {
    for (let step = 1; step <= 120; step++) {
      sc.startUnlogged();
      for (let part = 0; part < 3; part++) {await edit(`Gesture${step}_${part}`);}
      sc.stopUnlogged();
    }
    expect(sc.undoLog._log.length).toBe(MAX_UNDO_STEPS + 1);
    await sc.undo();
    expect(root.name).toBe("Gesture119_2");
    for (let i = 1; i < MAX_UNDO_STEPS; i++) {await sc.undo();}
    expect(root.name).toBe(`Gesture${120 - MAX_UNDO_STEPS}_2`);
    expect(sc.canUndo()).toBe(false);
    for (let i = 0; i < MAX_UNDO_STEPS; i++) {await sc.redo();}
    expect(root.name).toBe("Gesture120_2");
  } finally {
    sc.dispose();
  }
});

it("merges noUndoRecord fixups into the latest retained step", async () => {
  const { sc, root, edit } = setup();
  try {
    for (let i = 1; i <= 110; i++) {await edit("Step" + i);}
    await edit("Fixup", true);
    expect(sc.undoLog._log.length).toBe(MAX_UNDO_STEPS + 1);
    await sc.undo();
    expect(root.name).toBe("Step109");
    await sc.redo();
    expect(root.name).toBe("Fixup");
  } finally {
    sc.dispose();
  }
});

it("allows a new branch after undoing to the retained anchor", async () => {
  const { sc, root, edit } = setup();
  try {
    for (let i = 1; i <= 120; i++) {await edit("Step" + i);}
    for (let i = 0; i < MAX_UNDO_STEPS; i++) {await sc.undo();}
    expect(root.name).toBe(`Step${120 - MAX_UNDO_STEPS}`);
    sc.createViewStateUndoRecord();
    await edit("Branch");
    expect(sc.undoLog._log.length).toBe(2);
    expect(sc.canRedo()).toBe(false);
    await sc.undo();
    expect(root.name).toBe(`Step${120 - MAX_UNDO_STEPS}`);
    expect(sc.canUndo()).toBe(false);
  } finally {
    sc.dispose();
  }
});

it("drops only the oldest step when the 51st edit is recorded", async () => {
  const { sc, root, edit } = setup();
  try {
    for (let i = 1; i <= 50; i++) {await edit(`Step${i}`);}
    for (let i = 0; i < 50; i++) {await sc.undo();}
    expect(root.name).toBe("Initial");
    expect(sc.canUndo()).toBe(false);
    for (let i = 0; i < 50; i++) {await sc.redo();}
    await edit("Step51");
    expect(sc.undoLog._log.length).toBe(51);
    for (let i = 0; i < 50; i++) {await sc.undo();}
    expect(root.name).toBe("Step1");
    expect(sc.canUndo()).toBe(false);
  } finally {
    sc.dispose();
  }
});

it("publishes only availability boundaries across edits, selection records and branch replacement", async () => {
  const { sc, edit } = setup();
  const changed = vi.fn();
  const off = sc.undoLog.store.subscribe(changed);
  const states: unknown[] = [];
  const offSnapshot = sc.undoLog.store.subscribe((state) => states.push(state));
  try {
    const initial = sc.undoLog.store.getState();
    for (let i = 0; i < 30; i++) {sc.createViewStateUndoRecord();}
    expect(sc.undoLog.store.getState()).toBe(initial);
    expect(changed).not.toHaveBeenCalled();
    await edit("First");
    const canUndo = sc.undoLog.store.getState();
    expect(canUndo).toEqual({ canUndo: true, canRedo: false });
    for (let i = 0; i < 10; i++) {await edit(`Next${i}`);}
    expect(changed).toHaveBeenCalledOnce();
    expect(sc.undoLog.store.getState()).toBe(canUndo);
    await sc.undo();
    expect(sc.undoLog.store.getState()).toEqual({
      canUndo: true,
      canRedo: true,
    });
    const undoCount = changed.mock.calls.length;
    await sc.undo();
    sc.createViewStateUndoRecord();
    expect(changed).toHaveBeenCalledTimes(undoCount);
    await edit("New branch");
    expect(sc.undoLog.store.getState()).toEqual({
      canUndo: true,
      canRedo: false,
    });
    expect(changed).toHaveBeenCalledTimes(undoCount + 1);
    expect(states).toEqual([
      { canUndo: true, canRedo: false },
      { canUndo: true, canRedo: true },
      { canUndo: true, canRedo: false },
    ]);
    off();
    offSnapshot();
    changed.mockClear();
    await sc.undo();
    expect(changed).not.toHaveBeenCalled();
  } finally {
    off();
    offSnapshot();
    sc.dispose();
  }
});

it.each(["undo", "redo"] as const)(
  "does not publish transient cursor state when %s fails",
  async (operation) => {
    const { sc, edit } = setup();
    try {
      await edit("Changed");
      if (operation === "redo") {await sc.undo();}
      const snapshot = sc.undoLog.store.getState();
      const cursor = sc.undoLog._nextInsertPos;
      const changed = vi.fn();
      const off = sc.undoLog.store.subscribe(changed);
      const restore = vi
        .spyOn(sc.undoLog, "_restore")
        .mockImplementation(() => {
          expect(sc.undoLog.store.getState()).toBe(snapshot);
          throw new Error("Restore failed");
        });
      expect(() => sc.undoLog[operation]()).toThrow("Restore failed");
      expect(sc.undoLog._nextInsertPos).toBe(cursor);
      expect(sc.undoLog.store.getState()).toBe(snapshot);
      expect(changed).not.toHaveBeenCalled();
      restore.mockRestore();
      off();
    } finally {
      sc.dispose();
    }
  },
);

it("holds availability notifications until the completed synchronous command and skips a grouped undo-redo no-op", async () => {
  const { sc, root, edit } = setup();
  try {
    await edit("Changed");
    const history = sc.undoLog;
    const before = history.store.getState();
    let completed = false;
    const changed = vi.fn(() => {
      expect(completed).toBe(true);
      expect(root.name).toBe("Initial");
      expect(history.store.getState()).toEqual({ canUndo: false, canRedo: true });
    });
    const stop = history.store.subscribe(changed);
    history.deferPublication(() => {
      history.undo();
      expect(history.store.getState()).toEqual({ canUndo: false, canRedo: true });
      history.deferPublication(() => { history.redo(); });
      expect(history.store.getState()).toBe(before);
      expect(changed).not.toHaveBeenCalled();
    });
    expect(changed).not.toHaveBeenCalled();
    history.deferPublication(() => {
      history.undo();
      expect(changed).not.toHaveBeenCalled();
      completed = true;
    });
    expect(changed).toHaveBeenCalledOnce();
    stop();
  } finally {
    sc.dispose();
  }
});
