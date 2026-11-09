import { useVariantModelWorld } from "@/wab/client/components/variants/variant-model-world";
import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { ModelSnapshots } from "@/wab/client/studio-ctx/model-snapshots";
import type { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { createSite } from "@/wab/shared/core/sites";
import { act, renderHook } from "@testing-library/react";

it("accepts a new view in the same world without admitting old model props into a replacement world", () => {
  const models = new ModelSnapshots(), nextModels = new ModelSnapshots();
  let lifetime = new AbortController();
  const owner = { site: createSite(), modelSnapshots: models, arenaState: { lifetime: () => lifetime.signal } };
  const studio = owner as unknown as StudioCtx, identity = {};
  const makeView = () => ({ modelLifetime: lifetime.signal, disposeSignal: new AbortController().signal, isDisposed: false }) as unknown as ViewCtx;
  const first = makeView(), second = makeView();
  const hook = renderHook(({ view, model }) => useVariantModelWorld(studio, model, view), { initialProps: { view: first, model: identity } });
  try {
    expect(hook.result.current.alive).toBe(true);
    hook.rerender({ view: second, model: identity });
    expect(hook.result.current.alive).toBe(true);
    act(() => { lifetime.abort(); owner.site = createSite(); owner.modelSnapshots = nextModels; lifetime = new AbortController(); });
    const nextView = makeView();
    hook.rerender({ view: nextView, model: identity });
    expect(hook.result.current.alive).toBe(false);
    expect(hook.result.current.models).toBe(models);
    hook.rerender({ view: nextView, model: {} });
    expect(hook.result.current.alive).toBe(true);
    expect(hook.result.current.models).toBe(nextModels);
  } finally { hook.unmount(); models.dispose(); nextModels.dispose(); }
});


it("keeps the original model world when a retained identity receives a different Studio", () => {
  const models = new ModelSnapshots(), nextModels = new ModelSnapshots();
  const firstLifetime = new AbortController(), nextLifetime = new AbortController();
  const first = { site: createSite(), modelSnapshots: models, arenaState: { lifetime: () => firstLifetime.signal } } as unknown as StudioCtx;
  const second = { site: createSite(), modelSnapshots: nextModels, arenaState: { lifetime: () => nextLifetime.signal } } as unknown as StudioCtx;
  const identity = {}, hook = renderHook(({ studio, model }) => useVariantModelWorld(studio, model), { initialProps: { studio: first, model: identity } });
  try {
    expect(hook.result.current.alive).toBe(true);
    hook.rerender({ studio: second, model: identity });
    expect(hook.result.current.alive).toBe(false); expect(hook.result.current.models).toBe(models);
    hook.rerender({ studio: second, model: {} });
    expect(hook.result.current.alive).toBe(true); expect(hook.result.current.models).toBe(nextModels);
  } finally { hook.unmount(); models.dispose(); nextModels.dispose(); }
});
