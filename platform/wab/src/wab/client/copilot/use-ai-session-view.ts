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
    before: undefined,
    threadListBefore: undefined,
    activeThreadId: "",
    branchId: null,
    activeThread: undefined,
    threads: [],
    threadFilter: { query: "", archived: false },
    threadListLoading: false,
    historyLoading: false,
    scrollTop: -1,
    selectedModel: undefined,
    draft: { prompt: "", attachments: [] },
    running: false,
    stoppable: [],
    undoable: [],
  };
  private pendingDrafts = new Map<string, AiSessionView["draft"]>();
  private pendingThreadId?: string;
  private pendingModel: { value: string | undefined } | undefined;
  private listeners = new Set<() => void>();
  constructor(
    private api: TopFrameApi,
    readonly projectId: string,
  ) {}
  update = (state: AiSessionSnapshot) => {
    // Stream snapshots arrive in order, but may echo an earlier keystroke
    // while a newer local edit is still travelling to the top frame.
    if (this.pendingThreadId) {
      if (state.activeThreadId === this.pendingThreadId) {
        this.pendingThreadId = undefined;
      } else {
        state = {
          ...state,
          activeThreadId: this.state.activeThreadId,
          activeThread: this.state.activeThread,
          draft: this.state.draft,
          before: this.state.before,
          historyLoading: this.state.historyLoading,
          scrollTop: this.state.scrollTop,
        };
      }
    }
    const pendingDraft = this.pendingDrafts.get(state.activeThreadId);
    if (pendingDraft) {
      if (!this.pendingThreadId && isEqual(state.draft, pendingDraft)) {
        this.pendingDrafts.delete(state.activeThreadId);
      } else {
        state = { ...state, draft: pendingDraft };
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
  get visibleTasks() {
    return this.state.tasks.filter(
      (task) => task.threadId === this.activeThreadId,
    );
  }
  get activeThreadId() {
    return this.state.activeThreadId;
  }
  get branchId() {
    return this.state.branchId;
  }
  get activeThread() {
    return this.state.activeThread;
  }
  get activeRun() {
    return this.state.tasks.find((task) => task.status === "running");
  }
  get blockingTask() {
    return this.state.tasks.find(
      (task) => task.status === "running" || task.needsReconciliation,
    );
  }
  get threads() {
    return this.state.threads;
  }
  get threadFilter() {
    return this.state.threadFilter;
  }
  get threadListBefore() {
    return this.state.threadListBefore;
  }
  get threadListLoading() {
    return this.state.threadListLoading;
  }
  get historyLoading() {
    return this.state.historyLoading;
  }
  get scrollTop() {
    return this.state.scrollTop;
  }
  set scrollTop(value: number) {
    this.state = { ...this.state, scrollTop: value };
    void this.send({ type: "scroll", value, threadId: this.activeThreadId });
  }
  get error() {
    return this.state.error;
  }
  get syncError() {
    return this.state.syncError;
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
    this.pendingDrafts.set(this.activeThreadId, value);
    this.state = { ...this.state, draft: value, tasks: [...this.state.tasks] };
    this.notify();
    void this.send({ type: "draft", value, threadId: this.activeThreadId });
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
  run: AiSessionView["run"] = (
    prompt,
    binding,
    target,
    attachments,
    model,
    threadId = this.activeThreadId,
  ) =>
    this.send({
      type: "run",
      args: [prompt, binding, target, attachments, model, threadId],
    });
  private beginSelection(id: string) {
    this.pendingThreadId = id;
    this.state = {
      ...this.state,
      activeThreadId: id,
      activeThread: this.threads.find((thread) => thread.id === id),
      draft: this.pendingDrafts.get(id) ?? { prompt: "", attachments: [] },
      before: undefined,
      historyLoading: true,
      scrollTop: 0,
      tasks: [...this.tasks],
    };
    this.notify();
  }
  newThread: AiSessionView["newThread"] = (id = crypto.randomUUID()) => {
    this.beginSelection(id);
    void this.send({ type: "newThread", args: [id] });
  };
  selectThread: AiSessionView["selectThread"] = (id) => {
    return this.send({ type: "selectThread", args: [id] });
  };
  searchThreads: AiSessionView["searchThreads"] = (...args) =>
    this.send({ type: "searchThreads", args });
  updateThread: AiSessionView["updateThread"] = (...args) =>
    this.send({ type: "updateThread", args });
  setThreadAttachments: AiSessionView["setThreadAttachments"] = (
    id,
    attachments,
  ) => {
    if (id === this.activeThreadId) {
      this.state = {
        ...this.state,
        draft: { ...this.state.draft, attachments },
        tasks: [...this.tasks],
      };
      this.notify();
    }
    const pending = this.pendingDrafts.get(id);
    if (pending || id === this.activeThreadId) {
      this.pendingDrafts.set(id, {
        ...(pending ?? this.state.draft),
        attachments,
      });
    }
    void this.send({ type: "setThreadAttachments", args: [id, attachments] });
  };
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
