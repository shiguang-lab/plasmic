import { ModelRevisions, modelKeys } from "@/wab/shared/model-revisions";

const flushMicrotasks = () => Promise.resolve();

beforeEach(() => {
  revisions.dispose(); revisions = new ModelRevisions();
});

it("isolates identical keys in different editors and cancels disposed pending work", async () => {
  const other = new ModelRevisions(), changed = vi.fn();
  const stop = revisions.subscribeModelKeys([modelKeys.site], changed);
  other.markModelKeysDirty([modelKeys.site]); other.flushModelRevisions();
  expect(changed).not.toHaveBeenCalled();
  expect(revisions.getModelRevision(modelKeys.site)).toBe(0);
  revisions.markModelKeysDirty([modelKeys.site]); revisions.dispose();
  await flushMicrotasks();
  expect(changed).not.toHaveBeenCalled();
  stop(); other.dispose();
});

it("invalidates structural readers on model replacement without retaining old keys", () => {
  const changed = vi.fn(); revisions.subscribeModelKeys(["catalog"], changed);
  const before = revisions.getModelRevision("catalog");
  revisions.replaceModels();
  expect(changed).toHaveBeenCalledTimes(1);
  expect(revisions.getModelRevision("catalog")).toBeGreaterThan(before);
  revisions.markModelKeysDirty(["catalog"]); revisions.flushModelRevisions();
  expect(changed).toHaveBeenCalledTimes(2);
});

it("keeps independent subscriptions with the same callback alive", () => {
  const changed = vi.fn();
  const first = revisions.subscribeModelKeys(["key"], changed);
  const second = revisions.subscribeModelKeys(["key"], changed);
  first(); revisions.markModelKeysDirty(["key"]); revisions.flushModelRevisions();
  expect(changed).toHaveBeenCalledTimes(1); second();
});

it("installs a complete batch before notifying each subscriber once", () => {
  const seen: number[][] = [];
  const stop = revisions.subscribeModelKeys(["a", "b"], () => {
    seen.push([revisions.getModelRevision("a"), revisions.getModelRevision("b")]);
  });
  revisions.markModelKeysDirty(["a", "b"]);
  revisions.flushModelRevisions();
  expect(seen).toEqual([[1, 1]]);
  stop();
});

it("bumps a key once per coalesced batch", async () => {
  const key = modelKeys.tpl("t1");
  expect(revisions.getModelRevision(key)).toBe(0);

  revisions.markModelKeysDirty([key]);
  revisions.markModelKeysDirty([key, key]);
  await flushMicrotasks();

  expect(revisions.getModelRevision(key)).toBe(1);
});

it("notifies subscribers once per batch", async () => {
  const key = modelKeys.component("c1");
  const listener = vi.fn();
  const unsubscribe = revisions.subscribeModelKeys([key], listener);

  revisions.markModelKeysDirty([key]);
  revisions.markModelKeysDirty([key]);
  await flushMicrotasks();

  expect(listener).toHaveBeenCalledTimes(1);
  unsubscribe();
});

it("stops notifying after unsubscribe", async () => {
  const key = modelKeys.variant("v1");
  const listener = vi.fn();
  const unsubscribe = revisions.subscribeModelKeys([key], listener);
  unsubscribe();

  revisions.markModelKeysDirty([key]);
  await flushMicrotasks();

  expect(listener).not.toHaveBeenCalled();
  // The revision still advances: it belongs to the editor, not per-subscriber.
  expect(revisions.getModelRevision(key)).toBe(1);
});

it("isolates unrelated keys", async () => {
  const a = modelKeys.tpl("a");
  const b = modelKeys.tpl("b");
  const listenerA = vi.fn();
  revisions.subscribeModelKeys([a], listenerA);

  revisions.markModelKeysDirty([b]);
  await flushMicrotasks();

  expect(listenerA).not.toHaveBeenCalled();
  expect(revisions.getModelRevision(a)).toBe(0);
  expect(revisions.getModelRevision(b)).toBe(1);
});

it("flushes synchronously when asked", () => {
  const key = modelKeys.site;
  revisions.markModelKeysDirty([key]);
  revisions.flushModelRevisions();
  expect(revisions.getModelRevision(key)).toBe(1);
});


let revisions = new ModelRevisions();
