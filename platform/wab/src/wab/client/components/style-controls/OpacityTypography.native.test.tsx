import userEvent from "@testing-library/user-event";
import { AppContext } from "@/wab/client/components/top-view";
import "@/wab/client/components/sidebar/MixinControls";
import { fakeStudioCtx } from "@/wab/client/__testonly__/fake-init-ctx";
import { SidebarModalProvider } from "@/wab/client/components/sidebar/SidebarModal";
import { OpacityControl } from "@/wab/client/components/style-controls/OpacityControl";
import { Typography, TypographySettings } from "@/wab/client/components/style-controls/Typography";
import { SingleRsExpsProvider, StylePanelSection, StyleTarget, StyleTargetContext } from "@/wab/client/components/style-controls/StyleComponent";
import { StudioCtxContext } from "@/wab/client/contexts/StudioContexts";
import { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { mkStyleToken, mkTokenRef } from "@/wab/commons/StyleToken";
import { mkArenaFrame, mkMixedArena } from "@/wab/shared/Arenas";
import { RuleSetHelpers } from "@/wab/shared/RuleSetHelpers";
import { TplMgr } from "@/wab/shared/TplMgr";
import { VariantedStylesHelper } from "@/wab/shared/VariantedStylesHelper";
import { ensure } from "@/wab/shared/common";
import { ComponentType } from "@/wab/shared/core/components";
import { createSite } from "@/wab/shared/core/sites";
import { VariantedValue } from "@/wab/shared/model/classes";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import React from "react";

beforeEach(() => vi.stubGlobal("IntersectionObserver", class {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}));
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it("updates real opacity and typography indicators and avoids context demand when an explicit helper is provided", async () => {
  vi.spyOn(ViewCtx.prototype, "isVisible").mockReturnValue(false);
  vi.spyOn(ViewCtx.prototype, "scheduleSync").mockImplementation(() => undefined);
  const site = createSite(), manager = new TplMgr({ site });
  const theme = manager.createGlobalVariantGroup("Theme");
  const dark = manager.createGlobalVariant(theme, "Dark");
  const accent = mkStyleToken({ name: "Theme accent", type: "Color", value: "#8844cc" });
  accent.variantedValues.push(new VariantedValue({ variants: [dark], value: "#ff99bb" }));
  site.styleTokens.push(accent);
  const component = manager.addComponent({ name: "Typography", type: ComponentType.Plain });
  const frame = mkArenaFrame({ site, component, name: "Typography", width: 200, height: 100 });
  site.arenas.push(mkMixedArena("Controls", [frame]));
  const rs = ensure(site.activeTheme, "Active theme").defaultStyle.rs, exp = new RuleSetHelpers(rs, "div");
  exp.set("opacity", "0.2");
  exp.set("color", "#272d3a");
  exp.clear("line-height"); exp.clear("letter-spacing");
  const { studioCtx: studio } = fakeStudioCtx({ site, initialUrl: "/projects/test?arena_type=custom&arena=Controls" });
  await waitFor(() => expect(studio.initialRouteReady).toBe(true));
  studio.setStudioFocusOnViewCtxContent(ensure(studio.tryGetViewCtxForFrame(frame), "Control view"));
  const provider = new SingleRsExpsProvider(rs, exp, studio, [], { kind: "ruleSet", rs, forTag: "div" });
  const sc = new StyleTarget({ expsProvider: provider });
  const declared = vi.spyOn(studio.modelSnapshots, "declaredField");
  const controls = (vsh?: VariantedStylesHelper, verticalAlign = false) => (
    <AppContext.Provider value={studio.app}>
      <StudioCtxContext.Provider value={studio}>
        <StyleTargetContext.Provider value={sc}>
          <SidebarModalProvider containerSelector="#typography-test-panel">
            <div id="typography-test-panel">
              <OpacityControl expsProvider={provider} vsh={vsh} />
              <StylePanelSection
                title="Typography"
                styleProps={["color", "font-style"]}
                expsProvider={provider}
                headerMenuOnRightClickOnly
                controls={<TypographySettings inheritableOnly={false} />}
              >
                <Typography vsh={vsh} verticalAlign={verticalAlign} />
              </StylePanelSection>
            </div>
          </SidebarModalProvider>
        </StyleTargetContext.Provider>
      </StudioCtxContext.Provider>
    </AppContext.Provider>
  );
  const mounted = render(controls());
  try {
    expect(screen.getByDisplayValue("20%")).toBeTruthy();
    expect(screen.getByRole("group", { name: "Align" })).toBeTruthy();
    const vertical = within(screen.getByRole("group", { name: "Vertical alignment" }));
    expect(vertical.getAllByRole("button").map((button) => button.hasAttribute("disabled"))).toEqual([true, true, true]);
    fireEvent.click(vertical.getByRole("button", { name: "Bottom" }));
    expect(exp.has("align-content")).toBe(false);
    expect(screen.queryByDisplayValue("1.8")).toBeNull();
    expect(screen.queryByRole("dialog", { name: "Typography settings" })).toBeNull();
    expect(declared.mock.calls.some(([model, key]) => model === frame && key === "targetGlobalVariants")).toBe(true);
    await act(async () => { await studio.changeUnsafe(() => { exp.set("opacity", "0.6"); exp.set("line-height", "1.8"); }); });
    expect(screen.getByDisplayValue("60%")).toBeTruthy();
    expect(screen.getByDisplayValue("1.8")).toBeTruthy();
    mounted.unmount(); declared.mockClear();
    const explicit = new VariantedStylesHelper(site, [dark]);
    const provided = render(controls(explicit, true));
    expect(screen.getByDisplayValue("60%")).toBeTruthy();
    expect(declared.mock.calls.some(([model, key]) => model === frame && key === "targetGlobalVariants")).toBe(false);
    const align = within(screen.getByRole("group", { name: "Align" }));
    fireEvent.click(align.getByRole("button", { name: "Justify" }));
    await waitFor(() => expect(exp.get("text-align")).toBe("justify"));
    expect(align.getByRole("button", { name: "Justify" }).getAttribute("aria-pressed")).toBe("true");
    expect(align.getByRole("button", { name: "Align left" }).getAttribute("aria-pressed")).toBe("false");

    fireEvent.click(screen.getByRole("button", { name: "Bottom" }));
    await waitFor(() => expect(exp.get("align-content")).toBe("end"));

    const italic = screen.getByRole("button", { name: "Italic" });
    fireEvent.click(italic);
    await waitFor(() => expect(exp.get("font-style")).toBe("italic"));
    expect(italic.getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(italic);
    await waitFor(() => expect(exp.get("font-style")).toBe("normal"));
    expect(italic.getAttribute("aria-pressed")).toBe("false");

    const color = screen.getByRole("button", { name: "Text color" });
    expect(color.tagName).toBe("BUTTON");
    const colorIcon = ensure(color.querySelector('[data-icon="font-colors"]'), "Text color icon inside the picker trigger");
    expect(color.textContent).toBe("");
    expect(document.querySelector('[data-test-id="Color-input"]')).toBeNull();
    fireEvent.click(colorIcon);
    const picker = await screen.findByRole("dialog", { name: "Text color" });
    expect(document.querySelector('[data-test-id="close-sidebar-modal"]')).toBeNull();
    const hex = ensure(picker.querySelector('[data-test-id="Color-input"]'), "Color picker Hex input");
    fireEvent.change(hex, { target: { value: "263a70" } });
    fireEvent.blur(hex);
    await waitFor(() => expect(exp.get("color").toLowerCase()).toBe("#263a70"));
    expect(within(picker).queryByRole("button", { name: "Theme variables" })).toBeNull();
    const token = await within(picker).findByRole("button", { name: /Theme accent.*#ff99bb/i });
    fireEvent.click(token);
    await waitFor(() => expect(exp.get("color")).toBe(mkTokenRef(accent)));
    const swatchColor = () => color.querySelector<HTMLElement>("[data-color-swatch]")?.style.backgroundColor;
    await waitFor(() => expect(swatchColor()).toBe("rgb(255, 153, 187)"));
    await act(async () => { await studio.changeUnsafe(() => { accent.variantedValues[0].value = "#112233"; }); });
    await waitFor(() => expect(swatchColor()).toBe("rgb(17, 34, 51)"));
    fireEvent.keyDown(picker, { key: "Escape" });
    await waitFor(() => expect(document.activeElement).toBe(color));
    await userEvent.keyboard("{Enter}");
    fireEvent.keyDown(await screen.findByRole("dialog", { name: "Text color" }), { key: "Escape" });

    const title = screen.getByText("Typography");
    const header = ensure(title.closest(".SidebarSection__Container")?.querySelector<HTMLElement>('[data-plasmic-role="labeled-item"]'), "Typography header");
    expect(within(header).getAllByRole("button").map((button) => button.getAttribute("aria-label"))).toEqual(["Typography settings"]);
    fireEvent.click(screen.getByRole("button", { name: "Typography settings" }));
    const settings = within(await screen.findByRole("dialog", { name: "Typography settings" }));
    for (const name of ["Justify", "Italic", "Text color"]) {
      expect(settings.queryByRole("button", { name })).toBeNull();
    }
    const ellipsis = settings.getByRole("button", { name: "Ellipsis" });
    const wrap = settings.getByRole("button", { name: "Line wrap" });
    expect(ellipsis.hasAttribute("disabled")).toBe(true);
    fireEvent.click(wrap);
    await waitFor(() => expect(exp.get("white-space")).toBe("nowrap"));
    fireEvent.click(ellipsis);
    await waitFor(() => expect(exp.get("text-overflow")).toBe("ellipsis"));
    expect(exp.get("overflow")).toBe("hidden");

    fireEvent.click(wrap);
    await waitFor(() => expect(exp.get("white-space")).toBe("pre-wrap"));
    expect(exp.has("text-overflow")).toBe(false);
    expect(exp.has("overflow")).toBe(false);
    expect(ellipsis.hasAttribute("disabled")).toBe(true);

    await act(async () => { await studio.undo(); });
    expect(exp.get("white-space")).toBe("nowrap");
    expect(exp.get("text-overflow")).toBe("ellipsis");
    expect(exp.get("overflow")).toBe("hidden");
    fireEvent.contextMenu(title);
    expect(await screen.findByRole("menuitem", { name: /all Typography styles to a style preset/ })).toBeTruthy();
    expect(screen.queryByRole("menuitem", { name: /Remove all Typography styles/ })).toBeNull();
    provided.unmount();
  } finally { mounted.unmount(); await studio.awaitEval(); studio.dispose(); }
});
