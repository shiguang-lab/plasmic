import { CanvasFrameLoad } from "@/wab/client/components/canvas/canvas-frame-load";
import { ModelSnapshots } from "@/wab/client/studio-ctx/model-snapshots";
import { StudioArenaState } from "@/wab/client/studio-ctx/studio-arena-state";
import { createSite } from "@/wab/shared/core/sites";

it("invalidates pending work immediately and releases resources after owner publication, without rejecting cancellation", async () => {
  const models = new ModelSnapshots();
  const owner = new StudioArenaState({ site: createSite(), modelSnapshots: models });
  const lifetime = owner.lifetime();
  const load = new CanvasFrameLoad(lifetime, () => owner.isCurrentLifetime(lifetime));
  const cancelQueued = vi.fn();
  load.own(cancelQueued);
  const context = vi.fn();
  const events = vi.fn();
  const steps: string[] = [];
  load.own(() => { steps.push("context"); context(); });
  load.own(() => { steps.push("events"); events(); });
  const loaded = new Promise<void>((resolve, reject) => load.begin(resolve, reject));
  owner.deferResourceDisposal(() => {
    owner.reset();
    expect(load.isActive()).toBe(false);
    expect(lifetime.aborted).toBe(false);
    expect(cancelQueued).not.toHaveBeenCalled();
    expect(context).not.toHaveBeenCalled();
    expect(events).not.toHaveBeenCalled();
  });
  await expect(loaded).resolves.toBeUndefined();
  expect(steps).toEqual(["events", "context"]);
  load.cancel();
  expect(cancelQueued).toHaveBeenCalledOnce();
  expect(context).toHaveBeenCalledOnce();
  expect(events).toHaveBeenCalledOnce();
  owner.dispose(); models.dispose();
});

it("does not let an abandoned iframe generation cancel its replacement or report its late failure", async () => {
  const signal = new AbortController();
  const first = new CanvasFrameLoad(signal.signal, () => true);
  const oldResource = vi.fn();
  first.own(oldResource);
  const old = new Promise<void>((resolve, reject) => first.begin(resolve, reject));
  first.cancel();
  const second = new CanvasFrameLoad(signal.signal, () => true);
  const newResource = vi.fn();
  second.own(newResource);
  const ready = new Promise<void>((resolve, reject) => second.begin(resolve, reject));
  first.fail(new Error("Late host failure"));
  first.cancel();
  await expect(old).resolves.toBeUndefined();
  expect(second.isActive()).toBe(true);
  expect(newResource).not.toHaveBeenCalled();
  second.complete();
  await expect(ready).resolves.toBeUndefined();
  signal.abort();
  expect(oldResource).toHaveBeenCalledOnce();
  expect(newResource).toHaveBeenCalledOnce();
});

it("rejects genuine load errors, cleans resources and refuses to start after cancellation", async () => {
  const signal = new AbortController();
  const load = new CanvasFrameLoad(signal.signal, () => true);
  const cleanup = vi.fn();
  load.own(cleanup);
  const result = new Promise<void>((resolve, reject) => load.begin(resolve, reject));
  const rejected = expect(result).rejects.toThrow("Host failed");
  load.fail(new Error("Host failed"));
  await rejected;
  expect(cleanup).toHaveBeenCalledOnce();
  expect(load.isActive()).toBe(false);
  await expect(new Promise<void>((resolve, reject) => load.begin(resolve, reject))).resolves.toBeUndefined();
  load.cancel();
  expect(cleanup).toHaveBeenCalledOnce();
});
