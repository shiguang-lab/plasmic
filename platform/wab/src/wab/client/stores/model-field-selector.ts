import type { ModelFieldStore, ModelSnapshot, ModelSnapshots } from "@/wab/client/studio-ctx/model-snapshots";
import type { ObjInst } from "@/wab/shared/model/classes";
import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";

export type ModelFieldRead = <T extends ObjInst, K extends Exclude<keyof T, "uid"> & string>(model: T, key: K) => ModelSnapshot<T[K]>;

/** A selected output of explicitly declared model fields. No intercepted reads,
 * global revisions, or retained subscriptions without a mounted consumer. */
export class ModelFieldSelector<T> {
  private current: T | undefined;
  private published: T | undefined;
  private dirty = true;
  private connected = false;
  private readonly fields = new Map<ModelFieldStore<unknown>, { stop: () => void; prepare: () => void }>();
  private readonly listeners = new Set<() => void>();
  private readonly models: ModelSnapshots;
  private readonly lifetime: AbortSignal;

  constructor(
    private readonly studio: Pick<StudioCtx, "modelSnapshots" | "arenaState">,
    private readonly select: (read: ModelFieldRead) => T,
    private readonly equals: (previous: T, next: T) => boolean = Object.is,
  ) { this.models = studio.modelSnapshots; this.lifetime = studio.arenaState.lifetime(); }

  isCurrent = () => !this.lifetime.aborted && this.models === this.studio.modelSnapshots;
  private invalidate = () => { this.dirty = true; };
  private disconnect = () => {
    this.connected = false;
    this.lifetime.removeEventListener("abort", this.close);
    this.fields.forEach(({ stop, prepare }) => { prepare(); stop(); });
    this.fields.clear();
  };
  private close = () => {
    this.disconnect();
    this.current = undefined;
    this.publish();
    this.listeners.clear();
  };
  private publish = () => {
    const next = this.getSnapshot();
    if (!Object.is(this.published, next)) {
      this.published = next;
      this.listeners.forEach((listener) => listener());
    }
  };
  /** Explicit non-model inputs, such as the host registration catalog. */
  refresh = () => { this.invalidate(); this.publish(); };
  getSnapshot = (): T | undefined => {
    if (!this.isCurrent()) { return undefined; }
    if (this.connected && !this.dirty) { return this.current; }
    const used = new Set<ModelFieldStore<unknown>>();
    const read: ModelFieldRead = (model, key) => {
      const field = this.models.field(model, key);
      used.add(field);
      return field.getState();
    };
    const next = this.select(read);
    if (this.current === undefined || !this.equals(this.current, next)) { this.current = next; }
    if (this.connected) {
      for (const field of used) {
        if (!this.fields.has(field)) {
          this.fields.set(field, {
            prepare: this.models.subscribePreparedField(field, this.invalidate),
            stop: field.subscribe(this.publish),
          });
        }
      }
      for (const [field, binding] of this.fields) {
        if (!used.has(field)) { binding.prepare(); binding.stop(); this.fields.delete(field); }
      }
    }
    this.dirty = false;
    return this.current;
  };
  subscribe = (listener: () => void): (() => void) => {
    if (!this.isCurrent()) { return () => undefined; }
    this.listeners.add(listener);
    if (!this.connected) {
      this.connected = true;
      this.dirty = true;
      this.lifetime.addEventListener("abort", this.close, { once: true });
      this.publish();
    }
    return () => {
      this.listeners.delete(listener);
      if (!this.listeners.size) { this.disconnect(); }
    };
  };
}
