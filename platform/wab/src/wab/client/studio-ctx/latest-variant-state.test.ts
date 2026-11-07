import { fakeStudioCtx } from "@/wab/client/__testonly__/fake-init-ctx";
import { ensure } from "@/wab/shared/common";
import { ComponentType } from "@/wab/shared/core/components";
import { waitFor } from "@testing-library/react";

it("owns the latest variant reference natively and clears it before model disposal", async () => {
  const { studioCtx } = fakeStudioCtx();
  let stop: (() => void) | undefined;
  try {
    await waitFor(() => expect(studioCtx.initialRouteReady).toBe(true));
    const component = await studioCtx.changeUnsafe(() => studioCtx.addComponent("Variants", { type: ComponentType.Plain }));
    const variant = ensure(component.variants[0], "Expected a component base variant");
    const publish = vi.fn();
    stop = studioCtx.latestVariantCreatedStore.subscribe(publish);
    studioCtx.latestVariantCreated = variant;
    const ref = studioCtx.latestVariantCreatedStore.getState();
    expect(ref).toBe(studioCtx.modelSnapshots.ref(variant));
    expect(Object.isFrozen(ref)).toBe(true);
    expect(studioCtx.latestVariantCreated).toBe(variant);
    expect(publish).toHaveBeenCalledOnce();
    studioCtx.latestVariantCreated = variant;
    expect(publish).toHaveBeenCalledOnce();
    studioCtx.dispose();
    expect(studioCtx.latestVariantCreatedStore.getState()).toBeUndefined();
    expect(studioCtx.latestVariantCreated).toBeUndefined();
    expect(publish).toHaveBeenCalledTimes(2);
    studioCtx.dispose();
    expect(publish).toHaveBeenCalledTimes(2);
  } finally { stop?.(); studioCtx.dispose(); }
});
