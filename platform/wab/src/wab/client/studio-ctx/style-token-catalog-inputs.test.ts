import { StyleTokenCatalogInputs } from "@/wab/client/studio-ctx/style-token-catalog-inputs";
import { ModelSnapshots } from "@/wab/client/studio-ctx/model-snapshots";
import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { mkStyleToken } from "@/wab/commons/StyleToken";
import { VariantedStylesHelper } from "@/wab/shared/VariantedStylesHelper";
import { ChangeRecorder } from "@/wab/shared/core/observable-model";
import { createSite } from "@/wab/shared/core/sites";
import { instUtil } from "@/wab/shared/model/InstUtil";
import { ProjectDependency, isKnownProjectDependency } from "@/wab/shared/model/classes";

const disposals: (() => void)[] = [];
afterEach(() => disposals.splice(0).forEach((stop) => stop()));
function fixture() {
  const site = createSite(), imported = createSite();
  const color = mkStyleToken({ name: "Color", type: "Color", value: "red" }), spacing = mkStyleToken({ name: "Space", type: "Spacing", value: "12px" });
  site.styleTokens.push(color, spacing);
  const dependency = new ProjectDependency({ uuid: "tokens-dep", pkgId: "tokens-pkg", projectId: "tokens-project", version: "1", name: "Tokens", site: imported });
  site.projectDependencies.push(dependency);
  const models = new ModelSnapshots(), lifetime = new AbortController();
  const studio = { site, modelSnapshots: models, singleRsStyleInputs: { isDisposed: false }, arenaState: { lifetime: () => lifetime.signal } } as unknown as StudioCtx;
  const recorder = new ChangeRecorder({ inst: site, _instUtil: instUtil, isExternalRef: isKnownProjectDependency });
  const importedRecorder = new ChangeRecorder({ inst: dependency, _instUtil: instUtil });
  const edit = (fn: () => void) => models.sync(recorder.withRecording(fn).changes);
  const editImported = (fn: () => void) => models.sync(importedRecorder.withRecording(fn).changes);
  disposals.push(() => { lifetime.abort(); recorder.dispose(); importedRecorder.dispose(); models.dispose(); });
  return { site, imported, color, spacing, studio, edit, editImported, lifetime };
}

it("subscribes only direct candidate membership and relevant labels, leaving values to existing token sources", () => {
  const f = fixture(), source = new StyleTokenCatalogInputs(f.studio, "Color", new VariantedStylesHelper()), changed = vi.fn();
  disposals.push(source.subscribe(changed)); changed.mockClear();
  f.edit(() => { f.color.value = "blue"; f.spacing.name = "Unrelated spacing label"; });
  expect(changed).not.toHaveBeenCalled();
  f.edit(() => { f.color.name = "Renamed color"; });
  expect(changed).toHaveBeenCalledOnce(); changed.mockClear();
  f.editImported(() => { f.imported.styleTokens.push(mkStyleToken({ name: "Imported", type: "Color", value: "green" })); });
  expect(changed).toHaveBeenCalledOnce();
});

it("keeps a stable local editor key across new queries and retires all old-world fields", () => {
  const f = fixture(), source = new StyleTokenCatalogInputs(f.studio, "Color", new VariantedStylesHelper()), changed = vi.fn();
  disposals.push(source.subscribe(changed));
  const other = new StyleTokenCatalogInputs(f.studio, "Spacing", new VariantedStylesHelper());
  expect(other.key).toBe(source.key);
  f.lifetime.abort(); changed.mockClear();
  f.edit(() => { f.color.name = "After close"; });
  expect(source.isActive()).toBe(false); expect(source.getSnapshot()).toEqual([]); expect(changed).not.toHaveBeenCalled();
});
