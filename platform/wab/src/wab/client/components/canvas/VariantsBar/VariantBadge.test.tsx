import { StudioArenaState } from "@/wab/client/studio-ctx/studio-arena-state";
import VariantBadge from "@/wab/client/components/canvas/VariantsBar/VariantBadge";
import { SiteOps } from "@/wab/client/components/canvas/site-ops";
import { StudioCtxContext } from "@/wab/client/contexts/StudioContexts";
import { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { ModelSnapshots } from "@/wab/client/studio-ctx/model-snapshots";
import { StudioSelection } from "@/wab/client/studio-ctx/studio-selection";
import { mkVariant } from "@/wab/shared/Variants";
import { ensure } from "@/wab/shared/common";
import { ComponentType, mkComponent } from "@/wab/shared/core/components";
import type { ModelChange } from "@/wab/shared/core/observable-model";
import { createSite } from "@/wab/shared/core/sites";
import { mkTplTagX } from "@/wab/shared/core/tpls";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { mock } from "vitest-mock-extended";
import { createStore } from "zustand/vanilla";
import type { ModelRef } from "@/wab/client/studio-ctx/model-snapshots";
import type { Variant } from "@/wab/shared/model/classes";

function fixture() {
  const studio = mock<StudioCtx>(), models = new ModelSnapshots();
  const selection = new StudioSelection(() => models);
  const operations = mock<SiteOps>();
  const component = mkComponent({ name: "Card", type: ComponentType.Plain, tplTree: mkTplTagX("div") });
  const site = createSite(); site.components.push(component);
  const arenaState = new StudioArenaState({ site, modelSnapshots: models });
  Object.assign(studio, {
    site, arenaState, modelSnapshots: models, selectionStore: selection.store,
    latestVariantCreatedStore: createStore<ModelRef<Variant> | undefined>(() => undefined),
  });
  Object.defineProperty(studio, "latestVariantCreated", ensure(Object.getOwnPropertyDescriptor(StudioCtx.prototype, "latestVariantCreated"), "Missing native variant command"));
  studio.changeUnsafe.mockImplementation(async (change) => change());
  studio.siteOps.mockReturnValue(operations);
  return { studio, models, component, operations, dispose: () => { arenaState.dispose(); selection.dispose(); models.dispose(); } };
}

beforeEach(() => {
  vi.stubGlobal("IntersectionObserver", class {
    observe = vi.fn();
    unobserve = vi.fn();
    disconnect = vi.fn();
  });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

it("opens only the matching native badge and preserves toggle, unpin and rename commands", async () => {
  const f = fixture(), first = mkVariant({ name: "First" }), other = mkVariant({ name: "Other" });
  f.component.variants.push(first, other);
  const toggle = vi.fn(), unpin = vi.fn(), otherCommits = vi.fn();
  const label = render(<StudioCtxContext.Provider value={f.studio}>
    <VariantBadge variant={first} component={f.component} isFocused isUnpinnable onToggle={toggle} onUnpin={unpin} />
    <React.Profiler id="other" onRender={otherCommits}><VariantBadge variant={other} component={f.component} /></React.Profiler>
  </StudioCtxContext.Provider>);
  const before = otherCommits.mock.calls.length;
  act(() => { f.studio.latestVariantCreated = first; });
  expect(f.studio.latestVariantCreated).toBeUndefined();
  const input = screen.getByRole<HTMLInputElement>("textbox");
  expect(input.value).toBe("First");
  expect(otherCommits).toHaveBeenCalledTimes(before);
  fireEvent.change(input, { target: { value: "Renamed" } });
  await act(async () => fireEvent.keyDown(input, { key: "Enter" }));
  expect(f.operations.tryRenameVariant).toHaveBeenCalledWith(first, "Renamed");
  expect(screen.queryByRole("textbox")).toBeNull();
  fireEvent.click(screen.getByText("First"));
  expect(toggle).toHaveBeenCalledTimes(1);
  const remove = ensure(label.container.querySelector<HTMLElement>('[class*="removeIcon"]'), "Missing existing remove icon");
  fireEvent.click(remove);
  expect(unpin).toHaveBeenCalledTimes(1);
  expect(toggle).toHaveBeenCalledTimes(1);
  label.unmount(); f.dispose();
});

it("uses committed classification fields to open the real selector editor", async () => {
  const f = fixture(), variant = mkVariant({ name: "Mode" });
  f.component.variants.push(variant);
  const label = render(<StudioCtxContext.Provider value={f.studio}><VariantBadge variant={variant} component={f.component} /></StudioCtxContext.Provider>);
  variant.selectors = [":hover"];
  const change: ModelChange = { type: "update", oldValue: null, newValue: variant.selectors, changeNode: { inst: variant, field: "selectors" } };
  act(() => f.models.sync([change]));
  act(() => { f.studio.latestVariantCreated = variant; });
  expect(f.studio.latestVariantCreated).toBeUndefined();
  expect(document.querySelector('[data-test-id="variant-selector-button"]')).not.toBeNull();
  expect(screen.getByRole("button", { name: "Done" })).toBeTruthy();
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Done" })));
  expect(f.operations.removeStyleOrCodeComponentVariantIfDuplicateOrEmpty).toHaveBeenCalledWith(f.component, variant);
  label.unmount(); f.dispose();
});
