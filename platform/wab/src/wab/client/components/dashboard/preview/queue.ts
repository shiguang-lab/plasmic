/** One renderer per tab. Subscribers share a job; losing the last one cancels it. */
export class PreviewQueue {
  private jobs = new Map<
    string,
    {
      controller: AbortController;
      run: (signal: AbortSignal) => Promise<Blob>;
      listeners: Set<(blob?: Blob) => void>;
      starts: Set<() => void>;
      started: boolean;
    }
  >();
  private running = false;

  subscribe(
    key: string,
    run: (signal: AbortSignal) => Promise<Blob>,
    listener: (blob?: Blob) => void,
    /** Called once the job leaves the queue and begins generating. */
    onStart?: () => void,
  ) {
    let job = this.jobs.get(key);
    if (!job) {
      job = {
        controller: new AbortController(),
        run,
        listeners: new Set(),
        starts: new Set(),
        started: false,
      };
      this.jobs.set(key, job);
    }
    job.listeners.add(listener);
    if (onStart) {
      if (job.started) {
        onStart();
      } else {
        job.starts.add(onStart);
      }
    }
    void this.drain();
    const subscribed = job;
    return () => {
      subscribed.listeners.delete(listener);
      if (onStart) {
        subscribed.starts.delete(onStart);
      }
      if (!subscribed.listeners.size) {
        subscribed.controller.abort();
        // Keep active work in the serial drain until its teardown finishes.
        if (this.jobs.get(key) === subscribed) {
          this.jobs.delete(key);
        }
      }
    };
  }

  private async drain() {
    if (this.running) {
      return;
    }
    this.running = true;
    try {
      while (this.jobs.size) {
        const [key, job] = this.jobs.entries().next().value as [
          string,
          NonNullable<ReturnType<typeof this.jobs.get>>,
        ];
        let blob: Blob | undefined;
        job.started = true;
        for (const start of job.starts) {
          start();
        }
        job.starts.clear();
        try {
          blob = await job.run(job.controller.signal);
        } catch {
          /* A failed preview leaves the card usable. */
        }
        if (this.jobs.get(key) === job) {
          this.jobs.delete(key);
        }
        if (!job.controller.signal.aborted) {
          for (const listener of job.listeners) {
            listener(blob);
          }
        }
        job.listeners.clear();
        // Let input, painting and iframe destruction run before another model is loaded.
        if (this.jobs.size) {
          await new Promise((resolve) => setTimeout(resolve, 200));
        }
      }
    } finally {
      this.running = false;
    }
  }
}
