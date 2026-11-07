import type { ModelFieldStore } from "@/wab/client/studio-ctx/model-snapshots";
import { toVarName } from "@/wab/shared/codegen/util";
import { arrayEq, assert, ensure, objsEq } from "@/wab/shared/common";
import { ValComponent } from "@/wab/shared/core/val-nodes";
import { hasVariant } from "@plasmicapp/react-web";
import { createStore, StoreApi } from "zustand/vanilla";

export interface FrameVariantSnapshot {
  readonly flags: Readonly<Partial<Record<number, boolean>>>;
  readonly owners: readonly Readonly<{ tplUid: number; key: string; fullKey: string }>[];
  readonly firstChild: Readonly<{ component: boolean; tplUid: number; key: string; fullKey: string }> | undefined;
}
interface VariantResource {
  current: FrameVariantSnapshot | undefined;
  readonly state: StoreApi<FrameVariantSnapshot | undefined>;
  readonly store: ModelFieldStore<FrameVariantSnapshot | undefined>;
  readonly stops: Set<() => void>;
}

function equivalent(a: FrameVariantSnapshot | undefined, b: FrameVariantSnapshot | undefined) {
  return a === b || !!a && !!b && objsEq(a.flags, b.flags) &&
    arrayEq(a.owners, b.owners, (left, right) => objsEq(left, right)) &&
    (a.firstChild === b.firstChild || !!a.firstChild && !!b.firstChild && objsEq(a.firstChild, b.firstChild));
}

function sameOwners(a: FrameVariantSnapshot["owners"], b: FrameVariantSnapshot["owners"]) {
  return arrayEq(a, b, (left, right) => objsEq(left, right));
}

/** Demanded variant and ownership inputs from committed Fibers, keyed by fullKey. */
export class FrameVariantInputs {
  private readonly resources = new Map<string, VariantResource>();
  private readonly pending = new Set<VariantResource>();
  private disposed = false;
  private dirty = false;

  constructor(private readValue: ((fullKey: string) => ValComponent | undefined) | undefined) {}

  /** A changed branch can also change an unchanged descendant's owner path. */
  invalidate() { this.dirty = true; }

  prepareCommit() {
    if (!this.disposed && this.dirty) {
      this.dirty = false;
      this.resources.forEach((_resource, fullKey) => this.prepareCurrent(fullKey));
    }
  }

  getStore(fullKey: string) {
    assert(!this.disposed, "Cannot read a disposed frame's variant inputs");
    let resource = this.resources.get(fullKey);
    if (!resource) {
      const state = createStore<FrameVariantSnapshot | undefined>(() => undefined);
      const stops = new Set<() => void>();
      const created: VariantResource = {
        current: undefined, state, stops,
        store: {
          getState: () => created.current,
          getInitialState: () => created.current,
          subscribe: (listener) => {
            if (this.disposed) { return () => undefined; }
            const stopState = state.subscribe(listener);
            const stop = () => { stopState(); stops.delete(stop); };
            stops.add(stop);
            return stop;
          },
        },
      };
      resource = created;
      this.resources.set(fullKey, resource);
      this.prepareCurrent(fullKey);
      state.setState(() => created.current, true);
      this.pending.delete(created);
    }
    return resource.store;
  }

  /** Also called for model-only variant renames before Canvas derives pin inputs. */
  prepareCurrent(fullKey: string) {
    if (this.disposed || !this.resources.has(fullKey)) { return; }
    const value = ensure(this.readValue, "Live frame variant inputs need a runtime reader")(fullKey);
    this.prepare(fullKey, value);
  }

  private prepare(fullKey: string, value: ValComponent | undefined) {
    const resource = ensure(this.resources.get(fullKey), "Variant input must be demanded before preparation");
    let next: FrameVariantSnapshot | undefined;
    if (value) {
      const flags: Partial<Record<number, boolean>> = {};
      for (const group of value.tpl.component.variantGroups) {
        const groupName = toVarName(group.param.variable.name);
        const props = ensure(value.fibers[0], "Committed variant input needs its component Fiber").memoizedProps;
        const variants = { [groupName]: props?.variants?.[groupName] ?? props?.[groupName] };
        for (const variant of group.variants) {
          flags[variant.uid] = hasVariant(variants, groupName, toVarName(variant.name));
        }
      }
      const owners: FrameVariantSnapshot["owners"][number][] = [];
      let owner: ValComponent | undefined = value;
      while (owner) {
        owners.push(Object.freeze({ tplUid: owner.tpl.uid, key: owner.key, fullKey: owner.fullKey }));
        owner = owner.valOwner ?? undefined;
      }
      const previous = resource.current, published = resource.state.getState();
      const stableFlags = previous && objsEq(previous.flags, flags) ? previous.flags
        : published && objsEq(published.flags, flags) ? published.flags : Object.freeze(flags);
      const stableOwners = previous && sameOwners(previous.owners, owners) ? previous.owners
        : published && sameOwners(published.owners, owners) ? published.owners : Object.freeze(owners);
      const child = value.contents?.[0];
      const childValue = child ? Object.freeze({ component: child instanceof ValComponent, tplUid: child.tpl.uid, key: child.key, fullKey: child.fullKey }) : undefined;
      const firstChild = childValue && previous?.firstChild && objsEq(childValue, previous.firstChild) ? previous.firstChild
        : childValue && published?.firstChild && objsEq(childValue, published.firstChild) ? published.firstChild : childValue;
      next = Object.freeze({ flags: stableFlags, owners: stableOwners, firstChild });
    }
    if (equivalent(resource.current, next)) { return; }
    const published = resource.state.getState();
    // Alternates can unregister/re-register the same key during one commit.
    resource.current = equivalent(published, next) ? published : next;
    this.pending.add(resource);
  }

  /** Called once after all changed Fiber branches have installed their values. */
  publishCommit() {
    if (this.disposed) { return; }
    const pending = [...this.pending]; this.pending.clear();
    pending.forEach((resource) => resource.state.setState(() => resource.current, true));
  }

  dispose() {
    this.disposed = true;
    this.readValue = undefined;
    this.resources.forEach((resource) => {
      resource.stops.forEach((stop) => stop()); resource.stops.clear();
      resource.current = undefined; resource.state.setState(() => undefined, true);
    });
    this.resources.clear(); this.pending.clear();
  }
}
