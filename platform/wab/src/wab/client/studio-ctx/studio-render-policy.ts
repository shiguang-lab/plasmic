import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import type { ModelFieldStore } from "@/wab/client/studio-ctx/model-snapshots";
import { shallow } from "zustand/shallow";
import { useStore } from "zustand";
import { createStore } from "zustand/vanilla";

export interface StudioRenderPolicySnapshot {
  readonly interactive: boolean;
  readonly autoOpen: boolean;
  readonly docs: boolean;
  readonly devMode: boolean;
  readonly showSlotPlaceholder: boolean;
  readonly showContainerPlaceholder: boolean;
  readonly fullPageHeight: boolean;
}

export interface RenderPolicyInputs {
  readonly draggingOverride?: boolean;
  readonly liveOverride?: boolean;
}

const inactivePolicy: StudioRenderPolicySnapshot = Object.freeze({
  interactive: false, autoOpen: true, docs: false, devMode: true,
  showSlotPlaceholder: true, showContainerPlaceholder: true, fullPageHeight: false,
});
const emptyPolicy = createStore(() => inactivePolicy);

/** One Studio's canvas preferences. Live mode and dragging retain their own
 * canonical owners; only the effective display decisions are captured here. */
export class StudioRenderPolicy {
  private interactiveValue = false;
  private autoOpenPreference = true;
  private docsValue = false;
  private slotPlaceholder = true;
  private containerPlaceholder = true;
  private storedFullPageHeight = false;
  private fullPageHeightOverride: boolean | undefined;
  private current = inactivePolicy;
  private readonly state = createStore(() => this.current);
  private readonly initial: StudioRenderPolicySnapshot;
  private readonly subscriptions = new Set<() => void>();
  private readonly publications = new Set<() => void>();
  private publicationDepth = 0;
  private disposed = false;

  readonly store: ModelFieldStore<StudioRenderPolicySnapshot> = {
    getState: () => this.current,
    getInitialState: () => this.initial,
    subscribe: (listener) => {
      if (this.disposed) { return () => undefined; }
      const unsubscribe = this.state.subscribe(listener);
      const stop = () => { unsubscribe(); this.subscriptions.delete(stop); };
      this.subscriptions.add(stop);
      return stop;
    },
  };

  constructor(private readonly source: {
    readonly isLive: () => boolean;
    readonly isDragging: () => boolean;
  }) {
    this.prepareInputs();
    this.initial = this.current;
    this.state.setState(this.current, true);
  }

  get interactive() { return this.interactiveValue; }
  set interactive(value: boolean) { this.interactiveValue = value; }
  get autoOpen() { return this.autoOpenPreference && !this.source.isDragging(); }
  set autoOpen(value: boolean) { this.autoOpenPreference = value; }
  get docs() { return this.docsValue; }
  set docs(value: boolean) { this.docsValue = value; }
  get devMode() { return !this.source.isLive() && !this.docsValue; }
  get showSlotPlaceholder() { return this.slotPlaceholder; }
  toggleSlotPlaceholder() { this.slotPlaceholder = !this.slotPlaceholder; }
  get showContainerPlaceholder() { return this.containerPlaceholder; }
  toggleContainerPlaceholder() { this.containerPlaceholder = !this.containerPlaceholder; }
  get fullPageHeight() { return this.fullPageHeightOverride ?? this.storedFullPageHeight; }
  installStoredFullPageHeight(value: boolean) { this.storedFullPageHeight = value; }
  toggleFullPageHeight() {
    const next = !this.fullPageHeight;
    this.fullPageHeightOverride = undefined;
    this.storedFullPageHeight = next;
    return next;
  }
  setFullPageHeightOverride(value: boolean) {
    this.fullPageHeightOverride = value === this.storedFullPageHeight ? undefined : value;
  }

  /** Install final inputs before preparing per-view FrameInfo and node caches.
   * Overrides describe the existing native source's imminent synchronous write. */
  prepareInputs(input: RenderPolicyInputs = {}): StudioRenderPolicySnapshot {
    if (this.disposed) { return this.current; }
    const next = Object.freeze({
      interactive: this.interactiveValue,
      autoOpen: this.autoOpenPreference && !(input.draggingOverride ?? this.source.isDragging()),
      docs: this.docsValue,
      devMode: !(input.liveOverride ?? this.source.isLive()) && !this.docsValue,
      showSlotPlaceholder: this.slotPlaceholder,
      showContainerPlaceholder: this.containerPlaceholder,
      fullPageHeight: this.fullPageHeight,
    });
    const published = this.state.getState();
    this.current = shallow(published, next) ? published : shallow(this.current, next) ? this.current : next;
    return this.current;
  }

  queuePublication(publish: () => void) {
    if (!this.disposed) { this.publications.add(publish); }
  }

  /** Hold notifications only around an actual synchronous editor command. */
  deferPublication<Result>(command: () => Result): Result {
    this.publicationDepth++;
    try { return command(); }
    finally { this.publicationDepth--; this.publishCommit(); }
  }

  publishCommit() {
    if (this.disposed || this.publicationDepth) { return; }
    const publications = [...this.publications];
    this.publications.clear();
    if (this.state.getState() !== this.current) { this.state.setState(this.current, true); }
    publications.forEach((publish) => publish());
  }

  dispose() {
    if (this.disposed) { return; }
    this.disposed = true;
    this.publications.clear();
    this.subscriptions.forEach((stop) => stop());
    this.subscriptions.clear();
  }
}

export function useStudioRenderPolicy<Selected>(
  studio: StudioCtx | undefined,
  selector: (state: StudioRenderPolicySnapshot) => Selected,
): Selected {
  return useStore(studio ? studio.renderPolicy.store : emptyPolicy, selector);
}

export function subscribeStudioRenderPolicy<Selected>(
  studio: StudioCtx,
  select: (state: StudioRenderPolicySnapshot) => Selected,
  listener: (next: Selected, previous: Selected) => void,
) {
  let previous = select(studio.renderPolicy.store.getState());
  return studio.renderPolicy.store.subscribe((state) => {
    const next = select(state);
    if (!Object.is(next, previous)) {
      const before = previous;
      previous = next;
      listener(next, before);
    }
  });
}
