import { cloneTheme, mkRuleSet } from "@/wab/shared/core/styles";
import { getTplType } from "@/wab/shared/core/tpls";
import { getEffectiveVariantSetting } from "@/wab/shared/effective-variant-setting";
import { ensure } from "@/wab/shared/common";
import { ThemeStyle, Mixin, ensureKnownTplTag } from "@/wab/shared/model/classes";
import { mkStyleToken, mkTokenRef } from "@/wab/commons/StyleToken";
import { mkImageAsset, mkImageAssetRef } from "@/wab/shared/core/image-assets";
import { ImageAssetType } from "@/wab/shared/core/image-asset-type";
import { StyleToken, StyleTokenOverride } from "@/wab/shared/model/classes";
import { CanvasViewInputs } from "@/wab/client/components/canvas/canvas-view-inputs";
import { indicatorFields, indicatorReferenceFields } from "@/wab/client/components/style-controls/defined-indicator-inputs";
import { ModelSnapshots } from "@/wab/client/studio-ctx/model-snapshots";
import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { TplMgr } from "@/wab/shared/TplMgr";
import { ComponentType } from "@/wab/shared/core/components";
import { codeLit } from "@/wab/shared/core/exprs";
import { ChangeRecorder } from "@/wab/shared/core/observable-model";
import { createSite } from "@/wab/shared/core/sites";
import { ensureBaseVariantSetting, ensureVariantSetting } from "@/wab/shared/Variants";
import { CustomCode } from "@/wab/shared/model/classes";
import { instUtil } from "@/wab/shared/model/InstUtil";
import { mock } from "vitest-mock-extended";

it("updates original source expressions and rules and closes before consulting a replacement world", () => {
  const site = createSite();
  const component = new TplMgr({ site }).addComponent({ name: "Indicator", type: ComponentType.Plain });
  const tpl = component.tplTree, setting = ensureBaseVariantSetting(tpl);
  const expr = new CustomCode({ code: "($state.enabled)", fallback: codeLit(true) });
  setting.attrs.title = expr;
  const models = new ModelSnapshots(), replacement = new ModelSnapshots(), lifetime = new AbortController();
  const studio = mock<StudioCtx>();
  Object.defineProperty(studio, "modelSnapshots", { value: models, writable: true });
  const source = new CanvasViewInputs({ studio, models, signal: lifetime.signal }, (field) => indicatorFields(field, [{ type: "attr", value: expr, attr: "title", combo: setting.variants }], setting, tpl));
  const recorder = new ChangeRecorder({ inst: site, _instUtil: instUtil });
  const notify = vi.fn(), stop = source.subscribe(notify); notify.mockClear();
  try {
    models.sync(recorder.withRecording(() => { expr.code = "($state.updated)"; }).changes);
    expect(notify).toHaveBeenCalledOnce(); notify.mockClear();
    models.sync(recorder.withRecording(() => { site.flags.unrelatedIndicatorFlag = true; }).changes);
    expect(notify).not.toHaveBeenCalled();
    models.sync(recorder.withRecording(() => { setting.rs.values.color = "red"; }).changes);
    expect(notify).toHaveBeenCalledOnce();
    expect(setting.attrs.title).toBe(expr);
    Object.defineProperty(studio, "modelSnapshots", { value: replacement });
    const demand = vi.spyOn(replacement, "declaredField");
    expect(source.getSnapshot().alive).toBe(false); expect(demand).not.toHaveBeenCalled();
  } finally { stop(); lifetime.abort(); models.dispose(); replacement.dispose(); recorder.dispose(); }
});

it("follows nested background/color references and resolved assets through the real registered-token override", () => {
  const site = createSite(), color = mkStyleToken({ name: "Gradient stop", type: "Color", value: "#112233" }), nextColor = mkStyleToken({ name: "Override stop", type: "Color", value: "#445566" });
  const image = mkImageAsset({ name: "Original image", type: ImageAssetType.Picture, dataUri: "https://example.test/a.png" }), nextImage = mkImageAsset({ name: "Override image", type: ImageAssetType.Picture, dataUri: "https://example.test/b.png" });
  const background = mkStyleToken({ name: "Background", type: "Color", value: `linear-gradient(${mkTokenRef(color)}, #ffffff), ${mkImageAssetRef(image)}` }); background.isRegistered = true;
  const unrelated = mkStyleToken({ name: "Unrelated", type: "Color", value: "#778899" });
  site.styleTokens.push(background, color, nextColor, unrelated); site.imageAssets.push(image, nextImage);
  const models = new ModelSnapshots(), lifetime = new AbortController(), studio = mock<StudioCtx>();
  Object.defineProperty(studio, "modelSnapshots", { value: models });
  const source = new CanvasViewInputs({ studio, models, signal: lifetime.signal }, (field) => indicatorReferenceFields(field, site, [mkTokenRef(background)]));
  const recorder = new ChangeRecorder({ inst: site, _instUtil: instUtil }), notify = vi.fn(), stop = source.subscribe(notify); notify.mockClear();
  const edit = (change: () => void) => models.sync(recorder.withRecording(change).changes);
  try {
    expect(indicatorReferenceFields(() => undefined, site, [mkTokenRef(background)])).toEqual([mkTokenRef(background), mkTokenRef(color)]);
    edit(() => { color.value = "#abcdef"; }); expect(notify).toHaveBeenCalledOnce(); notify.mockClear();
    edit(() => { image.dataUri = "https://example.test/a2.png"; }); expect(notify).toHaveBeenCalledOnce(); notify.mockClear();
    edit(() => { unrelated.value = "#010203"; nextImage.dataUri = "https://example.test/not-used.png"; }); expect(notify).not.toHaveBeenCalled();
    const override = new StyleTokenOverride({ token: background, value: `linear-gradient(${mkTokenRef(nextColor)}, #000000), ${mkImageAssetRef(nextImage)}`, variantedValues: [] });
    edit(() => { site.styleTokenOverrides.push(override); }); expect(notify).toHaveBeenCalledOnce(); notify.mockClear();
    expect(indicatorReferenceFields(() => undefined, site, [mkTokenRef(background)])).toEqual([mkTokenRef(background), mkTokenRef(nextColor)]);
    edit(() => { color.value = "#123123"; image.dataUri = "https://example.test/unused.png"; background.value = "linear-gradient(#111111, #222222)"; }); expect(notify).not.toHaveBeenCalled();
    edit(() => { nextColor.value = "#fedcba"; }); expect(notify).toHaveBeenCalledOnce(); notify.mockClear();
    edit(() => { nextImage.dataUri = "https://example.test/b2.png"; }); expect(notify).toHaveBeenCalledOnce();
    expect(site.styleTokenOverrides[0]).toBe(override); expect(override.token).toBe(background);
  } finally { stop(); lifetime.abort(); models.dispose(); recorder.dispose(); }
});

it("retains both original first-head and last-dictionary token roles without subscribing unrelated values", () => {
  const site = createSite(), first = mkStyleToken({ name: "First", type: "Color", value: "#112233" });
  const last = new StyleToken({ uuid: first.uuid, name: "Last", type: "Color", value: "#445566", variantedValues: [], isRegistered: false, regKey: undefined });
  const nested = mkStyleToken({ name: "Nested", type: "Color", value: `linear-gradient(${mkTokenRef(first)}, #ffffff)` });
  site.styleTokens.push(nested, first, last);
  const models = new ModelSnapshots(), lifetime = new AbortController(), studio = mock<StudioCtx>(); Object.defineProperty(studio, "modelSnapshots", { value: models });
  const source = new CanvasViewInputs({ studio, models, signal: lifetime.signal }, (field) => indicatorReferenceFields(field, site, [mkTokenRef(nested)]));
  const recorder = new ChangeRecorder({ inst: site, _instUtil: instUtil }), notify = vi.fn(), stop = source.subscribe(notify); notify.mockClear();
  try {
    models.sync(recorder.withRecording(() => { first.value = "#aabbcc"; }).changes); expect(notify).toHaveBeenCalledOnce(); notify.mockClear();
    models.sync(recorder.withRecording(() => { last.value = "#ddeeff"; }).changes); expect(notify).toHaveBeenCalledOnce();
    expect(site.styleTokens[1]).toBe(first); expect(site.styleTokens[2]).toBe(last);
  } finally { stop(); lifetime.abort(); models.dispose(); recorder.dispose(); }
});

it("refreshes the original parent icon from matching theme layout, active-theme replacement and typography defaults", () => {
  const site = createSite(), manager = new TplMgr({ site }), component = manager.addComponent({ name: "Themed parent icon", type: ComponentType.Plain });
  const parent = ensureKnownTplTag(component.tplTree), setting = ensureBaseVariantSetting(parent), theme = ensure(site.activeTheme, "Original active theme");
  setting.rs.values = {};
  const layout = new Mixin({ name: "Div layout", uuid: "div-icon-layout", rs: mkRuleSet({ values: {} }), variantedRs: [], forTheme: true, preview: undefined });
  const unrelated = new Mixin({ name: "Span layout", uuid: "span-icon-layout", rs: mkRuleSet({ values: {} }), variantedRs: [], forTheme: true, preview: undefined });
  layout.rs.values = { display: "flex", "flex-direction": "row" }; unrelated.rs.values = { display: "grid" };
  theme.styles.push(new ThemeStyle({ selector: "div", style: layout }), new ThemeStyle({ selector: "span", style: unrelated }));
  const replacement = cloneTheme(theme), replacementLayout = ensure(replacement.styles.find((style) => style.selector === "div"), "Replacement div style").style;
  replacementLayout.rs.values = { display: "grid" }; replacement.defaultStyle.rs.values = { display: "flex", "flex-direction": "row" }; site.themes.push(replacement);
  const models = new ModelSnapshots(), lifetime = new AbortController(), studio = mock<StudioCtx>(); Object.defineProperty(studio, "modelSnapshots", { value: models });
  const source = new CanvasViewInputs({ studio, models, signal: lifetime.signal }, (field) => indicatorFields(field, [{ type: "parentTplStyle", parentTpl: parent, activeVariants: setting.variants, prop: "color", value: "#112233" }]));
  const recorder = new ChangeRecorder({ inst: site, _instUtil: instUtil }), notify = vi.fn(), stop = source.subscribe(notify); notify.mockClear();
  const edit = (change: () => void) => models.sync(recorder.withRecording(change).changes);
  const type = () => getTplType(parent, getEffectiveVariantSetting(parent, setting.variants));
  try {
    expect(type()).toBe("horizStack");
    edit(() => { layout.rs.values["flex-direction"] = "column"; }); expect(notify).toHaveBeenCalledOnce(); expect(type()).toBe("vertStack"); notify.mockClear();
    edit(() => { unrelated.rs.values.display = "flex"; }); expect(notify).not.toHaveBeenCalled();
    edit(() => { site.activeTheme = replacement; }); expect(notify).toHaveBeenCalledOnce(); expect(type()).toBe("grid"); notify.mockClear();
    edit(() => { layout.rs.values.display = "block"; }); expect(notify).not.toHaveBeenCalled();
    edit(() => { parent.tag = "p"; }); expect(notify).toHaveBeenCalledOnce(); expect(type()).toBe("horizStack"); notify.mockClear();
    edit(() => { replacement.defaultStyle.rs.values["flex-direction"] = "column"; }); expect(notify).toHaveBeenCalledOnce(); expect(type()).toBe("vertStack");
    expect(component.tplTree).toBe(parent); expect(site.activeTheme).toBe(replacement);
  } finally { stop(); lifetime.abort(); models.dispose(); recorder.dispose(); }
});

it("tracks finite component and parent-group ordering when active variants change the parent icon winner", () => {
  const site = createSite(), manager = new TplMgr({ site }), component = manager.addComponent({ name: "Ranked parent icon", type: ComponentType.Plain });
  const parent = ensureKnownTplTag(component.tplTree); ensureBaseVariantSetting(parent).rs.values = {};
  const firstGroup = manager.createVariantGroup({ component, name: "First" }), secondGroup = manager.createVariantGroup({ component, name: "Second" });
  const first = manager.createVariant(component, firstGroup, "First active"), second = manager.createVariant(component, secondGroup, "Second active");
  manager.createVariant(component, firstGroup, "Another first-group option");
  ensureVariantSetting(parent, [first]).rs.values = { display: "flex", "flex-direction": "row" };
  ensureVariantSetting(parent, [second]).rs.values = { display: "grid" };
  const active = [first, second], models = new ModelSnapshots(), lifetime = new AbortController(), studio = mock<StudioCtx>(); Object.defineProperty(studio, "modelSnapshots", { value: models });
  const source = new CanvasViewInputs({ studio, models, signal: lifetime.signal }, (field) => indicatorFields(field, [{ type: "parentTplStyle", parentTpl: parent, activeVariants: active, prop: "color", value: "#112233" }]));
  const recorder = new ChangeRecorder({ inst: site, _instUtil: instUtil }), notify = vi.fn(), stop = source.subscribe(notify); notify.mockClear();
  const type = () => getTplType(parent, getEffectiveVariantSetting(parent, active));
  try {
    expect(type()).toBe("grid");
    models.sync(recorder.withRecording(() => { component.variantGroups.reverse(); }).changes);
    expect(notify).toHaveBeenCalledOnce(); expect(type()).toBe("horizStack"); notify.mockClear();
    models.sync(recorder.withRecording(() => { firstGroup.variants.reverse(); }).changes);
    expect(notify).toHaveBeenCalledOnce(); expect(type()).toBe("horizStack");
    expect(component.variantGroups).toEqual([secondGroup, firstGroup]); expect(active).toEqual([first, second]);
  } finally { stop(); lifetime.abort(); models.dispose(); recorder.dispose(); }
});
