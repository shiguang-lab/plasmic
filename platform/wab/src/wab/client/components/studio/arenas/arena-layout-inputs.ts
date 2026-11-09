import { ModelFieldSelector } from "@/wab/client/stores/model-field-selector";
import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { arrayEq } from "@/wab/shared/common";
import type { Arena, ArenaFrameGrid } from "@/wab/shared/model/classes";
import * as React from "react";

/** Grid membership and React keys; dimensions belong to frame-height inputs. */
export function createGridLayoutInputs(studio: StudioCtx, grid: ArenaFrameGrid | undefined) {
  const models = studio.modelSnapshots;
  return new ModelFieldSelector(studio, (read) => {
    const values: unknown[] = [];
    if (grid) {
      values.push(read(grid, "rows"));
      for (const rowRef of read(grid, "rows")) {
        const row = models.resolve(rowRef), key = read(row, "rowKey");
        values.push(key, key && read(models.resolve(key), "uuid"), read(row, "cols"));
        for (const cellRef of read(row, "cols")) { values.push(read(models.resolve(cellRef), "frame")); }
      }
    }
    return Object.freeze(values);
  }, arrayEq);
}

export function useGridLayoutInputs(studio: StudioCtx, grid: ArenaFrameGrid | undefined) {
  const source = React.useMemo(() => createGridLayoutInputs(studio, grid), [studio, grid]);
  return React.useSyncExternalStore(source.subscribe, source.getSnapshot, source.getSnapshot);
}

/** Mixed-canvas extents consume authored position/width and native heights. */
export function createFreeLayoutInputs(studio: StudioCtx, arena: Arena) {
  const models = studio.modelSnapshots;
  return new ModelFieldSelector(studio, (read) => Object.freeze(read(arena, "children").map((ref) => {
    const frame = models.resolve(ref);
    return Object.freeze({ frame, uid: ref.uid, left: read(frame, "left") ?? 0, top: read(frame, "top") ?? 0, width: read(frame, "width") });
  })), (before, next) => arrayEq(before, next, (a, b) => a.frame === b.frame && a.left === b.left && a.top === b.top && a.width === b.width));
}

export function useFreeLayoutInputs(studio: StudioCtx, arena: Arena) {
  const source = React.useMemo(() => createFreeLayoutInputs(studio, arena), [studio, arena]);
  return React.useSyncExternalStore(source.subscribe, source.getSnapshot, source.getSnapshot);
}
