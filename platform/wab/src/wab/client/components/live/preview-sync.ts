import { createPreviewCompiler } from "@/wab/client/components/live/preview-compiler";
import type {
  LiveFrame,
  AssetModule,
  CodeModule,
  PreviewUpdate,
  SourceModule,
} from "@/wab/client/components/live/preview-types";
import { safeCallbackify } from "@/wab/commons/control";
import { ensure, spawn } from "@/wab/shared/common";
import type { WindowWithLiveFrame } from "@/wab/shared/live-frame-types";
import * as asynclib from "async";

export type PreviewBatchCompiler = (
  modules: SourceModule[],
  signal: AbortSignal,
) => Promise<(CodeModule | AssetModule)[]>;

export function syncPreview(
  win: Window,
  build: () => PreviewUpdate | undefined,
  onDone: (error?: unknown) => void,
  options?: {
    name?: string;
    scheduler?: (run: () => void) => void;
    subscribe?: (invalidate: () => void) => () => void;
    compileModules?: PreviewBatchCompiler;
  },
) {
  const queue = makeRenderQueue(win, onDone, options?.compileModules);
  let disposed = false;
  let scheduled = false;
  const buildAndQueue = () => {
    try {
      const update = build();
      if (update) {
        queue.push(update);
      }
    } catch (error) {
      // Keep preparation failures ordered with in-flight commits and recovery.
      queue.push({ error });
    }
  };
  const invalidate = () => {
    if (disposed || scheduled) {
      return;
    }
    scheduled = true;
    const run = () => {
      scheduled = false;
      if (!disposed) {
        buildAndQueue();
      }
    };
    (options?.scheduler ?? queueMicrotask)(run);
  };
  const unsubscribe = options?.subscribe?.(invalidate);
  if (options?.scheduler) {
    invalidate();
  } else {
    buildAndQueue();
  }
  return () => {
    disposed = true;
    unsubscribe?.();
    queue.dispose();
  };
}

export function liveFrame(win: Window): LiveFrame {
  return ensure(
    (win as WindowWithLiveFrame).__plasmicLive,
    "window.__plasmicLive",
  );
}

/** Bootstrap can fail before the runtime bundle (and React) is available. */
export async function showPreviewLoadError(win: Window, error: unknown, display: { title: string; label: string; onReturn: () => void }) {
  const runtime = (win as Partial<WindowWithLiveFrame>).__plasmicLive;
  if (runtime) {
    runtime.beginRender();
    runtime.setErrorTitle(display.title, display);
    await runtime.showError(error);
    return;
  }
  const failure = win.document.createElement("div");
  failure.setAttribute("role", "alert");
  failure.setAttribute("data-plasmic-preview-error", "true");
  Object.assign(failure.style, { margin: "48px auto", padding: "24px", maxWidth: "360px", border: "1px solid #e5e7eb", borderRadius: "12px", fontFamily: "system-ui" });
  const title = win.document.createElement("p");
  title.textContent = display.title;
  const back = win.document.createElement("button");
  back.type = "button";
  back.textContent = display.label;
  back.onclick = display.onReturn;
  failure.append(title, back);
  win.document.body.replaceChildren(failure);
}


function makeRenderQueue(win: Window, onDone: (error?: unknown) => void, compileModules?: PreviewBatchCompiler) {
  const compiler = compileModules ? undefined : createPreviewCompiler();
  const compile: PreviewBatchCompiler = compileModules ?? ensure(compiler, "Preview compiler").compile;
  const compilation = new AbortController();
  let disposed = false;
  // Cargo holds updates until the previous render commits, then delivers the latest
  const queue = asynclib.cargo(
    safeCallbackify(async (tasks: (PreviewUpdate | { error: unknown })[]) => {
      let updating = false;
      let render: PreviewUpdate["render"];
      try {
        const task = ensure(tasks[tasks.length - 1], "cargo has tasks");
        if ("error" in task) {
          throw task.error;
        }
        const { modules } = task;
        render = task.render;
        const compiled = await compile(modules, compilation.signal);
        if (!disposed) {
          updating = true;
          await liveFrame(win).update(compiled, render);
        }
        if (!disposed) {
          onDone();
        }
      } catch (error) {
        if (!disposed) {
          if (!updating) {
            liveFrame(win).beginRender(
              render && "componentUuid" in render
                ? render.componentUuid
                : undefined,
            );
          }
          // The runtime retains the last committed page after update failures.
          await liveFrame(win).showError(error);
        }
        if (!disposed) {
          onDone(error);
        }
      }
    }),
  );
  return {
    push: (update: PreviewUpdate | { error: unknown }) => {
      if (!disposed) {
        spawn(queue.push(update));
      }
    },
    dispose: () => {
      disposed = true;
      compilation.abort();
      compiler?.dispose();
      queue.kill();
    },
  };
}
