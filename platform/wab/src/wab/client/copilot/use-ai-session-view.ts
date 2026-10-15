import { useTopFrameApi } from "@/wab/client/contexts/AppContexts";
import type {
  AiSessionAction,
  AiSessionSnapshot,
  AiSessionView,
} from "@/wab/client/copilot/ai-session-view";
import type { TopFrameApi } from "@/wab/client/frame-ctx/top-frame-api";
import * as Comlink from "comlink";
import { isEqual } from "lodash";
import * as React from "react";

export class RemoteAiSessionView implements AiSessionView {
  private state: AiSessionSnapshot = {
    tasks: [],
    selectedModel: undefined,
    draft: { prompt: "", attachments: [] },
    running: false,
    stoppable: [],
    undoable: [],
  };
  private pendingDraft?: AiSessionView["draft"];
  private pendingModel: { value: string | undefined } | undefined;
  private listeners = new Set<() => void>();
  constructor(
    private api: TopFrameApi,
    readonly projectId: string,
  ) {}
  update = (state: AiSessionSnapshot) => {
    // Stream snapshots arrive in order, but may echo an earlier keystroke
    // while a newer local edit is still travelling to the top frame.
    if (this.pendingDraft) {
      if (isEqual(state.draft, this.pendingDraft)) {
        this.pendingDraft = undefined;
      } else {
        state = { ...state, draft: this.pendingDraft };
      }
    }
    if (this.pendingModel) {
      if (state.selectedModel === this.pendingModel.value) {
        this.pendingModel = undefined;
      } else {
        state = { ...state, selectedModel: this.pendingModel.value };
      }
    }
    this.state = state;
    this.notify();
  };
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  private notify() {
    this.listeners.forEach((listener) => listener());
  }
  snapshot = () => this.state.tasks;
  get tasks() {
    return this.state.tasks;
  }
  get error() {
    return this.state.error;
  }
  get before() {
    return this.state.before;
  }
  get running() {
    return this.state.running;
  }
  get draft() {
    return this.state.draft;
  }
  set draft(value: AiSessionView["draft"]) {
    this.pendingDraft = value;
    this.state = { ...this.state, draft: value, tasks: [...this.state.tasks] };
    this.notify();
    void this.send({ type: "draft", value });
  }
  get selectedModel() {
    return this.state.selectedModel;
  }
  set selectedModel(value: string | undefined) {
    if (value === this.state.selectedModel) {
      return;
    }
    this.pendingModel = { value };
    this.state = {
      ...this.state,
      selectedModel: value,
      tasks: [...this.state.tasks],
    };
    this.notify();
    void this.send({ type: "model", value });
  }
  canStop: AiSessionView["canStop"] = (task) =>
    this.state.stoppable.includes(task.id);
  canUndo: AiSessionView["canUndo"] = (record) =>
    this.state.undoable.includes(record.id);
  private send = (action: AiSessionAction) =>
    this.api.updateAiSession(this.projectId, action);
  run: AiSessionView["run"] = (...args) => this.send({ type: "run", args });
  stop: AiSessionView["stop"] = (...args) => this.send({ type: "stop", args });
  loadEarlier: AiSessionView["loadEarlier"] = (...args) =>
    this.send({ type: "loadEarlier", args });
  locate: AiSessionView["locate"] = (...args) =>
    this.send({ type: "locate", args });
  reconcile: AiSessionView["reconcile"] = (...args) =>
    this.send({ type: "reconcile", args });
  retry: AiSessionView["retry"] = (...args) =>
    this.send({ type: "retry", args });
  undo: AiSessionView["undo"] = (...args) => this.send({ type: "undo", args });
}

export function useAiSessionView(projectId: string) {
  const api = useTopFrameApi();
  const view = React.useMemo(
    () => new RemoteAiSessionView(api, projectId),
    [api, projectId],
  );
  React.useEffect(() => {
    let active = true;
    const unsubscribe = api.subscribeAiSession(
      projectId,
      Comlink.proxy((state) => {
        if (active) {
          view.update(state);
        }
      }),
    );
    return () => {
      active = false;
      void unsubscribe.then((dispose) => dispose());
    };
  }, [api, projectId, view]);
  return view;
}
