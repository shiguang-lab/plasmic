import { TokenPanelInputs } from "@/wab/client/components/sidebar/token-panel-inputs";
import { ModelSnapshots } from "@/wab/client/studio-ctx/model-snapshots";
import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { TplMgr } from "@/wab/shared/TplMgr";
import { VariantedStylesHelper } from "@/wab/shared/VariantedStylesHelper";
import { ChangeRecorder } from "@/wab/shared/core/observable-model";
import { finalDataTokensForDep, siteFinalDataTokens } from "@/wab/shared/core/site-data-tokens";
import { siteFinalStyleTokens } from "@/wab/shared/core/site-style-tokens";
import { OverrideableToken } from "@/wab/shared/core/tokens";
import { createSite } from "@/wab/shared/core/sites";
import { instUtil } from "@/wab/shared/model/InstUtil";
import { ProjectDependency, VariantedValue, isKnownProjectDependency } from "@/wab/shared/model/classes";

const disposals: (() => void)[] = [];
afterEach(() => disposals.splice(0).forEach((dispose) => dispose()));
function fixture() {
  const site = createSite(), manager = new TplMgr({ site });
  const data = manager.addDataToken({ name: "Folder/Count", value: "1" });
  const style = manager.addStyleToken({ name: "Folder/Gap", tokenType: "Spacing", value: "8px" });
  const group = manager.createGlobalVariantGroup("Theme");
  const variant = manager.createGlobalVariant(group, "Dark");
  style.variantedValues.push(new VariantedValue({ variants: [variant], value: "12px" }));
  const imported = createSite();
  const importedData = new TplMgr({ site: imported }).addDataToken({ name: "Imported", value: "true" });
  const dependency = new ProjectDependency({ uuid: "dependency", name: "Library", pkgId: "pkg", projectId: "project", version: "1.0.0", site: imported });
  site.projectDependencies.push(dependency);
  const models = new ModelSnapshots(), lifetime = new AbortController();
  const studio = { site, modelSnapshots: models, arenaState: { lifetime: () => lifetime.signal } } as unknown as StudioCtx;
  const recorder = new ChangeRecorder({ inst: site, _instUtil: instUtil, isExternalRef: isKnownProjectDependency });
  const dependencyRecorder = new ChangeRecorder({ inst: dependency, _instUtil: instUtil });
  const edit = (fn: () => void) => models.sync(recorder.withRecording(fn).changes);
  const editDependency = (fn: () => void) => models.sync(dependencyRecorder.withRecording(fn).changes);
  disposals.push(() => { lifetime.abort(); models.dispose(); recorder.dispose(); dependencyRecorder.dispose(); });
  return { site, manager, data, style, group, variant, importedData, dependency, studio, models, lifetime, edit, editDependency };
}

it("data directory publishes local category/value and dependency labels without watching styles", () => {
  const f = fixture(), source = new TokenPanelInputs(f.studio, "data"), changed = vi.fn();
  disposals.push(source.subscribe(changed)); changed.mockClear();
  const before = source.getSnapshot();
  f.edit(() => { f.style.value = "24px"; });
  expect(source.getSnapshot()).toBe(before); expect(changed).not.toHaveBeenCalled();
  f.edit(() => { f.data.name = "Other/Count"; f.data.value = '"count"'; });
  expect(changed).toHaveBeenCalledOnce();
  changed.mockClear();
  f.editDependency(() => { f.dependency.name = "Renamed"; f.importedData.value = "false"; });
  expect(changed).toHaveBeenCalledOnce();
  expect(siteFinalDataTokens(f.site)[0].base).toBe(f.data);
  expect(siteFinalDataTokens(f.site)[0].value).toBe('"count"');
  expect(finalDataTokensForDep(f.site, f.dependency.site)[0].value).toBe("false");
});

it("style directory tracks varianted values, labels and overrides through original token handles", () => {
  const f = fixture(), source = new TokenPanelInputs(f.studio, "style"), changed = vi.fn();
  disposals.push(source.subscribe(changed)); changed.mockClear();
  const vsh = new VariantedStylesHelper(f.site, [f.variant], [f.variant]);
  f.edit(() => { f.style.variantedValues[0].value = "16px"; f.group.param.variable.name = "Appearance"; f.variant.name = "Night"; });
  expect(changed).toHaveBeenCalledOnce();
  const token = siteFinalStyleTokens(f.site)[0];
  expect(token.base).toBe(f.style);
  expect(vsh.getActiveTokenValue(token)).toBe("16px");
  changed.mockClear();
  f.edit(() => { f.style.isRegistered = true; });
  changed.mockClear();
  f.edit(() => { new OverrideableToken(f.style, f.site).setValue("20px"); });
  expect(changed).toHaveBeenCalledOnce();
  expect(siteFinalStyleTokens(f.site)[0].value).toBe("20px");
});

it("catalogs retire subscriptions and keys at model-world closure", () => {
  const f = fixture(), source = new TokenPanelInputs(f.studio, "data"), changed = vi.fn();
  disposals.push(source.subscribe(changed));
  f.lifetime.abort(); changed.mockClear();
  expect(source.isActive()).toBe(false); expect(source.getSnapshot()).toEqual([]);
  f.edit(() => { f.data.value = "2"; });
  expect(changed).not.toHaveBeenCalled();
  const next = fixture(), replacement = new TokenPanelInputs(next.studio, "data");
  expect(replacement.key).not.toBe(source.key);
  expect(replacement.isActive()).toBe(true);
});
