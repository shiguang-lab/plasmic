import type {
  AssetModule,
  CodeModule,
  LiveFrame,
  PreviewUpdate,
  SourceModule,
} from "@/wab/client/components/live/preview-types";
import { safeCallbackify } from "@/wab/commons/control";
import { ensure, spawn } from "@/wab/shared/common";
import type { WindowWithLiveFrame } from "@/wab/shared/live-frame-types";
import * as asynclib from "async";
import { IAutorunOptions, autorun } from "mobx";

export function syncPreview(
  win: Window,
  build: () => PreviewUpdate | undefined,
  onDone: (error?: unknown) => void,
  options?: IAutorunOptions,
) {
  const queue = makeRenderQueue(win, onDone);
  const dispose = autorun(() => {
    try {
      const update = build();
      if (update) {
        queue.push(update);
      }
    } catch (error) {
      // Serialize preparation failures with renders so an older in-flight
      // commit cannot overwrite the failure, and a later valid build can recover.
      queue.push({ error });
    }
  }, options);
  return () => {
    dispose();
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
export async function showPreviewLoadError(win: Window, error: unknown) {
  const runtime = (win as Partial<WindowWithLiveFrame>).__plasmicLive;
  if (runtime) {
    runtime.beginRender();
    await runtime.showError(error);
    return;
  }
  const failure = win.document.createElement("div");
  failure.setAttribute("role", "alert");
  failure.setAttribute("data-plasmic-preview-error", "true");
  const value = error as Error | undefined;
  failure.textContent = String(value?.message ?? error);
  if (value?.name) { failure.setAttribute("data-plasmic-error-name", value.name); }
  if (value?.stack) { failure.setAttribute("data-plasmic-error-stack", value.stack); }
  win.document.body.replaceChildren(failure);
}

function createTranspiler() {
  const cache = new Map<
    string,
    { source: string; jsxPragma?: string; code: string }
  >();
  return async (mod: SourceModule): Promise<CodeModule | AssetModule> => {
    if (mod.lang === "css") {
      return { fileName: mod.name, source: mod.source, type: "asset" };
    }
    let entry = cache.get(mod.name);
    if (
      !entry ||
      entry.source !== mod.source ||
      entry.jsxPragma !== mod.jsxPragma
    ) {
      const { transform } = await import("sucrase");
      const { code } = transform(mod.source, {
        transforms: ["typescript", "jsx", "imports"],
        jsxPragma: mod.jsxPragma,
        production: true,
        disableESTransforms: true,
      });
      entry = { source: mod.source, jsxPragma: mod.jsxPragma, code };
      cache.set(mod.name, entry);
    }
    return { fileName: mod.name, code: entry.code, imports: [], type: "code" };
  };
}

function makeRenderQueue(win: Window, onDone: (error?: unknown) => void) {
  const transpile = createTranspiler();
  let disposed = false;
  // Cargo holds updates until the previous render commits, then delivers the latest
  const queue = asynclib.cargo(
    safeCallbackify(async (tasks: (PreviewUpdate | { error: unknown })[]) => {
      let updating = false;
      let render: PreviewUpdate["render"];
      try {
        const task = ensure(
          tasks[tasks.length - 1],
          "cargo has tasks",
        );
        if ("error" in task) { throw task.error; }
        const { modules } = task;
        render = task.render;
        const compiled = await Promise.all(modules.map(transpile));
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
            liveFrame(win).beginRender(render && "componentUuid" in render ? render.componentUuid : undefined);
          }
          // Compilation fails in Studio and evaluation in the frame. Both must
          // replace stale content with the same visible error.
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
      queue.kill();
    },
  };
}
