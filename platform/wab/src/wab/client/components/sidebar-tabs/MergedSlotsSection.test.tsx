import { MergedSlotsTextSection } from "@/wab/client/components/sidebar-tabs/MergedSlotsSection";
import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { ModelSnapshots } from "@/wab/client/studio-ctx/model-snapshots";
import type { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import type { ViewVariantSnapshot } from "@/wab/client/studio-ctx/view-variant-state";
import { getSlotParams } from "@/wab/shared/SlotUtils";
import { TplMgr } from "@/wab/shared/TplMgr";
import { $$$ } from "@/wab/shared/TplQuery";
import { ensureVariantSetting, mkVariant } from "@/wab/shared/Variants";
import { ComponentType } from "@/wab/shared/core/components";
import { ChangeRecorder } from "@/wab/shared/core/observable-model";
import { createSite } from "@/wab/shared/core/sites";
import { mkTplComponent } from "@/wab/shared/core/tpls";
import { instUtil } from "@/wab/shared/model/InstUtil";
import { act, cleanup, render } from "@testing-library/react";
import * as React from "react";
import { mock } from "vitest-mock-extended";
import { createStore } from "zustand/vanilla";

vi.mock("@/wab/shared/SlotUtils", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/wab/shared/SlotUtils")>();
  return { ...actual, getSlotParams: vi.fn(actual.getSlotParams) };
});

const dispose: (() => void)[] = [];
beforeEach(() => { vi.mocked(getSlotParams).mockClear(); });
afterEach(() => { cleanup(); dispose.splice(0).forEach((stop) => stop()); });

function variantStore() {
  return createStore<ViewVariantSnapshot>(() => Object.freeze({
    frames: Object.freeze([]),
    global: Object.freeze({ targets: Object.freeze([]), pins: Object.freeze([]) }),
    showDefaultSlots: false,
    isEditingNonBaseVariant: false,
    isTargetingNonBaseVariant: false,
  }));
}

function props() {
  const site = createSite(), manager = new TplMgr({ site });
  const child = manager.addComponent({ name: "Merged child", type: ComponentType.Plain });
  const owner = manager.addComponent({ name: "Merged owner", type: ComponentType.Plain });
  const variant = mkVariant({ name: "Compact" }); owner.variants.push(variant);
  const tpl = mkTplComponent(child, owner.variants[0]); $$$(owner.tplTree).append(tpl);
  const models = new ModelSnapshots(), lifetime = new AbortController(), studio = mock<StudioCtx>();
  Object.defineProperties(studio, { site: { value: site }, modelSnapshots: { value: models } });
  const viewCtx = mock<ViewCtx>();
  Object.defineProperties(viewCtx, {
    studioCtx: { value: studio }, site: { value: site },
    disposeSignal: { value: lifetime.signal }, variantStore: { value: variantStore() },
  });
  const recorder = new ChangeRecorder({ inst: site, _instUtil: instUtil });
  dispose.push(() => { lifetime.abort(); models.dispose(); recorder.dispose(); });
  const edit = (change: () => void) => models.sync(recorder.withRecording(change).changes);
  return { tpl, viewCtx, child, site, variant, edit };
}

it("recomputes when its original component's declared metadata changes", async () => {
  const { tpl, viewCtx, child, edit } = props();
  render(<MergedSlotsTextSection tpl={tpl} viewCtx={viewCtx} tab="settings" />);
  const before = vi.mocked(getSlotParams).mock.calls.length;
  await act(async () => { edit(() => { child.name = "Renamed merged child"; }); });
  expect(vi.mocked(getSlotParams).mock.calls.length).toBeGreaterThan(before);
  expect(tpl.component).toBe(child);
});

it("recomputes when its original template's variant-setting roster changes", async () => {
  const { tpl, viewCtx, child, variant, edit } = props();
  render(<MergedSlotsTextSection tpl={tpl} viewCtx={viewCtx} tab="settings" />);
  const before = vi.mocked(getSlotParams).mock.calls.length;
  await act(async () => { edit(() => { ensureVariantSetting(tpl, [variant]); }); });
  expect(vi.mocked(getSlotParams).mock.calls.length).toBeGreaterThan(before);
  expect(tpl.component).toBe(child); expect(tpl.vsettings.at(-1)?.variants).toEqual([variant]);
});

it("stays idle for unrelated committed fields", async () => {
  const { tpl, viewCtx, site, edit } = props();
  render(<MergedSlotsTextSection tpl={tpl} viewCtx={viewCtx} tab="settings" />);
  const before = vi.mocked(getSlotParams).mock.calls.length;
  await act(async () => { edit(() => { site.flags.unrelatedMergedSlotFlag = true; }); });
  expect(vi.mocked(getSlotParams).mock.calls.length).toBe(before);
});
