import { ensureKnownTplTag } from "@/wab/shared/model/classes";
import { NavigationCatalogInputs } from "@/wab/client/components/sidebar-tabs/ProjectPanel/navigation-catalog-inputs";
import { ModelSnapshots } from "@/wab/client/studio-ctx/model-snapshots";
import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { TplMgr } from "@/wab/shared/TplMgr";
import { mkMixedArena } from "@/wab/shared/Arenas";
import { ComponentType } from "@/wab/shared/core/components";
import { createSite } from "@/wab/shared/core/sites";
import { ChangeRecorder } from "@/wab/shared/core/observable-model";
import { instUtil } from "@/wab/shared/model/InstUtil";
import { ensure } from "@/wab/shared/common";

const disposals: (() => void)[] = [];
afterEach(() => disposals.splice(0).forEach((dispose) => dispose()));
function fixture(contentEditorMode = false) {
  const site = createSite(), manager = new TplMgr({ site });
  const page = manager.addComponent({ name: "Pages/Zebra", type: ComponentType.Page });
  const component = manager.addComponent({ name: "Components/Badge", type: ComponentType.Plain });
  const arena = mkMixedArena("Canvas"); site.arenas.push(arena);
  const models = new ModelSnapshots(), lifetime = new AbortController();
  const studio = { site, modelSnapshots: models, arenaState: { lifetime: () => lifetime.signal } } as unknown as StudioCtx;
  const recorder = new ChangeRecorder({ inst: site, _instUtil: instUtil });
  const source = new NavigationCatalogInputs(studio, contentEditorMode);
  const changed = vi.fn(), stop = source.subscribe(changed);
  const edit = (fn: () => void) => models.sync(recorder.withRecording(fn).changes);
  disposals.push(() => { stop(); lifetime.abort(); models.dispose(); recorder.dispose(); });
  return { site, manager, page, component, arena, models, source, changed, edit, lifetime };
}

it("tracks names, page search paths and membership without tracking canvas contents", () => {
  const f = fixture();
  const before = f.source.getSnapshot();
  f.edit(() => { ensureKnownTplTag(f.component.tplTree).name = "Unrelated element"; });
  expect(f.source.getSnapshot()).toBe(before);
  expect(f.changed).not.toHaveBeenCalled();
  f.edit(() => { f.page.name = "Pages/Alpha"; });
  expect(f.source.getSnapshot()).not.toBe(before);
  expect(f.source.getSnapshot().pages.map((row) => row.name)).toEqual(["Pages/Alpha"]);
  expect(before.pages[0].name).toBe("Pages/Zebra");
  const renamed = f.source.getSnapshot();
  f.edit(() => { ensure(f.page.pageMeta, "Page metadata").path = "/customers"; });
  expect(f.source.getSnapshot()).not.toBe(renamed);
  f.edit(() => { f.site.arenas.push(mkMixedArena("Another")); });
  expect(f.source.getSnapshot().mixed.map((row) => row.name)).toEqual(["Custom arena 1", "Canvas", "Another"]);
});

it("keeps each directory section in insertion order after additions and renames", () => {
  const f = fixture();
  f.edit(() => {
    f.manager.addArena("Alpha");
    f.manager.addComponent({ name: "Pages/Alpha", type: ComponentType.Page });
    f.manager.addComponent({ name: "Components/Alpha", type: ComponentType.Plain });
    const child = f.manager.addComponent({ name: "Child", type: ComponentType.Plain });
    child.superComp = f.component;
    f.component.subComps.push(child);
  });
  const added = f.source.getSnapshot();
  expect(added.mixed.map((row) => row.name)).toEqual(["Custom arena 1", "Canvas", "Alpha"]);
  expect(added.pages.map((row) => row.name)).toEqual(["Pages/Zebra", "Pages/Alpha"]);
  expect(added.components.map((row) => row.name)).toEqual(["Components/Badge", "Components/Alpha", "Child"]);

  f.edit(() => {
    f.arena.name = "Zulu";
    f.page.name = "Pages/Zulu";
    f.component.name = "Components/Zulu";
  });
  const renamed = f.source.getSnapshot();
  expect(renamed.mixed.map((row) => row.name)).toEqual(["Custom arena 1", "Zulu", "Alpha"]);
  expect(renamed.pages.map((row) => row.name)).toEqual(["Pages/Zulu", "Pages/Alpha"]);
  expect(renamed.components.map((row) => row.name)).toEqual(["Components/Zulu", "Components/Alpha", "Child"]);
});

it("applies content creator permissions and closes at the model lifetime boundary", () => {
  const f = fixture(true);
  f.edit(() => { f.page.editableByContentEditor = false; f.component.editableByContentEditor = false; });
  expect(f.source.getSnapshot().mixed).toEqual([]);
  expect(f.source.getSnapshot().pages).toEqual([]);
  expect(f.source.getSnapshot().components).toEqual([]);
  f.edit(() => { f.page.editableByContentEditor = true; });
  expect(f.source.getSnapshot().pages).toHaveLength(1);
  f.lifetime.abort();
  expect(f.source.getSnapshot().pages).toEqual([]);
  f.changed.mockClear();
  f.edit(() => { f.page.name = "After close"; });
  expect(f.changed).not.toHaveBeenCalled();
});
