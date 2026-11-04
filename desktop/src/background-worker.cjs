// One App-owned utility process per serial lane. Isolating its address space
// lets idle exit reclaim native allocator arenas as well as the JS heap.
class BackgroundWorker {
  constructor({ idleMs = 15000, name = "Plasmic Background" } = {}) {
    this.idleMs = idleMs;
    this.name = name;
    this.jobs = [];
    this.worker = null;
    this.current = null;
    this.closed = false;
    this.stopping = false;
  }
  run(task, input, { signal } = {}) {
    if (this.closed) return Promise.reject(new Error("Desktop closed"));
    if (signal?.aborted) return Promise.reject(signal.reason);
    return new Promise((resolve, reject) => {
      const job = { task, input, resolve, reject, signal };
      job.abort = () => {
        if (this.current === job) {
          this.current = null;
          this.stop();
        } else this.jobs = this.jobs.filter(item => item !== job);
        this.finish(job, signal.reason);
        this.pump();
      };
      signal?.addEventListener("abort", job.abort, { once: true });
      this.jobs.push(job);
      this.pump();
    });
  }
  finish(job, error, result) {
    job.signal?.removeEventListener("abort", job.abort);
    const done = error ? job.reject : job.resolve;
    job.input = job.signal = job.abort = job.resolve = job.reject = null;
    done(error || result);
  }
  stop() {
    clearTimeout(this.timer);
    if (!this.worker) return Promise.resolve();
    if (!this.stopping) {
      this.stopping = true;
      this.worker.kill();
    }
    return this.exited;
  }
  pump() {
    clearTimeout(this.timer);
    if (this.current || this.closed || this.stopping) return;
    if (!this.jobs.length) {
      if (this.worker) {
        this.timer = setTimeout(() => { void this.stop(); }, this.idleMs);
        this.timer.unref();
      }
      return;
    }
    if (!this.worker) {
      let worker;
      try {
        worker = this.worker = require("electron").utilityProcess.fork(require.resolve("./background-task.cjs"), [], {
          serviceName: this.name, stdio: "pipe",
        });
      } catch (error) {
        for (const job of this.jobs.splice(0)) this.finish(job, error);
        return;
      }
      this.ready = false;
      worker.stdout?.resume(); worker.stderr?.resume();
      this.exited = new Promise(resolve => worker.once("exit", code => {
        const job = this.current;
        this.worker = this.current = null;
        this.stopping = this.ready = false;
        if (job) this.finish(job, new Error("Background worker exited (" + code + ")"));
        resolve();
        this.pump();
      }));
      worker.on("error", () => { if (this.worker === worker) void this.stop(); });
      worker.on("spawn", () => {
        if (this.worker !== worker) return;
        if (this.stopping) worker.kill();
        else { this.ready = true; this.send(); }
      });
      worker.on("message", ({ result, error }) => {
        if (this.worker !== worker || this.stopping || !this.current) return;
        const job = this.current;
        this.current = null;
        let exception;
        if (error) {
          const Type = error.name === "SyntaxError" ? SyntaxError : Error;
          exception = Object.assign(new Type(error.message), error);
        }
        this.finish(job, exception, result);
        this.pump();
      });
    }
    this.current = this.jobs.shift();
    if (this.ready) this.send();
  }
  send() {
    if (!this.current || this.stopping) return;
    try { this.worker.postMessage({ task: this.current.task, input: this.current.input }); }
    catch (error) {
      const job = this.current;
      this.current = null;
      this.finish(job, error);
      void this.stop();
    }
  }
  async close() {
    this.closed = true;
    if (this.current) this.finish(this.current, new Error("Desktop closed"));
    this.current = null;
    for (const job of this.jobs.splice(0)) this.finish(job, new Error("Desktop closed"));
    await this.stop();
  }
}
module.exports = { BackgroundWorker };
