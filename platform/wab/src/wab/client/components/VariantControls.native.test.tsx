import "@/wab/client/components/sidebar/MixinControls";
import { fakeStudioCtx } from "@/wab/client/__testonly__/fake-init-ctx";
import { StyleOrCodeComponentVariantLabel, StyleVariantEditor } from "@/wab/client/components/VariantControls";
import type { Selector } from "@/wab/client/components/sidebar/RuleSetControls";
import { StudioCtxContext } from "@/wab/client/contexts/StudioContexts";
import { ensure } from "@/wab/shared/common";
import { isCodeComponentVariant } from "@/wab/shared/Variants";
import { assert } from "@/wab/shared/common";
import { TplMgr } from "@/wab/shared/TplMgr";
import { mkCodeComponent } from "@/wab/shared/code-components/code-components";
import { ComponentType, mkComponent } from "@/wab/shared/core/components";
import { createSite } from "@/wab/shared/core/sites";
import { mkTplComponent } from "@/wab/shared/core/tpls";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import * as React from "react";

vi.mock("@/wab/client/components/sidebar/RuleSetControls", async (original) => ({
  ...(await original<typeof import("@/wab/client/components/sidebar/RuleSetControls")>()),
  SelectorTags: ({ selectors }: { selectors: Selector[] }) => <output>{selectors.map((selector) => selector.type === "CssSelector" ? selector.cssSelector : `${selector.componentName}:${selector.displayName}`).join(",")}</output>,
  SelectorsInput: () => null,
}));
afterEach(cleanup);

it("refreshes registered selector captions and owner names and does not submit an editor after world retirement", async () => {
  const site = createSite(), manager = new TplMgr({ site });
  const code = mkCodeComponent("Button", { name: "Button", importPath: "./button", props: {}, variants: { focused: { cssSelector: ".focused", displayName: "Focused" } } }, {});
  const component = mkComponent({ name: "Wrapper", type: ComponentType.Plain, tplTree: (base) => mkTplComponent(code, base) });
  site.components.push(code, component);
  const variant = manager.createCodeComponentVariant(component, "Button", ["focused"]);
  assert(isCodeComponentVariant(variant), "Expected a registered code-component variant");
  const { studioCtx: studio } = fakeStudioCtx({ site });
  await waitFor(() => expect(studio.initialRouteReady).toBe(true));
  studio.dbCtx().maybeObserveComponents([component, code]);
  const mounted = render(<StudioCtxContext.Provider value={studio}><StyleOrCodeComponentVariantLabel component={component} variant={variant} forTag="div" /><StyleVariantEditor component={component} variant={variant} /></StudioCtxContext.Provider>);
  try {
    expect(screen.getByRole("status").textContent).toBe("Wrapper:Focused");
    await act(async () => { await studio.changeUnsafe(() => { ensure(code.codeComponentMeta.variants.focused, "Registered variant metadata").displayName = "Focused updated"; component.name = "New owner"; }); });
    expect(screen.getByRole("status").textContent).toBe("New owner:Focused updated");
    const change = vi.spyOn(studio, "changeUnsafe");
    act(() => studio.dispose());
    expect(change).not.toHaveBeenCalled();
    expect(mounted.container.textContent).toBe("");
  } finally { mounted.unmount(); studio.dispose(); vi.restoreAllMocks(); }
});
