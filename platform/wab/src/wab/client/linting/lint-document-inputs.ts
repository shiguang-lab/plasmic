import { isKnownArenaFrame } from "@/wab/shared/model/classes";
import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";

let nextLintOwner = 0;

/** The visible issues panel queries the whole document, scoped to one Studio.
 * Its completed-commit subscription is released when the panel/world leaves. */
export class LintDocumentInputs {
  readonly key = ++nextLintOwner;
  private readonly models;
  private readonly site;
  private readonly lifetime;
  private version = 0;
  private closed = false;
  private readonly listeners = new Set<() => void>();
  private stop: (() => void) | undefined;
  constructor(private readonly studio: StudioCtx) {
    this.models = studio.modelSnapshots; this.site = studio.site; this.lifetime = studio.arenaState.lifetime();
  }
  isCurrent = () => !this.closed && !this.lifetime.aborted && this.models === this.studio.modelSnapshots && this.site === this.studio.site;
  getSnapshot = () => this.isCurrent() ? this.version : -1;
  private disconnect = () => {
    this.stop?.(); this.stop = undefined;
    this.lifetime.removeEventListener("abort", this.close);
  };
  private close = () => {
    if (this.closed) {return;} this.closed = true; this.disconnect();
    this.listeners.forEach((listener) => listener());
  };
  subscribe = (listener: () => void) => {
    if (!this.isCurrent()) {return () => undefined;}
    this.listeners.add(listener);
    if (!this.stop) {
      this.stop = this.studio.subscribeModelChanges((event) => {
        if (!this.isCurrent()) {this.close(); return;}
        if (event.type === "site-replaced" || event.summary.changes.some(({ changeNode: { inst, field } }) =>
          !(isKnownArenaFrame(inst) && (field === "left" || field === "top")))) {
          this.version++; this.listeners.forEach((changed) => changed());
        }
      });
      this.lifetime.addEventListener("abort", this.close, {once: true});
      // Refresh a query rendered before its first subscription was installed.
      this.version++; listener();
    }
    return () => {this.listeners.delete(listener); if (!this.listeners.size) {this.disconnect();}};
  };
}
