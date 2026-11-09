import { useVariantLabelInputs } from "@/wab/client/components/variants/variant-label-inputs";
import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { ModelSnapshots } from "@/wab/client/studio-ctx/model-snapshots";
import { TplMgr } from "@/wab/shared/TplMgr";
import { getPrivateStyleVariantsForTag } from "@/wab/shared/Variants";
import { ComponentType } from "@/wab/shared/core/components";
import { ChangeRecorder } from "@/wab/shared/core/observable-model";
import { createSite } from "@/wab/shared/core/sites";
import { ensureKnownTplTag } from "@/wab/shared/model/classes";
import { instUtil } from "@/wab/shared/model/InstUtil";
import { act, renderHook } from "@testing-library/react";

it("tracks the private selector roster and selector edits while unrelated node labels stay quiet", () => {
  const site = createSite(), manager = new TplMgr({ site });
  const component = manager.addComponent({ type: ComponentType.Plain, name: "Private variants" }), tpl = ensureKnownTplTag(component.tplTree);
  const models = new ModelSnapshots(), lifetime = new AbortController();
  const recorder = new ChangeRecorder({ inst: site, _instUtil: instUtil });
  const studio = { site, modelSnapshots: models, arenaState: { lifetime: () => lifetime.signal } } as unknown as StudioCtx;
  const hook = renderHook(() => {
    useVariantLabelInputs(studio, component.variants, { component, componentVariants: true });
    return getPrivateStyleVariantsForTag(component, tpl).map((variant) => variant.selectors.join(","));
  });
  try {
    expect(hook.result.current).toEqual([]);
    const changes = recorder.withRecording(() => { manager.createPrivateStyleVariant(component, tpl, [":hover"]); });
    act(() => models.sync(changes.changes));
    expect(hook.result.current).toEqual([":hover"]);
    const variant = getPrivateStyleVariantsForTag(component, tpl)[0];
    if (!variant) { throw new Error("Expected private variant"); }
    act(() => models.sync(recorder.withRecording(() => { variant.selectors = [":focus"]; }).changes));
    expect(hook.result.current).toEqual([":focus"]);
    const before = hook.result.current;
    act(() => models.sync(recorder.withRecording(() => { tpl.name = "Unrelated label"; }).changes));
    expect(hook.result.current).toBe(before);
    act(() => models.sync(recorder.withRecording(() => { component.variants = component.variants.filter((item) => item !== variant); }).changes));
    expect(hook.result.current).toEqual([]);
  } finally { hook.unmount(); recorder.dispose(); models.dispose(); }
});

it("does not admit retained component variants when their array wrapper changes after world replacement", () => {
  const site = createSite(), manager = new TplMgr({ site });
  const component = manager.addComponent({ type: ComponentType.Plain, name: "Retained variants" });
  const models = new ModelSnapshots(), replacement = new ModelSnapshots();
  let lifetime = new AbortController();
  const owner = { site, modelSnapshots: models, arenaState: { lifetime: () => lifetime.signal } };
  const studio = owner as unknown as StudioCtx;
  const hook = renderHook(({ variants }) => useVariantLabelInputs(studio, variants, { component, componentVariants: true }), { initialProps: { variants: [...component.variants] } });
  try {
    act(() => { lifetime.abort(); owner.site = createSite(); owner.modelSnapshots = replacement; lifetime = new AbortController(); });
    const field = vi.spyOn(replacement, "declaredField");
    hook.rerender({ variants: [...component.variants] });
    expect(field).not.toHaveBeenCalled();
  } finally { hook.unmount(); models.dispose(); replacement.dispose(); }
});
