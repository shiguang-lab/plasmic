import { fakeStudioCtx } from "@/wab/client/__testonly__/fake-init-ctx";
import { VariantComboPicker } from "@/wab/client/components/variants/VariantComboPicker";
import { StudioCtxContext } from "@/wab/client/contexts/StudioContexts";
import { TplMgr } from "@/wab/shared/TplMgr";
import { VariantCombo } from "@/wab/shared/Variants";
import { ensure } from "@/wab/shared/common";
import { ComponentType } from "@/wab/shared/core/components";
import { createSite } from "@/wab/shared/core/sites";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import React from "react";

async function setup() {
  const site = createSite();
  const tplMgr = new TplMgr({ site });
  const component = tplMgr.addComponent({
    name: "Card",
    type: ComponentType.Plain,
  });
  const group = tplMgr.createVariantGroup({ component, name: "Mode" });
  const first = tplMgr.createVariant(component, group, "First");
  const second = tplMgr.createVariant(component, group, "Second");
  const baseVariant = ensure(component.variants[0], "Component base variant");
  const { studioCtx } = fakeStudioCtx({ site });
  await vi.waitFor(() => expect(studioCtx.initialRouteReady).toBe(true));
  studioCtx.observeComponents([component]);
  studioCtx.createViewStateUndoRecord();
  return { studioCtx, site, component, baseVariant, first, second };
}

function picker(
  f: Awaited<ReturnType<typeof setup>>,
  value: VariantCombo,
  onChange: (combo: VariantCombo) => void,
) {
  return (
    <StudioCtxContext.Provider value={f.studioCtx}>
      <VariantComboPicker
        site={f.site}
        component={f.component}
        value={value}
        onChange={onChange}
      />
    </StudioCtxContext.Provider>
  );
}

beforeEach(() => {
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      observe = vi.fn();
      unobserve = vi.fn();
      disconnect = vi.fn();
    },
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it("reclassifies a base variant from its committed name without rerendering the parent", async () => {
  const f = await setup();
  try {
    let parentRenders = 0;
    const Parent = React.memo(function Parent() {
      parentRenders += 1;
      return picker(f, [f.baseVariant, f.first], () => undefined);
    });
    render(<Parent />);

    expect(screen.getByText("First")).toBeTruthy();
    expect(screen.queryByText("base")).toBeNull();
    expect(parentRenders).toBe(1);

    await act(async () => {
      await f.studioCtx.changeUnsafe(() => {
        f.baseVariant.name = "Bare";
      });
    });

    await waitFor(() => expect(screen.getByText("Bare")).toBeTruthy());
    expect(parentRenders).toBe(1);
  } finally {
    cleanup();
    f.studioCtx.dispose();
  }
});

it("detaches the previous combo's name subscriptions when the parent replaces it", async () => {
  const f = await setup();
  try {
    const oldNameStore = f.studioCtx.modelSnapshots.field(f.first, "name");
    let oldSubscriptions = 0;
    const subscribe = oldNameStore.subscribe;
    vi.spyOn(oldNameStore, "subscribe").mockImplementation((listener) => {
      oldSubscriptions += 1;
      const stop = subscribe(listener);
      return () => {
        oldSubscriptions -= 1;
        stop();
      };
    });

    const view = render(
      picker(f, [f.baseVariant, f.first], () => undefined),
    );
    // Both the picker base classification and the visible native label demand name.
    expect(oldSubscriptions).toBe(2);

    view.rerender(picker(f, [f.baseVariant, f.second], () => undefined));
    expect(oldSubscriptions).toBe(0);
  } finally {
    cleanup();
    f.studioCtx.dispose();
  }
});

it("keeps dropdown targeting and badge removal on the original combo commands", async () => {
  const f = await setup();
  const onChange = vi.fn();
  try {
    function Harness() {
      const [combo, setCombo] = React.useState<VariantCombo>([f.baseVariant]);
      return picker(f, combo, (next) => {
        onChange(next);
        setCombo(next);
      });
    }
    const view = render(<Harness />);

    const trigger = ensure(
      view.container.querySelector<HTMLElement>('[class*="valueContainer"]'),
      "Combo trigger",
    );
    fireEvent.click(trigger);
    fireEvent.click(await screen.findByText("First"));
    await waitFor(() => expect(onChange).toHaveBeenLastCalledWith([f.first]));

    await waitFor(() =>
      expect(
        view.container.querySelector('[class*="removeIcon"]'),
      ).not.toBeNull(),
    );
    fireEvent.click(
      ensure(
        view.container.querySelector<HTMLElement>('[class*="removeIcon"]'),
        "Variant remove icon",
      ),
    );
    await waitFor(() =>
      expect(onChange).toHaveBeenLastCalledWith([f.baseVariant]),
    );
  } finally {
    cleanup();
    f.studioCtx.dispose();
  }
});
