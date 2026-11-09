import $ from "jquery";
import { fakeStudioCtx } from "@/wab/client/__testonly__/fake-init-ctx";
import { MultiSelectionPanel } from "@/wab/client/components/sidebar-tabs/MultiSelectionPanel";
import { buildValTree } from "@/wab/__testonly__/tpls";
import { ValTag } from "@/wab/shared/core/val-nodes";
import { ValState } from "@/wab/shared/eval/val-state";
import { ensureKnownTplTag } from "@/wab/shared/model/classes";
import { AppCtxContext } from "@/wab/client/contexts/AppContexts";
import { StudioCtxContext } from "@/wab/client/contexts/StudioContexts";
import { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { mkArenaFrame, mkMixedArena } from "@/wab/shared/Arenas";
import { RuleSetHelpers } from "@/wab/shared/RuleSetHelpers";
import { TplMgr } from "@/wab/shared/TplMgr";
import { $$$ } from "@/wab/shared/TplQuery";
import { ensure, ensureInstance } from "@/wab/shared/common";
import { ComponentType } from "@/wab/shared/core/components";
import { createSite } from "@/wab/shared/core/sites";
import { mkTplComponent, mkTplTagX } from "@/wab/shared/core/tpls";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import * as React from "react";

vi.mock("@/wab/client/components/widgets/DimTokenSelector", () => ({ DimTokenSpinner: ({ value, onChange, disabled, fieldAriaProps }: { value?: string; onChange: (value: string) => void; disabled?: boolean; fieldAriaProps?: React.InputHTMLAttributes<HTMLInputElement> }) => <input {...fieldAriaProps} value={value ?? ""} disabled={disabled} onChange={(event) => onChange(event.target.value)} /> }));
vi.mock("@/wab/client/components/style-controls/ColorButton", () => ({ ColorButton: () => null }));
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

it("refreshes multi-selection consensus, labels and ancestor locks and edits the original selected rule sets", async () => {
  vi.spyOn(ViewCtx.prototype, "isVisible").mockReturnValue(false);
  vi.spyOn(ViewCtx.prototype, "scheduleSync").mockImplementation(() => undefined);
  vi.spyOn(ViewCtx.prototype, "awaitSync").mockResolvedValue(undefined);
  const site = createSite(), manager = new TplMgr({ site }), component = manager.addComponent({ name: "Multiple controls", type: ComponentType.Plain });
  const root = ensureKnownTplTag(component.tplTree), base = component.variants[0];
  const first = mkTplTagX("div", { baseVariant: base, styles: { width: "100px" }, name: "First" }), second = mkTplTagX("div", { baseVariant: base, styles: { width: "100px" }, name: "Second" });
  $$$(root).append(first); $$$(root).append(second);
  const frame = mkArenaFrame({ site, component, name: "Multiple controls", width: 400, height: 200 }); site.arenas.push(mkMixedArena("Multiple controls", [frame]));
  const { studioCtx: studio, appCtx } = fakeStudioCtx({ site, initialUrl: "/projects/test?arena_type=custom&arena=Multiple%20controls" });
  await waitFor(() => expect(studio.initialRouteReady).toBe(true));
  const view = ensure(studio.tryGetViewCtxForFrame(frame), "Multi-selection view"); studio.setStudioFocusOnViewCtxContent(view);
  const runtime = buildValTree(mkTplComponent(component, base)), runtimeRoot = ensureInstance(runtime.contents?.[0], ValTag);
  vi.spyOn(view, "valState").mockReturnValue(new ValState({ sysRoot: runtime, globalRoot: undefined }));
  vi.spyOn(view, "focusedSelectables").mockReturnValue(runtimeRoot.children);
  view.selection.setTpls([first, second]);
  Object.defineProperties(view.canvasCtx, {
    $userBody: { configurable: true, value: () => $(document.body) },
    doc: { configurable: true, value: () => document },
  });
  const mounted = render(<AppCtxContext.Provider value={appCtx}><StudioCtxContext.Provider value={studio}><MultiSelectionPanel viewCtx={view} /></StudioCtxContext.Provider></AppCtxContext.Provider>);
  try {
    expect(screen.getByRole("textbox", { name: "Width" })).toHaveProperty("value", "100px");
    await act(async () => { await studio.changeUnsafe(() => { new RuleSetHelpers(second.vsettings[0].rs, "div").set("width", "200px"); first.name = "Renamed layer"; }); });
    expect(screen.getByRole("textbox", { name: "Width" })).toHaveProperty("value", ""); expect(screen.getByTitle("Renamed layer")).toBeTruthy();
    await act(async () => { fireEvent.change(screen.getByRole("textbox", { name: "Width" }), { target: { value: "240px" } }); });
    await waitFor(() => expect(first.vsettings[0].rs.values.width).toBe("240px")); expect(second.vsettings[0].rs.values.width).toBe("240px");
    expect(screen.getByRole("textbox", { name: "Width" })).toHaveProperty("value", "240px");
    await act(async () => { await studio.changeUnsafe(() => { root.locked = true; }); });
    expect(screen.getByRole("textbox", { name: "Width" })).toHaveProperty("disabled", true);
    await act(async () => { await studio.changeUnsafe(() => { root.locked = false; }); });
    expect(screen.getByRole("textbox", { name: "Width" })).toHaveProperty("disabled", false);
    act(() => studio.disposeViewCtx(view)); expect(screen.queryByRole("textbox", { name: "Width" })).toBeNull();
  } finally { mounted.unmount(); await studio.awaitEval(); studio.dispose(); }
});
