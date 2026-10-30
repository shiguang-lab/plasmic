export interface PreviewErrorLocation {
  componentUuid?: string;
  elementUuid?: string;
  nodeName?: string;
  interactionUuid?: string;
}

export interface PreviewDiagnostic extends PreviewErrorLocation {
  id: number;
  kind: "render" | "evaluation" | "interaction" | "unhandled";
  message: string;
  name?: string;
  stack?: string;
  componentStack?: string;
  source?: "window-error" | "unhandledrejection";
  fatal: boolean;
}

export interface PreviewDiagnostics {
  generation: number;
  componentUuid?: string;
  status: "loading" | "ready" | "degraded" | "failed";
  errors: PreviewDiagnostic[];
}

/** Diagnostics belong to one render, never the saved model. */
export function createDiagnostics() {
  let generation = 0;
  let nextId = 0;
  let componentUuid: string | undefined;
  let committed = false;
  let errors: PreviewDiagnostic[] = [];
  let seen = new Map<unknown, PreviewDiagnostic>();
  const staleErrors = new WeakSet<object>();
  const pendingWindowErrors = new Set<PreviewDiagnostic>();
  const remove = (entry: PreviewDiagnostic) => {
    errors = errors.filter((item) => item !== entry);
    pendingWindowErrors.delete(entry);
    for (const [error, item] of seen) {
      if (item === entry) { seen.delete(error); }
    }
  };
  return {
    begin(component?: string) {
      generation++;
      componentUuid = component;
      committed = false;
      errors = [];
      seen = new Map();
      pendingWindowErrors.clear();
    },
    commit() { committed = true; },
    resolve(error: unknown, expectedGeneration: number) {
      if (expectedGeneration !== generation) { return; }
      const entry = seen.get(error);
      if (entry) { remove(entry); }
    },
    report(
      error: unknown,
      details: Pick<PreviewDiagnostic, "kind" | "fatal" | "source"> & PreviewErrorLocation & { componentStack?: string },
      expectedGeneration = generation,
    ) {
      const errorObject = error !== null && typeof error === "object" ? error : undefined;
      if (expectedGeneration !== generation) {
        if (errorObject) { staleErrors.add(errorObject); }
        return;
      }
      if (errorObject && details.kind === "unhandled" && staleErrors.has(errorObject)) {
        return;
      }
      if (errorObject && details.kind !== "unhandled") { staleErrors.delete(errorObject); }
      const previous = seen.get(error);
      if (previous) {
        Object.assign(previous, details, { id: ++nextId, fatal: previous.fatal || details.fatal,
          kind: details.kind === "unhandled" ? previous.kind : details.kind });
        return;
      }
      const value = error as Error | undefined;
      const entry: PreviewDiagnostic = {
        id: ++nextId,
        message: String(value?.message ?? error),
        ...(typeof value?.name === "string" ? { name: value.name } : {}),
        ...(typeof value?.stack === "string" ? { stack: value.stack } : {}),
        ...details,
      };
      if (details.kind === "render" && entry.stack) {
        // React development probes throw separate Error objects before the
        // boundary receives the final attempt. Correlate the same throw site
        // only within this JS turn, never older errors or promise rejections.
        const throwSite = (stack: string) => stack.split("\n").filter((line) => /^\s+at\s/.test(line)).slice(0, 2);
        const frames = throwSite(entry.stack);
        for (const pending of pendingWindowErrors) {
          if (pending.message === entry.message && pending.name === entry.name && pending.stack
            && frames.length === 2 && throwSite(pending.stack).join("\n") === frames.join("\n")) {
            remove(pending);
          }
        }
      }
      errors.push(entry);
      seen.set(error, entry);
      if (details.source === "window-error") {
        pendingWindowErrors.add(entry);
        queueMicrotask(() => pendingWindowErrors.delete(entry));
      }
      // Bound diagnostics for long-running event loops while retaining fatal errors.
      if (errors.length > 50) {
        const index = errors.findIndex((item) => !item.fatal);
        remove(errors[index < 0 ? 1 : index]);
      }
    },
    read(): PreviewDiagnostics {
      return { generation, componentUuid,
        status: errors.some((error) => error.fatal) ? "failed"
          : errors.length ? "degraded" : committed ? "ready" : "loading",
        errors: errors.map((error) => ({ ...error })),
      };
    },
  };
}

export function installErrorHandlers(win: Window, report: ReturnType<typeof createDiagnostics>["report"]) {
  const onError = (event: ErrorEvent) => {
    if (event.error || event.message) {
      report(event.error ?? event.message, { kind: "unhandled", fatal: false, source: "window-error" });
    }
  };
  const onRejection = (event: PromiseRejectionEvent) => {
    report(event.reason, { kind: "unhandled", fatal: false, source: "unhandledrejection" });
  };
  win.addEventListener("error", onError);
  win.addEventListener("unhandledrejection", onRejection);
  return () => {
    win.removeEventListener("error", onError);
    win.removeEventListener("unhandledrejection", onRejection);
  };
}
