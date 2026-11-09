import type { PreviewBatchCompiler } from "@/wab/client/components/live/preview-sync";
import type { AssetModule, CodeModule } from "@/wab/client/components/live/preview-types";

export type PreviewCompilerReply =
  | { modules: (CodeModule | AssetModule)[] }
  | { error: { name: string; message: string; stack?: string } };

/** The compiler isolate belongs to this batch, never to the rendered overview. */
export const compileModules: PreviewBatchCompiler = async (modules, signal) => {
  signal.throwIfAborted();
  const worker = new Worker(new URL("./compiler.worker.ts", import.meta.url), {
    type: "classic",
    name: "dashboard-preview-compiler",
  });
  let onAbort: (() => void) | undefined;
  try {
    return await new Promise<(CodeModule | AssetModule)[]>((resolve, reject) => {
      worker.onmessage = ({ data }: MessageEvent<PreviewCompilerReply>) => {
        if ("error" in data) {
          const error = new Error(data.error.message);
          error.name = data.error.name;
          if (data.error.stack) { error.stack = data.error.stack; }
          reject(error);
        } else {
          resolve(data.modules);
        }
      };
      worker.onerror = (event) => {
        event.preventDefault();
        reject(new Error(event.message));
      };
      worker.onmessageerror = () => reject(new Error("Could not read Preview compiler response"));
      onAbort = () => reject(signal.reason);
      signal.addEventListener("abort", onAbort, { once: true });
      if (signal.aborted) { onAbort(); }
      else { worker.postMessage(modules); }
    });
  } finally {
    if (onAbort) { signal.removeEventListener("abort", onAbort); }
    worker.onmessage = worker.onerror = worker.onmessageerror = null;
    worker.terminate();
  }
};
