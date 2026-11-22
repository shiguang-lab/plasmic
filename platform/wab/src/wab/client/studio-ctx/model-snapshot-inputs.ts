import type {
  ModelFieldStore,
  ModelRef,
  ModelSnapshot,
  ModelSnapshots,
} from "@/wab/client/studio-ctx/model-snapshots";
import { instUtil } from "@/wab/shared/model/InstUtil";
import type { ObjInst, Site } from "@/wab/shared/model/classes";

export interface ModelWorldOwner {
  readonly modelSnapshots: ModelSnapshots;
  readonly site: Site;
}

/**
 * Base reactive input lease over `ModelSnapshots` with automatic field demand tracking,
 * idle unbinding, and model-world disposal.
 */
export abstract class ModelSnapshotInputs<Value> {
  private readonly fields = new Map<
    ModelFieldStore<unknown>,
    { value: unknown; prepared?: () => void; published?: () => void }
  >();
  private readonly listeners = new Set<() => void>();
  private used: Set<ModelFieldStore<unknown>> | undefined;
  private connected = false;
  private closed = false;
  private dirty = true;
  private current: Value;
  private published: Value;

  constructor(
    private readonly owner: ModelWorldOwner,
    protected readonly models: ModelSnapshots,
    protected readonly site: Site,
    private readonly lifetime: AbortSignal,
    private readonly empty: Value,
  ) {
    this.current = empty;
    this.published = empty;
  }

  protected isClosed() {
    return (
      this.closed ||
      this.lifetime.aborted ||
      this.owner.modelSnapshots !== this.models ||
      this.owner.site !== this.site
    );
  }

  protected read<
    T extends ObjInst,
    Key extends Exclude<keyof T, "uid"> & string,
  >(model: T, key: Key): ModelSnapshot<T[Key]> {
    return this.demand<ModelSnapshot<T[Key]>>(
      this.models.field<T, Key>(model, key),
    );
  }

  protected readDeclared(model: ObjInst, key: string): unknown {
    return this.demand(this.models.declaredField(model, key));
  }

  private demand<FieldValue>(store: ModelFieldStore<FieldValue>): FieldValue {
    let binding = this.fields.get(store);
    if (!binding) {
      binding = { value: store.getState() };
      this.fields.set(store, binding);
    }
    binding.value = store.getState();
    this.used?.add(store);
    if (this.connected && !binding.prepared) {
      binding.prepared = this.models.subscribePreparedField(
        store,
        this.invalidate,
      );
      binding.published = store.subscribe(this.publish);
    }
    return store.getState();
  }

  protected snapshotVersion(root: ObjInst): string {
    const expressionFields: unknown[] = [];
    const visited = new Set<ObjInst>();
    const visit = (value: unknown) => {
      if (instUtil.isObjInst(value)) {
        if (visited.has(value)) {
          return;
        }
        visited.add(value);
        for (const field of instUtil.allInstFields(value)) {
          expressionFields.push([
            value.uid,
            field.name,
            this.readDeclared(value, field.name),
          ]);
          if (!field.annotations.includes("WeakRef")) {
            visit(Reflect.get(value, field.name));
          }
        }
      } else if (Array.isArray(value)) {
        value.forEach(visit);
      } else if (value && typeof value === "object") {
        Object.values(value).forEach(visit);
      }
    };
    visit(root);
    return JSON.stringify(expressionFields);
  }

  protected abstract capture(previous: Value): Value;

  private invalidate = () => {
    this.dirty = true;
  };

  private disconnect = () => {
    this.connected = false;
    this.lifetime.removeEventListener("abort", this.close);
    for (const binding of this.fields.values()) {
      binding.prepared?.();
      binding.published?.();
      binding.prepared = undefined;
      binding.published = undefined;
    }
  };

  private close = () => {
    if (this.closed) {
      return;
    }
    this.closed = true;
    this.disconnect();
    this.fields.clear();
    this.current = this.empty;
    this.publishSnapshot();
    this.listeners.clear();
  };

  private publishSnapshot() {
    if (this.current === this.published) {
      return;
    }
    this.published = this.current;
    this.listeners.forEach((listener) => listener());
  }

  private publish = () => {
    this.getSnapshot();
    this.publishSnapshot();
  };

  getSnapshot = (): Value => {
    if (this.isClosed()) {
      this.close();
      return this.current;
    }
    if (
      !this.connected &&
      [...this.fields].some(
        ([store, binding]) => store.getState() !== binding.value,
      )
    ) {
      this.dirty = true;
    }
    if (!this.dirty) {
      return this.current;
    }
    const used = new Set<ModelFieldStore<unknown>>();
    this.used = used;
    try {
      this.current = this.capture(this.current);
    } finally {
      this.used = undefined;
    }
    for (const [store, binding] of this.fields) {
      if (!used.has(store)) {
        binding.prepared?.();
        binding.published?.();
        this.fields.delete(store);
      }
    }
    this.dirty = false;
    return this.current;
  };

  subscribe = (listener: () => void): (() => void) => {
    if (this.isClosed()) {
      this.close();
      return () => undefined;
    }
    if (!this.listeners.size) {
      this.published = this.getSnapshot();
    }
    this.listeners.add(listener);
    if (!this.connected) {
      this.connected = true;
      this.lifetime.addEventListener("abort", this.close, { once: true });
      this.dirty = true;
      try {
        this.getSnapshot();
      } catch (error) {
        this.listeners.delete(listener);
        this.disconnect();
        throw error;
      }
    }
    let stopped = false;
    return () => {
      if (stopped) {
        return;
      }
      stopped = true;
      this.listeners.delete(listener);
      if (!this.listeners.size) {
        this.disconnect();
      }
    };
  };

  resolve<Ref extends ModelRef>(ref: Ref) {
    return this.models.resolve(ref);
  }
}
