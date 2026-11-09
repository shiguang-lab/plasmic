import { createFreeLayoutInputs, createGridLayoutInputs } from "@/wab/client/components/studio/arenas/arena-layout-inputs";
import { DedicatedArenaInputs } from "@/wab/client/components/studio/arenas/dedicated-arena-inputs";
import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { ModelSnapshots } from "@/wab/client/studio-ctx/model-snapshots";
import { cloneArenaFrame, mkMixedArena } from "@/wab/shared/Arenas";
import { TplMgr } from "@/wab/shared/TplMgr";
import { ensure } from "@/wab/shared/common";
import { ComponentType } from "@/wab/shared/core/components";
import { ChangeRecorder } from "@/wab/shared/core/observable-model";
import { createSite } from "@/wab/shared/core/sites";
import { ensureKnownTplTag } from "@/wab/shared/model/classes";
import { instUtil } from "@/wab/shared/model/InstUtil";

it("isolates grid membership, mixed-frame geometry and page labels from document content", () => {
  const site = createSite(), mgr = new TplMgr({ site });
  const page = mgr.addComponent({ type: ComponentType.Page, name: "Customers" });
  const arena = ensure(site.pageArenas[0], "Page arena"), cell = ensure(arena.matrix.rows[0]?.cols[0], "Page cell");
  const frame = cloneArenaFrame(cell.frame), mixed = mkMixedArena("Mixed", [frame]);
  site.arenas.push(mixed);
  const models = new ModelSnapshots(), lifetime = new AbortController();
  const studio = { site, modelSnapshots: models, arenaState: { lifetime: () => lifetime.signal } } as unknown as StudioCtx;
  const recorder = new ChangeRecorder({ inst: site, _instUtil: instUtil });
  const grid = createGridLayoutInputs(studio, arena.matrix), free = createFreeLayoutInputs(studio, mixed), labels = new DedicatedArenaInputs(studio, arena);
  const gridChanged = vi.fn(), freeChanged = vi.fn(), labelsChanged = vi.fn();
  const stops = [grid.subscribe(gridChanged), free.subscribe(freeChanged), labels.subscribe(labelsChanged)];
  const commit = (command: () => void) => models.sync(recorder.withRecording(command).changes);
  [gridChanged, freeChanged, labelsChanged].forEach((fn) => fn.mockClear());
  try {
    commit(() => { ensureKnownTplTag(page.tplTree).vsettings[0].rs.values.color = "red"; });
    expect(gridChanged).not.toHaveBeenCalled(); expect(freeChanged).not.toHaveBeenCalled(); expect(labelsChanged).not.toHaveBeenCalled();
    commit(() => { frame.left = 30; frame.width += 20; });
    expect(freeChanged).toHaveBeenCalledTimes(1); expect(gridChanged).not.toHaveBeenCalled();
    commit(() => { arena.matrix.rows[0].cols.push(cell); });
    expect(gridChanged).toHaveBeenCalledTimes(1);
    const previousGrid = grid.getSnapshot();
    commit(() => { cell.frame.width += 20; });
    expect(grid.getSnapshot()).toBe(previousGrid);
    expect(gridChanged).toHaveBeenCalledTimes(1);
    commit(() => { page.name = "Clients"; });
    expect(labelsChanged).toHaveBeenCalled();
    lifetime.abort();
    expect(grid.getSnapshot()).toBeUndefined(); expect(free.getSnapshot()).toBeUndefined();
    [gridChanged, freeChanged].forEach((fn) => fn.mockClear());
    commit(() => { frame.left = 90; arena.matrix.rows[0].cols.pop(); });
    expect(gridChanged).not.toHaveBeenCalled(); expect(freeChanged).not.toHaveBeenCalled();
  } finally { stops.forEach((stop) => stop()); recorder.dispose(); models.dispose(); }
});
