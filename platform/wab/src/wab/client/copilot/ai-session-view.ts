import type { LocalEditSession } from "@/wab/client/copilot/local-edit-session";

/** The UI reads a snapshot; execution and authenticated requests stay in the top frame. */
export type AiSessionView = Pick<
  LocalEditSession,
  | "tasks"
  | "error"
  | "before"
  | "draft"
  | "selectedModel"
  | "running"
  | "subscribe"
  | "snapshot"
  | "canStop"
  | "canUndo"
  | "run"
  | "stop"
  | "loadEarlier"
  | "locate"
  | "reconcile"
  | "retry"
  | "undo"
>;

export type AiSessionSnapshot = Pick<
  AiSessionView,
  "tasks" | "error" | "before" | "draft" | "selectedModel" | "running"
> & { stoppable: string[]; undoable: string[] };

type ActionName =
  "run" | "stop" | "loadEarlier" | "locate" | "reconcile" | "retry" | "undo";
export type AiSessionAction =
  | {
      [K in ActionName]: { type: K; args: Parameters<AiSessionView[K]> };
    }[ActionName]
  | { type: "draft"; value: AiSessionView["draft"] }
  | { type: "model"; value: string | undefined };

export function snapshotAiSession(session: AiSessionView): AiSessionSnapshot {
  return {
    tasks: session.tasks,
    error: session.error,
    before: session.before,
    draft: session.draft,
    selectedModel: session.selectedModel,
    running: session.running,
    stoppable: session.tasks
      .filter((task) => session.canStop(task))
      .map((task) => task.id),
    undoable: session.tasks
      .flatMap((task) => task.records)
      .filter((record) => session.canUndo(record))
      .map((record) => record.id),
  };
}

export async function applyAiSessionAction(
  session: AiSessionView,
  action: AiSessionAction,
) {
  switch (action.type) {
    case "draft":
      session.draft = action.value;
      return;
    case "model":
      session.selectedModel = action.value;
      return;
    case "run":
      return session.run(...action.args);
    case "stop":
      return session.stop(...action.args);
    case "loadEarlier":
      return session.loadEarlier(...action.args);
    case "locate":
      return session.locate(...action.args);
    case "reconcile":
      return session.reconcile(...action.args);
    case "retry":
      return session.retry(...action.args);
    case "undo":
      return session.undo(...action.args);
  }
}
