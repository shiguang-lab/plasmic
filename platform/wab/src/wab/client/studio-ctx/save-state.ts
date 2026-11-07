import type { AlertData } from "@/wab/client/components/widgets/plasmic/AlertBanner";
import { AlertSpec } from "@/wab/client/components/widgets/plasmic/AlertBanner";
import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import type { ModelFieldStore } from "@/wab/client/studio-ctx/model-snapshots";
import { shallow } from "zustand/shallow";
import { useStore } from "zustand";
import { createStore } from "zustand/vanilla";

export interface StudioSaveSnapshot {
  readonly saveStatus: "unlogged" | "saving" | "error" | "blocked" | "pending" | "saved";
  readonly hasUnsavedChanges: boolean;
  readonly canSave: boolean;
  readonly canEditBranch: boolean;
  readonly isAtTip: boolean;
  readonly editMode: boolean;
  readonly blockChanges: boolean;
  readonly isUnlogged: boolean;
  readonly changeCounter: number;
  readonly banner: Readonly<{
    stateVariant: AlertData["stateVariant"];
    hasAction: boolean;
    isConcurrentEdit: boolean;
  }> | null;
}

/** Canonical save metadata for one Studio lifetime. Model and I/O payloads stay
 * with their command owners; only immutable display inputs are published. */
export class StudioSaveState {
  private changeCounter = 0;
  private savedCounter = 0;
  private unlogged = false;
  private saving = false;
  private error: "normal" | "error" = "normal";
  private tip = true;
  private blocked = false;
  private editing = true;
  private projectEditable = true;
  private branchEditable = true;
  private alert: AlertData | null = null;
  private onTipLost: (() => void) | undefined;
  private publicationDepth = 0;
  private disposed = false;
  private readonly subscriptions = new Set<() => void>();
  private snapshot = this.capture();
  private readonly state = createStore(() => this.snapshot);
  readonly store: ModelFieldStore<StudioSaveSnapshot> = {
    getState: () => this.snapshot,
    getInitialState: this.state.getInitialState,
    subscribe: (listener) => {
      if (this.disposed) { return () => undefined; }
      const stop = this.state.subscribe(listener);
      const unsubscribe = () => { stop(); this.subscriptions.delete(unsubscribe); };
      this.subscriptions.add(unsubscribe);
      return unsubscribe;
    },
  };

  get hasUnsavedChanges() { return this.changeCounter > this.savedCounter; }
  get canSave() { return this.tip && this.projectEditable && this.branchEditable; }
  get saveStatus(): StudioSaveSnapshot["saveStatus"] {
    return this.unlogged ? "unlogged" : this.saving ? "saving" : this.error === "error" ? "error" : this.hasUnsavedChanges && !this.canSave ? "blocked" : this.hasUnsavedChanges ? "pending" : "saved";
  }

  private capture(): StudioSaveSnapshot {
    const hasUnsavedChanges = this.hasUnsavedChanges;
    const canSave = this.canSave;
    return Object.freeze({
      saveStatus: this.saveStatus,
      hasUnsavedChanges, canSave, canEditBranch: this.branchEditable,
      isAtTip: this.tip, editMode: this.editing, blockChanges: this.blocked,
      isUnlogged: this.unlogged, changeCounter: this.changeCounter,
      banner: this.alert ? Object.freeze({ stateVariant: this.alert.stateVariant, hasAction: !!this.alert.actionFn, isConcurrentEdit: this.alert === AlertSpec.ConcurrentEdit }) : null,
    });
  }

  private install() {
    if (this.disposed) { return; }
    const next = this.capture();
    const published = this.state.getState();
    const banner = shallow(published.banner, next.banner) ? published.banner : shallow(this.snapshot.banner, next.banner) ? this.snapshot.banner : next.banner;
    const shared = Object.freeze({ ...next, banner });
    this.snapshot = shallow(published, shared) ? published : shallow(this.snapshot, shared) ? this.snapshot : shared;
    if (!this.publicationDepth && published !== this.snapshot) { this.state.setState(this.snapshot, true); }
  }

  deferPublication<Result>(command: () => Result): Result {
    this.publicationDepth++;
    try { return command(); }
    finally { this.publicationDepth--; this.install(); }
  }

  /** Permission inputs have their own overwrite policy, independent of tip. */
  syncAccess(projectEditable: boolean, branchEditable: boolean, applyBlockPolicy: boolean) {
    this.projectEditable = projectEditable;
    this.branchEditable = branchEditable;
    if (applyBlockPolicy) { this.blocked = !(projectEditable && branchEditable); }
    this.install();
  }

  bindTipEffects(onTipLost: () => void) {
    this.onTipLost = onTipLost;
    if (!this.tip) { this.applyTipEffects(); }
  }
  private applyTipEffects() {
    if (!this.tip) {
      this.blocked = true;
      this.install();
      this.onTipLost?.();
    }
  }
  get counter() { return this.changeCounter; }
  set counter(value: number) { this.changeCounter = value; this.install(); }
  get savedChangeCounter() { return this.savedCounter; }
  set savedChangeCounter(value: number) { this.savedCounter = value; this.install(); }
  get isUnlogged() { return this.unlogged; }
  set isUnlogged(value: boolean) { this.unlogged = value; this.install(); }
  get isSaving() { return this.saving; }
  set isSaving(value: boolean) { this.saving = value; this.install(); }
  get saveErrorState() { return this.error; }
  set saveErrorState(value: "normal" | "error") { this.error = value; this.install(); }
  get isAtTip() { return this.tip; }
  set isAtTip(value: boolean) {
    if (this.tip === value) { return; }
    this.deferPublication(() => { this.tip = value; this.applyTipEffects(); this.install(); });
  }
  get blockChanges() { return this.blocked; }
  set blockChanges(value: boolean) { this.blocked = value; this.install(); }
  get editMode() { return this.editing; }
  set editMode(value: boolean) { this.editing = value; }
  getAlert() { return this.alert; }
  setAlert(value: AlertData | null) {
    if (this.alert === value) { return; }
    this.deferPublication(() => { this.alert = value; this.applyTipEffects(); this.install(); });
  }
  dispose() {
    if (this.disposed) { return; }
    this.disposed = true;
    this.onTipLost = undefined;
    this.subscriptions.forEach((stop) => stop());
    this.subscriptions.clear();
  }
}

export function useStudioSaveState<Selected>(studio: StudioCtx, selector: (state: StudioSaveSnapshot) => Selected): Selected {
  return useStore(studio.saveState.store, selector);
}
