import { assert, ensure } from "@/wab/shared/common";
import type { ModelChange } from "@/wab/shared/core/observable-model";
import { instUtil } from "@/wab/shared/model/InstUtil";
import type { ObjInst } from "@/wab/shared/model/classes";
import { isPlainObject } from "lodash";
import type { StoreApi } from "zustand/vanilla";
import { createStore } from "zustand/vanilla";

declare const modelType: unique symbol;

/** An immutable identity, never a mutable model masquerading as UI data. */
export interface ModelRef<T extends ObjInst = ObjInst> {
  readonly uid: number;
  readonly type: string;
  readonly [modelType]?: T;
}

export type ModelSnapshot<T> = T extends ObjInst
  ? ModelRef<T>
  : T extends (...args: any[]) => any
    ? T
    : T extends readonly (infer Item)[]
      ? readonly ModelSnapshot<Item>[]
      : T extends object
        ? { readonly [Key in keyof T]: ModelSnapshot<T[Key]> }
        : T;

export type ModelFieldStore<T> = Pick<
  StoreApi<T>,
  "getState" | "getInitialState" | "subscribe"
>;

interface FieldResource {
  current: unknown;
  readonly store: ModelFieldStore<unknown>;
  prepare(): void;
  publish(): void;
}

/**
 * One Studio's demanded model fields. Command models retain their identities;
 * UI collections contain immutable references with separately subscribed fields.
 * Publication is explicit and belongs after a successful, fixed-up transaction.
 */
export class ModelSnapshots {
  private readonly fields = new WeakMap<ObjInst, Map<string, FieldResource>>();
  private readonly refs = new WeakMap<ObjInst, ModelRef>();
  private readonly models = new WeakMap<ModelRef, ObjInst>();
  private readonly subscriptions = new Set<() => void>();
  private readonly pendingPublications = new Set<FieldResource>();
  private readonly preparedFields = new WeakMap<ModelFieldStore<unknown>, Set<() => void>>();
  private publicationDepth = 0;
  private disposed = false;

  /** Invalidate declared derived inputs after every field is installed, before
   * completed-commit preparation. These listeners must not publish UI state. */
  subscribePreparedField(field: ModelFieldStore<unknown>, invalidate: () => void): () => void {
    if (this.disposed) {
      return () => undefined;
    }
    const listeners = ensure(this.preparedFields.get(field), "Prepared model field belongs to another owner");
    listeners.add(invalidate);
    const stop = () => {
      listeners.delete(invalidate);
      this.subscriptions.delete(stop);
    };
    this.subscriptions.add(stop);
    return stop;
  }

  /** Hold notifications within a synchronous completed command, never across I/O. */
  deferPublication<Result>(command: () => Result): Result {
    this.publicationDepth++;
    try {
      return command();
    } finally {
      this.publicationDepth--;
      if (!this.publicationDepth) {
        const pending = [...this.pendingPublications];
        this.pendingPublications.clear();
        pending.forEach((resource) => resource.publish());
      }
    }
  }

  field<T extends ObjInst, Key extends Exclude<keyof T, "uid"> & string>(
    model: T,
    key: Key,
  ): ModelFieldStore<ModelSnapshot<T[Key]>> {
    return this.declaredField(model, key) as ModelFieldStore<ModelSnapshot<T[Key]>>;
  }

  /** Runtime schema declarations use the same validated, per-field resource. */
  declaredField(model: ObjInst, key: string): ModelFieldStore<unknown> {
    assert(!this.disposed, "Cannot read fields from a disposed model owner");
    let fields = this.fields.get(model);
    if (!fields) {
      fields = new Map();
      this.fields.set(model, fields);
    }
    let resource = fields.get(key);
    if (!resource) {
      instUtil.meta.getFieldByName(instUtil.getInstClassName(model), key);
      resource = this.createField(this.snapshot(Reflect.get(model, key)));
      fields.set(key, resource);
    }
    return resource.store;
  }

  ref<T extends ObjInst>(model: T): ModelRef<T> {
    assert(!this.disposed, "Cannot reference a disposed model owner");
    let ref = this.refs.get(model);
    if (!ref) {
      ref = Object.freeze({ uid: model.uid, type: instUtil.getInstClassName(model) });
      this.refs.set(model, ref);
      this.models.set(ref, model);
    }
    return ref as ModelRef<T>;
  }

  /** Resolve only for commands or choosing another explicit field subscription. */
  resolve<Ref extends ModelRef>(
    ref: Ref,
  ): Ref extends ModelRef<infer Model> ? Model : never {
    assert(!this.disposed, "Cannot resolve a disposed model owner");
    return ensure(
      this.models.get(ref),
      "Model reference belongs to another owner",
    ) as Ref extends ModelRef<infer Model> ? Model : never;
  }

  sync(changes: readonly ModelChange[], beforePublish?: () => void) {
    if (this.disposed) {
      return;
    }
    const dirty = new Map<ObjInst, Set<string>>();
    for (const {
      changeNode: { inst, field },
    } of changes) {
      if (!this.fields.get(inst)?.has(field)) {
        continue;
      }
      let keys = dirty.get(inst);
      if (!keys) {
        keys = new Set();
        dirty.set(inst, keys);
      }
      keys.add(field);
    }
    const updates: [FieldResource, unknown][] = [];
    for (const [model, keys] of dirty) {
      for (const key of keys) {
        const resource = ensure(
          this.fields.get(model)?.get(key),
          "Missing demanded model field",
        );
        const next = this.snapshot(Reflect.get(model, key), resource.current);
        if (!Object.is(next, resource.current)) {
          updates.push([resource, next]);
        }
      }
    }
    // Install every committed value before notifying even the first subscriber.
    // A subscriber can synchronously read a second field without a torn model.
    for (const [resource, next] of updates) {
      resource.current = next;
    }
    for (const [resource] of updates) {
      resource.prepare();
    }
    // Derived native owners install their matching inputs before field listeners run.
    beforePublish?.();
    for (const [resource] of updates) {
      if (this.publicationDepth) {
        this.pendingPublications.add(resource);
      } else {
        resource.publish();
      }
    }
  }

  dispose() {
    this.disposed = true;
    this.pendingPublications.clear();
    for (const stop of this.subscriptions) {
      stop();
    }
    this.subscriptions.clear();
  }

  private createField(initial: unknown): FieldResource {
    const state = createStore<unknown>(() => initial);
    const prepared = new Set<() => void>();
    const resource: FieldResource = {
      current: initial,
      store: {
        getState: () => resource.current,
        getInitialState: state.getInitialState,
        subscribe: (listener) => {
          if (this.disposed) {
            return () => undefined;
          }
          const unsubscribe = state.subscribe(listener);
          const stop = () => {
            unsubscribe();
            this.subscriptions.delete(stop);
          };
          this.subscriptions.add(stop);
          return stop;
        },
      },
      prepare: () => prepared.forEach((invalidate) => invalidate()),
      publish: () => state.setState(() => resource.current, true),
    };
    this.preparedFields.set(resource.store, prepared);
    return resource;
  }

  private snapshot(value: unknown, previous?: unknown): unknown {
    if (value === null || typeof value !== "object") {
      return value;
    }
    if (instUtil.isObjInst(value)) {
      return this.ref(value);
    }
    if (Array.isArray(value)) {
      const before: readonly unknown[] = Array.isArray(previous)
        ? previous
        : [];
      let equal = Array.isArray(previous) && before.length === value.length;
      const next = value.map((item, index) => {
        const captured = this.snapshot(item, before[index]);
        equal &&= Object.is(captured, before[index]);
        return captured;
      });
      return equal ? previous : Object.freeze(next);
    }
    assert(
      isPlainObject(value),
      "Model snapshots require model references or plain data",
    );
    const source = value as Record<string, unknown>;
    const before = isPlainObject(previous)
      ? (previous as Record<string, unknown>)
      : {};
    const keys = Object.keys(source);
    let equal =
      isPlainObject(previous) && keys.length === Object.keys(before).length;
    const next = Object.fromEntries(
      keys.map((key) => {
        const captured = this.snapshot(source[key], before[key]);
        equal &&=
          Object.hasOwn(before, key) && Object.is(captured, before[key]);
        return [key, captured];
      }),
    );
    return equal ? previous : Object.freeze(next);
  }
}
