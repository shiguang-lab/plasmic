import { ViewSelection } from "@/wab/client/studio-ctx/view-selection";
import { ViewStyleInputs } from "@/wab/client/studio-ctx/style-inputs";
import { SlotSettingsSection } from "@/wab/client/components/sidebar-tabs/slot-section";
import { ExpsProvider, TplExpsProvider } from "@/wab/client/components/style-controls/StyleComponent";
import { ModelSnapshots } from "@/wab/client/studio-ctx/model-snapshots";
import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import type { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { mkArenaFrame } from "@/wab/shared/Arenas";
import { TplMgr } from "@/wab/shared/TplMgr";
import { VariantTplMgr } from "@/wab/shared/VariantTplMgr";
import { GlobalVariantFrame, TransientComponentVariantFrame } from "@/wab/shared/component-frame";
import { ComponentType, mkComponent } from "@/wab/shared/core/components";
import { mkParam } from "@/wab/shared/core/lang";
import { ChangeRecorder } from "@/wab/shared/core/observable-model";
import { createSite } from "@/wab/shared/core/sites";
import { mkSlot, mkTplTagX } from "@/wab/shared/core/tpls";
import { instUtil } from "@/wab/shared/model/InstUtil";
import { typeFactory } from "@/wab/shared/model/model-util";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { mock } from "vitest-mock-extended";

const renderSwitch = vi.hoisted(() => vi.fn());
vi.mock("@/wab/client/components/style-controls/StyleSwitch", () => ({
  default: ({ isChecked, onChange, children }: { isChecked: boolean; onChange: (value: boolean) => void; children: React.ReactNode }) => {
    renderSwitch();
    return <button role="switch" aria-checked={isChecked} onClick={() => onChange(!isChecked)}>{children}</button>;
  },
}));
afterEach(() => { cleanup(); renderSwitch.mockClear(); });

function fixture() {
  const site = createSite();
  const param = mkParam({ name: "children", paramType: "slot", type: typeFactory.renderable() });
  const other = mkParam({ name: "other", paramType: "slot", type: typeFactory.renderable(), mergeWithParent: true });
  const slot = mkSlot(param);
  const otherSlot = mkSlot(other);
  const root = mkTplTagX("div", {}, [slot, otherSlot]);
  const component = mkComponent({ name: "Slots", type: ComponentType.Plain, params: [param, other], tplTree: root });
  site.components.push(component);
  const frame = mkArenaFrame({ site, component, name: "Slots", width: 100, height: 100 });
  const models = new ModelSnapshots();
  const recorder = new ChangeRecorder({ inst: site, _instUtil: instUtil });
  const studio = mock<StudioCtx>();
  Object.defineProperties(studio, { site: { value: site }, modelSnapshots: { value: models } });
  const selection = new ViewSelection(() => models);
  const styleInputs = new ViewStyleInputs(() => models, new AbortController().signal);
  const view = mock<ViewCtx>();
  Object.assign(view, { studioCtx: studio, site, styleInputs, selectionStore: selection.store });
  view.currentComponent.mockReturnValue(component);
  const frames = [new TransientComponentVariantFrame(frame.container)];
  view.componentStackFrames.mockReturnValue(frames);
  const vtm = new VariantTplMgr(frames, site, new TplMgr({ site }), new GlobalVariantFrame(site, frame));
  view.variantTplMgr.mockReturnValue(vtm);
  const provider = new TplExpsProvider(view, slot);
  const tagProvider = new TplExpsProvider(view, root);
  const otherProvider = new TplExpsProvider(view, otherSlot);
  const commit = (fn: () => void) => { models.sync(recorder.withRecording(fn).changes); };
  studio.changeUnsafe.mockImplementation(async (fn) => { commit(fn); });
  return { site, param, other, slot, models, recorder, studio, provider, tagProvider, otherProvider, commit, dispose: () => { styleInputs.dispose(); selection.dispose(); recorder.dispose(); models.dispose(); } };
}

it("switches the native slot owner and edits only its current parameter", async () => {
  const f = fixture();
  const view = render(<SlotSettingsSection expsProvider={f.provider} />);
  fireEvent.click(screen.getByRole("button", { name: "Show more" }));
  try {
    expect(screen.getByRole("switch").getAttribute("aria-checked")).toBe("false");
    const renders = renderSwitch.mock.calls.length;
    act(() => f.commit(() => { f.param.variable.name = "Renamed"; f.other.mergeWithParent = false; }));
    expect(renderSwitch).toHaveBeenCalledTimes(renders);
    act(() => f.commit(() => { f.param.mergeWithParent = true; }));
    expect(screen.getByRole("switch").getAttribute("aria-checked")).toBe("true");
    view.rerender(<SlotSettingsSection expsProvider={f.otherProvider} />);
    expect(screen.getByRole("switch").getAttribute("aria-checked")).toBe("false");
    const detached = renderSwitch.mock.calls.length;
    act(() => f.commit(() => { f.param.mergeWithParent = false; }));
    expect(renderSwitch).toHaveBeenCalledTimes(detached);
    await act(async () => { fireEvent.click(screen.getByRole("switch")); });
    expect(f.other.mergeWithParent).toBe(true);
    expect(f.param.mergeWithParent).toBe(false);
    expect(screen.getByRole("switch").getAttribute("aria-checked")).toBe("true");
  } finally { view.unmount(); f.dispose(); }
});

it("switches between unsupported providers, a tag and a slot without changing hook order", () => {
  const f = fixture();
  const view = render(<React.StrictMode><SlotSettingsSection expsProvider={mock<ExpsProvider>()} /></React.StrictMode>);
  try {
    expect(screen.queryByRole("switch")).toBeNull();
    view.rerender(<React.StrictMode><SlotSettingsSection expsProvider={f.provider} /></React.StrictMode>);
    fireEvent.click(screen.getByRole("button", { name: "Show more" }));
    expect(screen.getByRole("switch")).toBeTruthy();
    view.rerender(<React.StrictMode><SlotSettingsSection expsProvider={f.tagProvider} /></React.StrictMode>);
    expect(screen.queryByRole("switch")).toBeNull();
    view.rerender(<React.StrictMode><SlotSettingsSection expsProvider={f.provider} /></React.StrictMode>);
    fireEvent.click(screen.getByRole("button", { name: "Show more" }));
    expect(screen.getByRole("switch")).toBeTruthy();
  } finally { view.unmount(); f.dispose(); }
});
