/** Explicit structural invalidation owned by one editor. Ordinary field reads
 * use ModelSnapshots; only whole-document/component queries need these keys. */
export type ModelKey = string;
export const modelKeys = {
  site: "site",
  component: (uuid: string) => `component:${uuid}`,
  tpl: (uuid: string) => `tpl:${uuid}`,
  variant: (uuid: string) => `variant:${uuid}`,
  token: (uuid: string) => `token:${uuid}`,
  arena: (uuid: string) => `arena:${uuid}`,
} as const;

export class ModelRevisions {
  private readonly revisions = new Map<ModelKey, number>();
  private readonly listeners = new Map<ModelKey, Set<() => void>>();
  private pending = new Set<ModelKey>();
  private flushScheduled = false;
  private generation = 0;
  private epoch = 0;
  private disposed = false;

  getModelRevision = (key: ModelKey): number => this.revisions.get(key) ?? this.epoch;

  subscribeModelKeys = (keys: readonly ModelKey[], listener: () => void): (() => void) => {
    if (this.disposed) { return () => undefined; }
    const subscribedKeys = [...new Set(keys)];
    let active = true;
    const notify = () => { if (active) { listener(); } };
    for (const key of subscribedKeys) {
      let set = this.listeners.get(key);
      if (!set) { set = new Set(); this.listeners.set(key, set); }
      set.add(notify);
    }
    return () => {
      active = false;
      for (const key of subscribedKeys) {
        const set = this.listeners.get(key);
        set?.delete(notify);
        if (!set?.size) { this.listeners.delete(key); }
      }
    };
  };

  markModelKeysDirty = (keys: Iterable<ModelKey>): void => {
    if (this.disposed) { return; }
    for (const key of keys) { this.pending.add(key); }
    if (!this.flushScheduled && this.pending.size) {
      this.flushScheduled = true;
      const generation = this.generation;
      queueMicrotask(() => {
        if (generation !== this.generation) { return; }
        this.flushScheduled = false;
        this.flushModelRevisions();
      });
    }
  };

  flushModelRevisions = (): void => {
    if (this.disposed) { return; }
    const dirty = this.pending;
    this.pending = new Set();
    const notifications = new Set<() => void>();
    for (const key of dirty) {
      this.revisions.set(key, this.getModelRevision(key) + 1);
      this.listeners.get(key)?.forEach((listener) => notifications.add(listener));
    }
    // Install all revisions before notifying, once per subscription.
    notifications.forEach((listener) => listener());
  };

  /** Release departed keys while invalidating even a previously untouched key. */
  replaceModels = (): void => {
    if (this.disposed) { return; }
    for (const revision of this.revisions.values()) { this.epoch = Math.max(this.epoch, revision); }
    this.epoch++;
    this.revisions.clear(); this.pending.clear(); this.flushScheduled = false; this.generation++;
    const notifications = new Set([...this.listeners.values()].flatMap((listeners) => [...listeners]));
    notifications.forEach((listener) => listener());
  };

  dispose = (): void => {
    this.disposed = true; this.generation++; this.pending.clear(); this.revisions.clear(); this.listeners.clear();
  };
}
