import { FrameViewMode, getArenaFrames } from "@/wab/shared/Arenas";
import { TplMgr } from "@/wab/shared/TplMgr";
import { isPageComponent } from "@/wab/shared/core/components";
import { getDedicatedArena } from "@/wab/shared/core/sites";
import { Pt } from "@/wab/shared/geom";
import { Site } from "@/wab/shared/model/classes";

/** Reuse the existing canvas with the most page references. */
export function findPageOverviewArena(site: Site) {
  return site.arenas
    .filter(
      (arena) =>
        arena.children.length > 0 &&
        arena.children.every((frame) =>
          isPageComponent(frame.container.component),
        ),
    )
    .sort(
      (a, b) =>
        new Set(b.children.map((frame) => frame.container.component)).size -
        new Set(a.children.map((frame) => frame.container.component)).size,
    )[0];
}

/** Adds frame references only; page content and existing frame positions stay shared. */
export function ensurePageOverviewArena(tplMgr: TplMgr) {
  const site = tplMgr.site();
  const existing = findPageOverviewArena(site);
  const arena = existing ?? tplMgr.addArena("Pages overview");
  const pages = site.components.filter(isPageComponent);
  const baseFrames = pages.map(
    (page) => getArenaFrames(getDedicatedArena(site, page))[0],
  );
  const columnWidth =
    Math.max(1440, ...baseFrames.map((frame) => frame?.width ?? 1440)) + 80;
  const rowHeight =
    Math.max(900, ...baseFrames.map((frame) => frame?.height ?? 900)) + 80;
  let added = 0;
  for (const [index, page] of pages.entries()) {
    if (arena.children.some((frame) => frame.container.component === page)) {
      continue;
    }
    const base = baseFrames[index];
    const insertPt = existing
      ? new Pt(
          Math.max(
            ...arena.children.map((frame) => (frame.left ?? 0) + frame.width),
          ) + 80,
          0,
        )
      : new Pt((added % 2) * columnWidth, Math.floor(added / 2) * rowHeight);
    const frame = tplMgr.addNewMixedArenaFrame(arena, page.name, page, {
      width: base?.width ?? 1440,
      height: base?.height ?? 900,
      viewMode:
        base?.viewMode === "centered"
          ? FrameViewMode.Centered
          : FrameViewMode.Stretch,
      insertPt,
    });
    frame.left = insertPt.x;
    frame.top = insertPt.y;
    added++;
  }
  return arena;
}
