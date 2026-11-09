import "@/wab/client/components/sidebar/MixinControls";
import { fakeStudioCtx } from "@/wab/client/__testonly__/fake-init-ctx";
import { StandaloneVariant } from "@/wab/client/components/variants/StandaloneVariantGroup";
import { StandaloneVariantInputs } from "@/wab/client/studio-ctx/variant-group-inputs";
import { mkMixedArena } from "@/wab/shared/Arenas";
import { TplMgr, VariantOptionsType } from "@/wab/shared/TplMgr";
import { ComponentType } from "@/wab/shared/core/components";
import { codeLit } from "@/wab/shared/core/exprs";
import { createSite } from "@/wab/shared/core/sites";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import * as React from "react";

vi.mock("@/wab/client/components/variants/VariantRow", () => ({
  default: ({ hasCodeExpression, onToggle }: { hasCodeExpression: boolean; onToggle?: () => void }) => <>
    <output aria-label="Expression mode">{hasCodeExpression ? "dynamic" : "literal"}</output>
    <button onClick={onToggle}>Toggle variant</button>
  </>,
}));
afterEach(cleanup);

async function setup() {
  const site = createSite(); site.arenas = [mkMixedArena("Metadata")];
  const manager = new TplMgr({ site });
  const component = manager.addComponent({ name: "Control", type: ComponentType.Plain });
  const group = manager.createVariantGroup({ component, name: "Disabled", optionsType: VariantOptionsType.standalone });
  const { studioCtx } = fakeStudioCtx({ site, initialUrl: "/projects/test?arena_type=custom&arena=Metadata" });
  await waitFor(() => expect(studioCtx.initialRouteReady).toBe(true));
  studioCtx.dbCtx().maybeObserveComponents([component]);
  return { studioCtx, component, group };
}

it("publishes expression presence without invalidating on unrelated component names", async () => {
  const f = await setup();
  const source = new StandaloneVariantInputs(f.studioCtx, f.component, f.group);
  const changed = vi.fn(), stop = source.subscribe(changed), onToggle = vi.fn();
  const mounted = render(<StandaloneVariant studioCtx={f.studioCtx} component={f.component}
    group={f.group} defaultEditing={false} pinState={undefined} onToggle={onToggle} />);
  try {
    expect(screen.getByRole("status", { name: "Expression mode" }).textContent).toBe("literal");
    await act(async () => { await f.studioCtx.changeUnsafe(() => { f.group.param.defaultExpr = codeLit(true); }); });
    expect(screen.getByRole("status", { name: "Expression mode" }).textContent).toBe("dynamic");
    expect(changed).toHaveBeenCalledOnce();
    changed.mockClear();
    await act(async () => { await f.studioCtx.changeUnsafe(() => { f.component.name = "Unrelated title"; }); });
    expect(changed).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Toggle variant" }));
    expect(onToggle).toHaveBeenCalledOnce();
    await act(async () => { await f.studioCtx.changeUnsafe(() => { f.group.param.defaultExpr = null; }); });
    expect(screen.getByRole("status", { name: "Expression mode" }).textContent).toBe("literal");
  } finally { mounted.unmount(); stop(); await f.studioCtx.awaitEval(); f.studioCtx.dispose(); }
});

it("retires retained group props when the original model lifetime closes", async () => {
  const f = await setup();
  const node = <StandaloneVariant studioCtx={f.studioCtx} component={f.component} group={f.group} defaultEditing={false} pinState={undefined} />;
  const mounted = render(node);
  try {
    const fields = vi.spyOn(f.studioCtx.modelSnapshots, "declaredField");
    act(() => { f.studioCtx.arenaState.reset(); });
    fields.mockClear();
    expect(() => mounted.rerender(node)).not.toThrow();
    expect(screen.queryByRole("status", { name: "Expression mode" })).toBeNull();
    expect(fields).not.toHaveBeenCalled();
  } finally { mounted.unmount(); await f.studioCtx.awaitEval(); f.studioCtx.dispose(); }
});
