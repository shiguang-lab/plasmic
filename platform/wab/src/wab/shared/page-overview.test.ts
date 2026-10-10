import { TplMgr } from "@/wab/shared/TplMgr";
import { Bundler } from "@/wab/shared/bundler";
import { ComponentType } from "@/wab/shared/core/components";
import { createSite } from "@/wab/shared/core/sites";
import { Pt } from "@/wab/shared/geom";
import { isKnownSite } from "@/wab/shared/model/classes";
import { ensurePageOverviewArena } from "@/wab/shared/page-overview";

it("shares four real pages, preserves moved frames, and persists references without duplicating page content", () => {
  const site = createSite();
  const tplMgr = new TplMgr({ site });
  const pages = Array.from({ length: 4 }, (_, index) =>
    tplMgr.addComponent({ name: `Page${index + 1}`, type: ComponentType.Page }),
  );
  const arena = ensurePageOverviewArena(tplMgr);
  expect(arena.children).toHaveLength(4);
  expect(arena.children.map((frame) => frame.container.component)).toEqual(
    pages,
  );
  arena.children[0].left = 200;
  arena.children[0].top = 120;
  const positions = arena.children.map(
    (frame) => new Pt(frame.left ?? 0, frame.top ?? 0),
  );
  const nextPage = tplMgr.addComponent({
    name: "Page5",
    type: ComponentType.Page,
  });
  expect(ensurePageOverviewArena(tplMgr)).toBe(arena);
  expect(arena.children).toHaveLength(5);
  expect(
    arena.children
      .slice(0, 4)
      .map((frame) => new Pt(frame.left ?? 0, frame.top ?? 0)),
  ).toEqual(positions);
  expect(arena.children[4].container.component).toBe(nextPage);
  const saved = new Bundler().bundle(site, "overview-site", "test-version");
  const reopened = new Bundler().unbundle(saved, "overview-site");
  expect(isKnownSite(reopened)).toBe(true);
  if (!isKnownSite(reopened)) {
    throw new Error("Expected a saved Site");
  }
  const reopenedArena = reopened.arenas.find(
    (item) => item.name === arena.name,
  );
  expect(
    reopenedArena?.children.map((frame) => frame.container.component),
  ).toEqual(
    reopened.components.filter(
      (component) => component.type === ComponentType.Page,
    ),
  );
  expect(
    reopenedArena?.children
      .slice(0, 4)
      .map((frame) => new Pt(frame.left ?? 0, frame.top ?? 0)),
  ).toEqual(positions);
  expect(
    reopened.components.filter(
      (component) => component.type === ComponentType.Page,
    ),
  ).toHaveLength(5);
});
