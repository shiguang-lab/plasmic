import { ModelFieldStore } from "@/wab/client/studio-ctx/model-snapshots";
import { isEqual } from "lodash";
import { createStore, StoreApi } from "zustand/vanilla";

/** Runtime context inputs are isolated by frame and component instance.
 * Command handles retain their runtime identities; Inspector owns UI projections.
 */
export class FrameContextData {
  private readonly entries = new Map<string, {
    readonly state: StoreApi<unknown>;
    readonly store: ModelFieldStore<unknown>;
  }>();
  private readonly subscriptions = new Set<() => void>();
  private disposed = false;

  getStore(key: string): ModelFieldStore<unknown> {
    let entry = this.entries.get(key);
    if (!entry) {
      const state = createStore<unknown>(() => undefined);
      entry = {
        state,
        store: {
          getState: state.getState,
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
      };
      this.entries.set(key, entry);
    }
    return entry.store;
  }

  set(key: string, value: unknown) {
    if (this.disposed || isEqual(this.getStore(key).getState(), value)) {
      return;
    }
    this.entries.get(key)?.state.setState(() => value, true);
  }

  dispose() {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.entries.forEach(({ state }) => state.setState(() => undefined, true));
    this.subscriptions.forEach((stop) => stop());
    this.subscriptions.clear();
    this.entries.clear();
  }
}
