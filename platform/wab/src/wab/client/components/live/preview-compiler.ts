import type { PreviewBatchCompiler } from "@/wab/client/components/live/preview-sync";
import type { AssetModule, CodeModule, SourceModule } from "@/wab/client/components/live/preview-types";
import { ensure } from "@/wab/shared/common";
import { PreviewWorker } from "@/wab/client/components/live/preview-worker";

type CompiledModule = CodeModule | AssetModule;
export interface PreviewCompilerRequest { id: number; modules: SourceModule[]; }
export type PreviewCompilerReply = { id: number } & (
  | { modules: CompiledModule[] }
  | { error: { name: string; message: string; stack?: string } }
);

/** Pure compiled modules belong to the preview owner, independently of frames.
 * Pending and completed modules are reusable while another page is preparing. */
export function createPreviewCompiler() {
  let worker: Worker | undefined;
  let releaseWorker: (() => void) | undefined;
  let nextId = 0;
  let closed: { reason: unknown } | undefined;
  const cache = new Map<string, { source: SourceModule; result: Promise<CompiledModule> }>();
  const pending = new Map<number, {
    resolve: (modules: CompiledModule[]) => void;
    reject: (reason: unknown) => void;
  }>();
  const dispose = (reason: unknown = new DOMException("Preview compiler disposed", "AbortError")) => {
    if (closed) { return; }
    closed = { reason };
    if (worker) {
      worker.onmessage = worker.onerror = worker.onmessageerror = null;
      worker.terminate(); worker = undefined;
    }
    releaseWorker?.(); releaseWorker = undefined;
    for (const request of pending.values()) { request.reject(reason); }
    pending.clear(); cache.clear();
  };
  const dispatch = (modules: SourceModule[]) => {
    if (!worker) {
      const created = new PreviewWorker(new URL("./preview-compiler.worker.ts", import.meta.url), {
        type: "classic", name: "preview-compiler",
      });
      worker = created.worker; releaseWorker = created.release;
      worker.onmessage = ({ data }: MessageEvent<PreviewCompilerReply>) => {
        const request = pending.get(data.id);
        if (!request) { return; }
        pending.delete(data.id);
        if ("error" in data) {
          const error = new Error(data.error.message); error.name = data.error.name;
          if (data.error.stack) { error.stack = data.error.stack; }
          request.reject(error);
        } else { request.resolve(data.modules); }
      };
      worker.onerror = (event) => { event.preventDefault(); dispose(new Error(event.message)); };
      worker.onmessageerror = () => dispose(new Error("Could not read Preview compiler response"));
    }
    const target = worker;
    return new Promise<CompiledModule[]>((resolve, reject) => {
      const id = ++nextId; pending.set(id, { resolve, reject });
      try { target.postMessage({ id, modules } satisfies PreviewCompilerRequest); }
      catch (error) { dispose(error); }
    });
  };
  const compile: PreviewBatchCompiler = async (modules, signal) => {
    signal.throwIfAborted();
    if (closed) { throw closed.reason; }
    const missing: SourceModule[] = [];
    for (const mod of modules) {
      const entry = cache.get(mod.name);
      if (entry && entry.source.source === mod.source && entry.source.jsxPragma === mod.jsxPragma && entry.source.lang === mod.lang) { continue; }
      if (mod.lang === "css") {
        cache.set(mod.name, { source: { ...mod }, result: Promise.resolve({ fileName: mod.name, source: mod.source, type: "asset" }) });
      } else { missing.push(mod); }
    }
    if (missing.length) {
      const batch = dispatch(missing);
      missing.forEach((mod, index) => {
        const entry = { source: { ...mod }, result: batch.then(results => ensure(results[index], "Compiled preview module")) };
        entry.result = entry.result.catch(error => {
          if (cache.get(mod.name) === entry) { cache.delete(mod.name); }
          throw error;
        });
        cache.set(mod.name, entry);
      });
    }
    const result = Promise.all(modules.map(mod => ensure(cache.get(mod.name), "Prepared preview module").result));
    // Cancelling one frame must not cancel a preparation shared by another.
    return new Promise<CompiledModule[]>((resolve, reject) => {
      const abort = () => { signal.removeEventListener("abort", abort); reject(signal.reason); };
      signal.addEventListener("abort", abort, { once: true });
      result.then(value => { signal.removeEventListener("abort", abort); resolve(value); }, error => { signal.removeEventListener("abort", abort); reject(error); });
      if (signal.aborted) { abort(); }
    });
  };
  return { compile, dispose, get disposed() { return !!closed; } };
}
