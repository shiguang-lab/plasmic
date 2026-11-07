import { ComponentType } from "@/wab/shared/core/components";
import { BaseVariantRow } from "@/wab/client/components/sidebar-tabs/BaseVariantRow";
import type { VariantAnimations } from "@/wab/client/components/sidebar-tabs/VariantAnimations";
import type VariantRow from "@/wab/client/components/variants/VariantRow";
import { ModelSnapshots } from "@/wab/client/studio-ctx/model-snapshots";
import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { StudioSelection } from "@/wab/client/studio-ctx/studio-selection";
import { useFocusedViewVariants } from "@/wab/client/studio-ctx/variant-state";
import type { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { ViewVariantState } from "@/wab/client/studio-ctx/view-variant-state";
import { mkArenaFrame } from "@/wab/shared/Arenas";
import { TplMgr } from "@/wab/shared/TplMgr";
import { VariantTplMgr } from "@/wab/shared/VariantTplMgr";
import { mkVariant } from "@/wab/shared/Variants";
import { GlobalVariantFrame, TransientComponentVariantFrame } from "@/wab/shared/component-frame";
import { createSite } from "@/wab/shared/core/sites";
import { ensureKnownTplTag } from "@/wab/shared/model/classes";
import { act, cleanup, render, screen } from "@testing-library/react";
import React from "react";
import { mock } from "vitest-mock-extended";

const rowRender = vi.hoisted(() => vi.fn());
vi.mock("@/wab/client/components/variants/VariantRow", () => ({
  default: (props: React.ComponentProps<typeof VariantRow>) => {
    rowRender();
    return <output aria-label="Target variant">{(Array.isArray(props.variant) ? props.variant : [props.variant]).map((variant) => variant.name).join(", ")}</output>;
  },
}));
vi.mock("@/wab/client/components/sidebar-tabs/VariantAnimations", () => ({
  VariantAnimations: (props: React.ComponentProps<typeof VariantAnimations>) => props.children({
    addAnimationLayer: vi.fn(), animationsList: null, animations: [], playAnimations: vi.fn(), stopAnimations: vi.fn(), isAnimationPlaying: false, previewAnimationButton: null,
  }),
}));
afterEach(() => { cleanup(); rowRender.mockClear(); });

function setup() {
  const site = createSite();
  const tplMgr = new TplMgr({ site });
  const component = tplMgr.addComponent({ name: "Native variants", type: ComponentType.Plain });
  const variant = mkVariant({ name: "Active" });
  component.variants.push(variant);
  const frame = mkArenaFrame({ site, component, name: "Native", width: 100, height: 100 });
  const models = new ModelSnapshots();
  let hasRoot = false;
  const inputs = new ViewVariantState(() => models, () => frame, () => site, () => false, () => hasRoot);
  const local = new TransientComponentVariantFrame(frame.container);
  const global = new GlobalVariantFrame(site, frame);
  inputs.transaction(() => { inputs.replaceFrames([local]); inputs.setGlobal(global); });
  const view = mock<ViewCtx>();
  Object.defineProperty(view, "variantStore", { value: inputs.store });
  view.variantTplMgr.mockImplementation(() => new VariantTplMgr(inputs.frames(), site, tplMgr, inputs.global()));
  const studio = mock<StudioCtx>();
  const selection = new StudioSelection(() => models);
  Object.defineProperty(studio, "selectionStore", { value: selection.store });
  selection.set(view, []);
  return { component, variant, inputs, local, view, studio, selection,
    rootExists: (exists: boolean) => { hasRoot = exists; inputs.syncRuntime(); },
    dispose: () => { selection.dispose(); inputs.dispose(); models.dispose(); },
  };
}

it("refreshes the actual variant row from native transient targets without parent or model changes", () => {
  const f = setup();
  const { unmount } = render(<BaseVariantRow tpl={ensureKnownTplTag(f.component.tplTree)} studioCtx={f.studio} viewCtx={f.view} pinState={undefined} onClick={vi.fn()} />);
  try {
    expect(screen.getByLabelText("Target variant").textContent).toBe("base");
    act(() => f.local.setTargetVariants([f.variant]));
    expect(screen.getByLabelText("Target variant").textContent).toBe("Active");
    const renders = rowRender.mock.calls.length;
    act(() => { f.inputs.setShowDefaultSlots(true); f.rootExists(true); });
    expect(rowRender).toHaveBeenCalledTimes(renders);
    act(() => f.local.setTargetVariants([]));
    expect(screen.getByLabelText("Target variant").textContent).toBe("base");
  } finally { unmount(); f.dispose(); }
});

it("subscribes to the exact editing Boolean and detaches a previous focused owner", () => {
  const f = setup();
  const renderBoolean = vi.fn();
  function Recording() {
    const active = useFocusedViewVariants(f.studio, (state) => state.isEditingNonBaseVariant);
    renderBoolean();
    return <output aria-label="Recording">{String(active)}</output>;
  }
  const { unmount } = render(<Recording />);
  try {
    const initial = renderBoolean.mock.calls.length;
    act(() => { f.local.setTargetVariants([f.variant]); f.inputs.setShowDefaultSlots(true); });
    expect(renderBoolean).toHaveBeenCalledTimes(initial);
    expect(screen.getByLabelText("Recording").textContent).toBe("false");
    act(() => f.rootExists(true));
    expect(screen.getByLabelText("Recording").textContent).toBe("true");
    act(() => f.selection.set(undefined, []));
    expect(screen.getByLabelText("Recording").textContent).toBe("false");
    const detached = renderBoolean.mock.calls.length;
    act(() => { f.local.setTargetVariants([]); f.inputs.setShowDefaultSlots(false); });
    expect(renderBoolean).toHaveBeenCalledTimes(detached);
  } finally { unmount(); f.dispose(); }
});
