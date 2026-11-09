import { ComponentLibraryInputs, ProjectLibraryInputs } from "@/wab/client/components/sidebar/library-inputs";
import { ModelSnapshots } from "@/wab/client/studio-ctx/model-snapshots";
import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { TplMgr } from "@/wab/shared/TplMgr";
import { ComponentType } from "@/wab/shared/core/components";
import { createSite } from "@/wab/shared/core/sites";
import { ChangeRecorder } from "@/wab/shared/core/observable-model";
import { instUtil } from "@/wab/shared/model/InstUtil";
import { ProjectDependency, ensureKnownTplTag, isKnownProjectDependency } from "@/wab/shared/model/classes";

const disposals: (() => void)[] = [];
afterEach(() => disposals.splice(0).forEach((dispose) => dispose()));
function fixture() {
  const site = createSite(), manager = new TplMgr({ site });
  const component = manager.addComponent({ name: "Folder/Badge", type: ComponentType.Plain });
  const dependencySite = createSite();
  const dependency = new ProjectDependency({ uuid: "dependency", name: "Library", pkgId: "pkg", projectId: "project", version: "1.0.0", site: dependencySite });
  site.projectDependencies.push(dependency);
  const models = new ModelSnapshots(), lifetime = new AbortController();
  const studio = { site, modelSnapshots: models, arenaState: { lifetime: () => lifetime.signal } } as unknown as StudioCtx;
  const recorder = new ChangeRecorder({ inst: site, _instUtil: instUtil, isExternalRef: isKnownProjectDependency });
  const dependencyRecorder = new ChangeRecorder({ inst: dependency, _instUtil: instUtil });
  const edit = (fn: () => void) => models.sync(recorder.withRecording(fn).changes);
  const editDependency = (fn: () => void) => models.sync(dependencyRecorder.withRecording(fn).changes);
  disposals.push(() => { lifetime.abort(); models.dispose(); recorder.dispose(); dependencyRecorder.dispose(); });
  return { site, component, dependency, dependencySite, studio, edit, editDependency, lifetime };
}

it("component catalogs track labels while canvas contents and imported layouts remain unrelated", () => {
  const f = fixture(), source = new ComponentLibraryInputs(f.studio), changed = vi.fn(), stop = source.subscribe(changed);
  disposals.push(stop);
  const before = source.getSnapshot();
  f.edit(() => { ensureKnownTplTag(f.component.tplTree).name = "Canvas-only name"; });
  expect(source.getSnapshot()).toBe(before);
  expect(changed).not.toHaveBeenCalled();
  f.edit(() => { f.component.name = "Another/Badge"; });
  expect(changed).toHaveBeenCalledOnce();
});

it("dependency summaries react to name/version fields and stop at owner closure", () => {
  const f = fixture(), source = new ProjectLibraryInputs(f.studio), changed = vi.fn(), stop = source.subscribe(changed);
  disposals.push(stop);
  const before = source.getSnapshot();
  const initialName = f.dependency.name;
  f.editDependency(() => { f.dependency.name = "Renamed library"; f.dependency.version = "2.0.0"; });
  expect(source.getSnapshot().entries[0].name).toBe("Renamed library");
  expect(source.getSnapshot().entries[0].version).toBe("2.0.0");
  expect(before.entries[0].name).toBe(initialName);
  expect(changed).toHaveBeenCalledOnce();
  f.lifetime.abort();
  expect(source.getSnapshot().dependencies).toEqual([]);
  changed.mockClear();
  f.editDependency(() => { f.dependency.name = "After close"; });
  expect(changed).not.toHaveBeenCalled();
});
