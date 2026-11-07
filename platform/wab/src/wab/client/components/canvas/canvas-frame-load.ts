/** One mounted iframe generation owns its pending queue promise and resources.
 * The Arena owner invalidates its lifetime before releasing the old model world. */
export class CanvasFrameLoad {
  private cancelled = false;
  private readonly resources = new Set<() => void>();
  private resolveLoad: (() => void) | undefined;
  private rejectLoad: ((error: unknown) => void) | undefined;
  private readonly onAbort = () => this.cancel();

  constructor(private readonly signal: AbortSignal, private readonly isCurrent: () => boolean) {
    signal.addEventListener("abort", this.onAbort, { once: true });
    if (signal.aborted) { this.cancel(); }
  }

  isActive() { return !this.cancelled && !this.signal.aborted && this.isCurrent(); }

  begin(resolve: () => void, reject: (error: unknown) => void) {
    if (!this.isActive()) { resolve(); return false; }
    this.resolveLoad = resolve;
    this.rejectLoad = reject;
    return true;
  }

  own(dispose: () => void) {
    if (!this.isActive()) { dispose(); return () => undefined; }
    this.resources.add(dispose);
    return () => { this.resources.delete(dispose); };
  }

  complete() {
    const resolve = this.resolveLoad;
    this.resolveLoad = undefined;
    this.rejectLoad = undefined;
    resolve?.();
  }

  fail(error: unknown) {
    if (!this.isActive()) { return; }
    const reject = this.rejectLoad;
    this.resolveLoad = undefined;
    this.rejectLoad = undefined;
    reject?.(error);
    this.cancel();
  }

  cancel() {
    if (this.cancelled) { return; }
    this.cancelled = true;
    this.signal.removeEventListener("abort", this.onAbort);
    try {
      // Event listeners registered after the context must detach before it.
      for (const dispose of [...this.resources].reverse()) { dispose(); }
    } finally {
      this.resources.clear();
      this.complete();
    }
  }
}
