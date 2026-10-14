/** Startup-only timings; overlapping durations must not be added together. */
export class StudioLoadTimings {
  private startedAt = performance.now();
  private entries = new Map<
    string,
    {
      phase: string;
      frameUuid?: string;
      startMs: number;
      durationMs: number;
    }
  >();
  private initialFrames = new Set<string>();

  setInitialFrames(frameUuids: string[]) {
    this.initialFrames = new Set(frameUuids);
  }

  begin(phase: string, frameUuid?: string): () => void {
    const start = performance.now();
    return () => {
      const key = `${phase}:${frameUuid ?? ""}`;
      if (
        this.entries.has(key) ||
        (frameUuid && !this.initialFrames.has(frameUuid))
      ) {
        return;
      }
      this.entries.set(key, {
        phase,
        frameUuid,
        startMs: start - this.startedAt,
        durationMs: performance.now() - start,
      });
    };
  }

  mark(phase: string, frameUuid?: string) {
    const key = `${phase}:${frameUuid ?? ""}`;
    if (
      this.entries.has(key) ||
      (frameUuid && !this.initialFrames.has(frameUuid))
    ) {
      return;
    }
    this.entries.set(key, {
      phase,
      frameUuid,
      startMs: performance.now() - this.startedAt,
      durationMs: 0,
    });
  }

  has(phase: string, frameUuid?: string) {
    return this.entries.has(`${phase}:${frameUuid ?? ""}`);
  }

  snapshot() {
    return {
      elapsedMs: performance.now() - this.startedAt,
      frameCount: this.initialFrames.size,
      entries: [...this.entries.values()].map((entry) => ({ ...entry })),
    };
  }

  report(
    phase:
      "canvas-revealed" | "all-frame-contexts-created" | "all-frames-rendered",
  ) {
    if (this.has(phase)) {
      return;
    }
    this.mark(phase);
    console.info(`[Studio load] ${phase}`, this.snapshot());
  }
}
