import { fakeStudioCtx } from "@/wab/client/__testonly__/fake-init-ctx";
import { FramePanel } from "@/wab/client/components/sidebar-tabs/frame-tab";
import { StudioCtxContext } from "@/wab/client/contexts/StudioContexts";
import { AppCtxContext } from "@/wab/client/contexts/AppContexts";
import { TargetedStylePanelInputs } from "@/wab/client/studio-ctx/targeted-style-panel-inputs";
import { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { mkArenaFrame, mkMixedArena } from "@/wab/shared/Arenas";
import { RuleSetHelpers } from "@/wab/shared/RuleSetHelpers";
import { TplMgr } from "@/wab/shared/TplMgr";
import { ensure } from "@/wab/shared/common";
import { ComponentType } from "@/wab/shared/core/components";
import { createSite } from "@/wab/shared/core/sites";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import * as React from "react";

vi.mock("@/wab/client/components/widgets/DimTokenSelector", () => ({ DimTokenSpinner: ({ value, onChange, "data-test-id": id }: { value: string; onChange: (value: string) => void; "data-test-id": string }) => <input aria-label={id} value={value} onChange={(event) => onChange(event.target.value)} /> }));
vi.mock("@/wab/client/components/style-controls/ColorButton", () => ({ ColorButton: ({ color }: { color: string }) => <output data-testid="frame-bg">{color}</output> }));
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

it("updates actual frame controls and root default-size inputs while keeping resize commands on the original frame", async () => {
  vi.spyOn(ViewCtx.prototype, "isVisible").mockReturnValue(false);
  vi.spyOn(ViewCtx.prototype, "scheduleSync").mockImplementation(() => undefined);
  vi.spyOn(ViewCtx.prototype, "awaitSync").mockResolvedValue(undefined);
  const site = createSite(), manager = new TplMgr({ site });
  const component = manager.addComponent({ name: "Frame controls", type: ComponentType.Plain });
  const root = component.tplTree, exp = new RuleSetHelpers(root.vsettings[0].rs, "div"); exp.set("width", "240px");
  const frame = mkArenaFrame({ site, component, name: "Frame controls", width: 400, height: 200 });
  site.arenas.push(mkMixedArena("Frame controls", [frame]));
  const { studioCtx: studio, appCtx } = fakeStudioCtx({ site, initialUrl: "/projects/test?arena_type=custom&arena=Frame%20controls" });
  await waitFor(() => expect(studio.initialRouteReady).toBe(true));
  const view = ensure(studio.tryGetViewCtxForFrame(frame), "Frame view"); studio.setStudioFocusOnViewCtxContent(view);
  const inputs = new TargetedStylePanelInputs(studio, { kind: "frame", view, tpl: root, frame }), changed = vi.fn(), stop = inputs.subscribe(changed);
  const resize = vi.spyOn(studio, "changeFrameSize");
  const mounted = render(<AppCtxContext.Provider value={appCtx}><StudioCtxContext.Provider value={studio}><FramePanel viewCtx={view} frame={frame} /></StudioCtxContext.Provider></AppCtxContext.Provider>);
  try {
    expect(screen.getByRole("textbox", { name: "artboard-size-width" })).toHaveProperty("value", "400px");
    await act(async () => { await studio.changeUnsafe(() => { frame.width = 480; frame.height = 360; frame.bgColor = "#123456"; }); });
    expect(screen.getByRole("textbox", { name: "artboard-size-width" })).toHaveProperty("value", "480px");
    expect(screen.getByRole("textbox", { name: "artboard-size-height" })).toHaveProperty("value", "360px");
    expect(screen.getByTestId("frame-bg").textContent).toBe("#123456");
    await act(async () => { fireEvent.change(screen.getByRole("textbox", { name: "artboard-size-width" }), { target: { value: "640px" } }); });
    expect(resize).toHaveBeenCalledWith(expect.objectContaining({ frame, dim: "width", amount: 640 }));
    expect(frame.width).toBe(640);
    changed.mockClear(); const before = inputs.getSnapshot();
    await act(async () => { await studio.changeUnsafe(() => { exp.set("padding-left", "3px"); }); });
    expect(inputs.getSnapshot()).toBe(before); expect(changed).not.toHaveBeenCalled();
    await act(async () => { await studio.changeUnsafe(() => { exp.set("width", "stretch"); }); });
    expect(inputs.getSnapshot()).not.toBe(before); expect(changed).toHaveBeenCalledOnce();
    act(() => studio.disposeViewCtx(view));
    expect(screen.queryByRole("textbox", { name: "artboard-size-width" })).toBeNull();
    expect(inputs.isActive()).toBe(false);
  } finally { mounted.unmount(); stop(); await studio.awaitEval(); studio.dispose(); }
});
