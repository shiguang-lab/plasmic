import { DefaultStylesInputs } from "@/wab/client/components/sidebar/default-styles-inputs";
import { ModelSnapshots } from "@/wab/client/studio-ctx/model-snapshots";
import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { TplMgr } from "@/wab/shared/TplMgr";
import { ensure } from "@/wab/shared/common";
import { ChangeRecorder } from "@/wab/shared/core/observable-model";
import { createSite } from "@/wab/shared/core/sites";
import { ensureThemeStyleMixin } from "@/wab/shared/core/theme-styles";
import { instUtil } from "@/wab/shared/model/InstUtil";

const dispose: (() => void)[] = [];
afterEach(() => dispose.splice(0).forEach((stop) => stop()));
function fixture() {
  const site = createSite(), models = new ModelSnapshots(), lifetime = new AbortController();
  const recorder = new ChangeRecorder({ inst: site, _instUtil: instUtil });
  const studio = { site, modelSnapshots: models, arenaState: { lifetime: () => lifetime.signal } } as unknown as StudioCtx;
  const edit = (fn: () => void) => models.sync(recorder.withRecording(fn).changes);
  dispose.push(() => { lifetime.abort(); recorder.dispose(); models.dispose(); });
  return { site, studio, edit, lifetime };
}

it("publishes selector ownership and global variant labels while leaving CSS content to its native style source", () => {
  const f = fixture(), theme = ensure(f.site.activeTheme, "Active theme");
  f.edit(() => { theme.styles = theme.styles.filter((style) => style.selector !== "a:hover"); });
  expect(theme.styles.some((style) => style.selector === "a:hover")).toBe(false);
  const source = new DefaultStylesInputs(f.studio), changed = vi.fn();
  dispose.push(source.subscribe(changed)); changed.mockClear();
  f.edit(() => { theme.defaultStyle.rs.values = { ...theme.defaultStyle.rs.values, color: "red" }; });
  expect(changed).not.toHaveBeenCalled();
  f.edit(() => { ensureThemeStyleMixin(theme, "a:hover"); });
  expect(changed).toHaveBeenCalledOnce(); changed.mockClear();
  const manager = new TplMgr({ site: f.site });
  f.edit(() => { manager.createGlobalVariant(manager.createGlobalVariantGroup("Theme"), "Dark"); });
  expect(changed).toHaveBeenCalledOnce(); changed.mockClear();
  const group = f.site.globalVariantGroups.find((value) => value.variants.some((variant) => variant.name === "Dark"));
  f.edit(() => { ensure(group, "Theme variants").variants[0].name = "Night"; });
  expect(changed).toHaveBeenCalledOnce();
});

it("retires old-world selectors and gives a replacement panel a fresh local-state key", () => {
  const f = fixture(), source = new DefaultStylesInputs(f.studio), changed = vi.fn();
  dispose.push(source.subscribe(changed));
  f.lifetime.abort(); changed.mockClear();
  f.edit(() => { f.site.activeTheme = null; });
  expect(source.isActive()).toBe(false); expect(source.getSnapshot()).toEqual([]); expect(changed).not.toHaveBeenCalled();
  const next = fixture(), replacement = new DefaultStylesInputs(next.studio);
  expect(replacement.key).not.toBe(source.key); expect(replacement.isActive()).toBe(true);
});
