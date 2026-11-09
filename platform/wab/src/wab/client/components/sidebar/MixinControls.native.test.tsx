import { fakeStudioCtx } from "@/wab/client/__testonly__/fake-init-ctx";
import { MixinPreview } from "@/wab/client/components/sidebar/MixinControls";
import { MixinPanelInputs } from "@/wab/client/components/sidebar/mixin-panel-inputs";
import { mkStyleToken, mkTokenRef } from "@/wab/commons/StyleToken";
import { TplMgr } from "@/wab/shared/TplMgr";
import { RuleSetHelpers } from "@/wab/shared/RuleSetHelpers";
import { VariantedStylesHelper } from "@/wab/shared/VariantedStylesHelper";
import { ensure } from "@/wab/shared/common";
import { createSite } from "@/wab/shared/core/sites";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import * as React from "react";

afterEach(cleanup);
it("updates the actual preview's token CSS, text and inherited theme values, then retires its original model owner", async () => {
  const site = createSite(), manager = new TplMgr({ site }), mixin = manager.addMixin("Text style");
  const token = mkStyleToken({ name: "Ink", type: "Color", value: "#123456" }); site.styleTokens.push(token);
  mixin.preview = "Native sample"; new RuleSetHelpers(mixin.rs, "div").set("color", mkTokenRef(token));
  const { studioCtx: studio } = fakeStudioCtx({ site });
  await waitFor(() => expect(studio.initialRouteReady).toBe(true));
  const catalog = new MixinPanelInputs(studio, { kind: "catalog" }), changed = vi.fn(), stop = catalog.subscribe(changed);
  changed.mockClear();
  const mounted = render(<MixinPreview sc={studio} mixin={mixin} vsh={new VariantedStylesHelper(site)} tag="div" />);
  try {
    expect(screen.getByText("Native sample").style.color).toBe("rgb(18, 52, 86)");
    await act(async () => { await studio.changeUnsafe(() => { token.value = "#ABCDEF"; mixin.preview = "Updated sample"; }); });
    expect(screen.getByText("Updated sample").style.color).toBe("rgb(171, 205, 239)");
    expect(changed).not.toHaveBeenCalled();
    await act(async () => { await studio.changeUnsafe(() => { new RuleSetHelpers(ensure(site.activeTheme, "Theme").defaultStyle.rs, "div").set("font-size", "20px"); mixin.name = "Renamed style"; }); });
    expect(changed).toHaveBeenCalledOnce();
    const wrapper = ensure(mounted.container.querySelector<HTMLElement>(".style__assets__typography__preview > div"), "Inherited preview wrapper");
    expect(wrapper.style.fontSize).toBe("20px");
    act(() => studio.arenaState.reset());
    expect(screen.queryByText("Updated sample")).toBeNull();
    expect(catalog.isActive()).toBe(false);
  } finally { mounted.unmount(); stop(); await studio.awaitEval(); studio.dispose(); }
});
