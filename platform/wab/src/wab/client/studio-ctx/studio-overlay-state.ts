import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import type { ModelFieldStore } from "@/wab/client/studio-ctx/model-snapshots";
import { shallow } from "zustand/shallow";
import { useStore } from "zustand";
import { createStore } from "zustand/vanilla";

export interface StudioOverlaySnapshot {
  readonly commentsOverlay: boolean;
  readonly multiplayerSelections: boolean;
  readonly ancestorsHoverBoxes: boolean;
  readonly screenshotting: boolean;
  readonly resizeDragging: boolean;
  /** Variants switcher drawer, toggled from the variants bar. */
  readonly variantsDrawer: boolean;
  /** Comments panel visibility in the right pane. */
  readonly commentsPanel: boolean;
}

const initialOverlay: StudioOverlaySnapshot = Object.freeze({
  commentsOverlay: true, multiplayerSelections: true,
  ancestorsHoverBoxes: true, screenshotting: false, resizeDragging: false,
  variantsDrawer: false,
  commentsPanel: false,
});
const emptyOverlay = createStore(() => initialOverlay);

/** Overlay preferences and transient capture/resize state for one Studio.
 * Geometry, render policy, drag payloads and model data retain their owners. */
export class StudioOverlayState {
  private values = initialOverlay;
  private current = initialOverlay;
  private readonly state = createStore(() => initialOverlay);
  private readonly subscriptions = new Set<() => void>();
  private publicationDepth = 0;
  private disposed = false;
  readonly store: ModelFieldStore<StudioOverlaySnapshot> = {
    getState: () => this.current,
    getInitialState: this.state.getInitialState,
    subscribe: (listener) => {
      if (this.disposed) { return () => undefined; }
      const unsubscribe = this.state.subscribe(listener);
      const stop = () => { unsubscribe(); this.subscriptions.delete(stop); };
      this.subscriptions.add(stop);
      return stop;
    },
  };

  private update<Key extends keyof StudioOverlaySnapshot>(key: Key, value: StudioOverlaySnapshot[Key]) {
    if (this.values[key] === value) { return; }
    this.values = Object.freeze({ ...this.values, [key]: value });
    if (this.disposed) { return; }
    const published = this.state.getState();
    this.current = shallow(published, this.values) ? published : this.values;
    this.publishCommit();
  }

  get commentsOverlay() { return this.values.commentsOverlay; }
  set commentsOverlay(value: boolean) { this.update("commentsOverlay", value); }
  get multiplayerSelections() { return this.values.multiplayerSelections; }
  set multiplayerSelections(value: boolean) { this.update("multiplayerSelections", value); }
  get ancestorsHoverBoxes() { return this.values.ancestorsHoverBoxes; }
  set ancestorsHoverBoxes(value: boolean) { this.update("ancestorsHoverBoxes", value); }
  get screenshotting() { return this.values.screenshotting; }
  set screenshotting(value: boolean) { this.update("screenshotting", value); }
  get resizeDragging() { return this.values.resizeDragging; }
  set resizeDragging(value: boolean) { this.update("resizeDragging", value); }
  get variantsDrawer() { return this.values.variantsDrawer; }
  set variantsDrawer(value: boolean) { this.update("variantsDrawer", value); }
  get commentsPanel() { return this.values.commentsPanel; }
  set commentsPanel(value: boolean) { this.update("commentsPanel", value); }

  /** Reuse a real synchronous editor command; never retain this across I/O. */
  deferPublication<Result>(command: () => Result): Result {
    this.publicationDepth++;
    try { return command(); }
    finally { this.publicationDepth--; this.publishCommit(); }
  }

  private publishCommit() {
    if (!this.disposed && !this.publicationDepth && this.state.getState() !== this.current) {
      this.state.setState(this.current, true);
    }
  }

  dispose() {
    if (this.disposed) { return; }
    this.disposed = true;
    this.subscriptions.forEach((stop) => stop());
    this.subscriptions.clear();
  }
}

export function useStudioOverlayState<Selected>(
  studio: StudioCtx | undefined,
  selector: (state: StudioOverlaySnapshot) => Selected,
): Selected {
  return useStore(studio ? studio.overlayState.store : emptyOverlay, selector);
}

export function subscribeStudioOverlayState<Selected>(
  studio: StudioCtx,
  select: (state: StudioOverlaySnapshot) => Selected,
  listener: (next: Selected, previous: Selected) => void,
) {
  let previous = select(studio.overlayState.store.getState());
  return studio.overlayState.store.subscribe((state) => {
    const next = select(state);
    if (!Object.is(next, previous)) {
      const before = previous;
      previous = next;
      listener(next, before);
    }
  });
}
