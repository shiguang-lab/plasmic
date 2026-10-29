import { normalizeError } from "@/wab/client/ErrorNotifications";
import type { PlasmicAiTools } from "@/wab/client/components/studio/TopFrameCopilotToolsBridge";
import { NetworkError } from "@/wab/shared/ApiErrors/ApiError";
import { deserializeApiError } from "@/wab/shared/ApiErrors/errors";
import { UserError } from "@/wab/shared/UserError";
import { ensure } from "@/wab/shared/common";
import type {
  AiEvent,
  AiTask,
  AiThread,
  AiThreadPage,
  AiToolCall,
  EditRecord,
} from "@/wab/shared/copilot/ai-chat";
import { applyAiEvent } from "@/wab/shared/copilot/ai-chat";
import {
  LocalAiAttachment,
  LocalAiDraft,
  LocalEditBinding,
  LocalEditToolResult,
} from "@/wab/shared/copilot/local-edit";
import { PROTOTYPE_TOOL_META } from "@/wab/shared/copilot/prototype-tools";
import { Socket, io } from "socket.io-client";

export type EditTask = AiTask;
export type { EditRecord } from "@/wab/shared/copilot/ai-chat";
export type PageGenerationOptions = { name: string; path: string };

export async function localAiFetch<T>(
  projectId: string,
  action: "status",
): Promise<T> {
  return aiChatRequest<T>(
    `/api/v1/projects/${encodeURIComponent(projectId)}/ai/edit/${action}`,
  );
}
export async function aiChatRequest<T>(
  url: string,
  body?: unknown,
): Promise<T> {
  const request = { method: body === undefined ? "GET" : "POST", url };
  const options: RequestInit = {
    method: request.method,
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  };
  let response: Response;
  try {
    response = await fetch(url, options);
  } catch (cause) {
    throw new NetworkError(request, { cause });
  }
  const result = await response.json().catch((error) => {
    if (!response.ok) {
      return {};
    }
    throw error;
  });
  if (!response.ok) {
    throw Object.assign(deserializeApiError(result.error, response.status), {
      request,
    });
  }
  return result as T;
}

/** A continuous cursor never advances over an event that has not been applied. */
export class AiEventCursor {
  seq = 0;
  private pending = new Map<number, AiEvent>();
  reset(seq: number) {
    this.seq = seq;
    this.pending.forEach((_event, key) => {
      if (key <= seq) {
        this.pending.delete(key);
      }
    });
  }
  accept(event: AiEvent, apply: (event: AiEvent) => void) {
    if (event.seq <= this.seq) {
      return;
    }
    this.pending.set(event.seq, event);
    while (this.pending.has(this.seq + 1)) {
      const next = ensure(
        this.pending.get(this.seq + 1),
        "Missing queued event",
      );
      this.pending.delete(++this.seq);
      apply(next);
    }
  }
  get gap() {
    return this.pending.size > 0;
  }
}

/** Top-frame input state and native executor. Orchestration belongs to Temporal. */
export class LocalEditSession {
  tasks: AiTask[] = [];
  error?: Error;
  syncError?: Error;
  branchId: string | null = null;
  activeThreadId: string = crypto.randomUUID();
  private branchReady = false;
  private lastThreadByBranch = new Map<string | null, string>();
  private threadsById = new Map<string, AiThread>();
  private localThreads = new Set<string>([this.activeThreadId]);
  private threadStates = new Map<
    string,
    {
      draft: LocalAiDraft;
      before?: string;
      loaded: boolean;
      loading: boolean;
      scrollTop: number;
    }
  >([
    [
      this.activeThreadId,
      {
        draft: { prompt: "", attachments: [] },
        loaded: true,
        loading: false,
        scrollTop: -1,
      },
    ],
  ]);
  private threadIds: string[] = [];
  threadListBefore?: string;
  threadListLoading = false;
  threadFilter = { query: "", archived: false };
  private listRequest = 0;
  private loadingThreads = new Set<string>();
  private view(id = this.activeThreadId) {
    let state = this.threadStates.get(id);
    if (!state) {
      state = {
        draft: { prompt: "", attachments: [] },
        loaded: false,
        loading: false,
        scrollTop: -1,
      };
      this.threadStates.set(id, state);
    }
    return state;
  }
  get activeThread() {
    return this.threadsById.get(this.activeThreadId);
  }
  get visibleTasks() {
    return this.tasks.filter((task) => task.threadId === this.activeThreadId);
  }
  get activeRun() {
    return this.tasks.find((task) => task.status === "running");
  }
  get blockingTask() {
    return this.tasks.find(
      (task) => task.status === "running" || task.needsReconciliation,
    );
  }
  get historyLoading() {
    return this.booting || this.view().loading;
  }
  get scrollTop() {
    return this.view().scrollTop;
  }
  set scrollTop(value: number) {
    this.view().scrollTop = value;
  }
  get before() {
    return this.view().before;
  }
  set before(value: string | undefined) {
    this.view().before = value;
  }
  get threads(): Array<AiThread & { draft?: string }> {
    const ids = new Set([...this.threadIds, ...this.localThreads]);
    return [...ids]
      .flatMap((id) => {
        const thread = this.threadsById.get(id);
        const draft = this.localThreads.has(id)
          ? this.view(id).draft
          : undefined;
        const preview =
          draft?.prompt ||
          draft?.attachments.map((file) => file.name).join(", ");
        if (draft && id !== this.activeThreadId && !preview) {
          return [];
        }
        return thread &&
          thread.branchId === this.branchId &&
          !!thread.archivedAt === this.threadFilter.archived &&
          (thread.title || preview || "")
            .toLocaleLowerCase()
            .includes(this.threadFilter.query.toLocaleLowerCase())
          ? [{ ...thread, draft: preview }]
          : [];
      })
      .sort(
        (a, b) =>
          b.lastMessageAt.localeCompare(a.lastMessageAt) ||
          b.id.localeCompare(a.id),
      );
  }
  private selectionKey() {
    return `plasmic.ai.thread:${this.userId}:${this.projectId}:${this.branchId ?? "main"}`;
  }
  private rememberThread() {
    this.lastThreadByBranch.set(this.branchId, this.activeThreadId);
    try {
      if (this.localThreads.has(this.activeThreadId)) {
        localStorage.removeItem(this.selectionKey());
      } else {
        localStorage.setItem(this.selectionKey(), this.activeThreadId);
      }
    } catch {
      /* The active conversation still works when browser storage is unavailable. */
    }
  }
  async setBranch(branchId: string | null) {
    if (this.branchReady && branchId === this.branchId) {
      return;
    }
    this.branchReady = true;
    this.branchId = branchId;
    this.createThread(false);
    if (!this.connected || !this.viewers) {
      return;
    }
    const generation = this.generation;
    await this.initializing;
    if (branchId === this.branchId && generation === this.generation) {
      await this.restoreBranch();
    }
  }
  private async restoreBranch() {
    const branchId = this.branchId;
    let remembered = this.lastThreadByBranch.get(branchId) ?? null;
    if (!remembered) {
      try {
        remembered = localStorage.getItem(this.selectionKey());
      } catch {
        /* Storage can be disabled. */
      }
    }
    const initial = this.activeThreadId;
    const generation = this.generation;
    await this.searchThreads("", false);
    if (
      branchId !== this.branchId ||
      generation !== this.generation ||
      initial !== this.activeThreadId
    ) {
      return;
    }
    if (remembered) {
      try {
        const thread =
          this.threadsById.get(remembered) ??
          (await aiChatRequest<AiThread>(
            this.url(`/threads/${encodeURIComponent(remembered)}`),
          ));
        if (
          generation === this.generation &&
          initial === this.activeThreadId &&
          !this.sending &&
          !this.draft.prompt &&
          !this.draft.attachments.length &&
          branchId === this.branchId &&
          thread.branchId === branchId &&
          !thread.archivedAt
        ) {
          if (!this.localThreads.has(thread.id)) {
            this.applyThread(thread);
            this.view(thread.id).loaded = false;
          }
          await this.selectThread(thread.id);
        }
      } catch {
        /* A removed or inaccessible last conversation falls back to a new topic. */
      }
    }
  }
  newThread(id?: string) {
    this.createThread(true, id);
  }
  private createThread(remember: boolean, id: string = crypto.randomUUID()) {
    if (
      this.localThreads.has(this.activeThreadId) &&
      !this.draft.prompt &&
      !this.draft.attachments.length
    ) {
      this.localThreads.delete(this.activeThreadId);
      this.threadsById.delete(this.activeThreadId);
      this.threadStates.delete(this.activeThreadId);
    }
    this.activeThreadId = id;
    this.localThreads.add(this.activeThreadId);
    const now = new Date().toISOString();
    this.threadsById.set(this.activeThreadId, {
      id: this.activeThreadId,
      projectId: this.projectId,
      branchId: this.branchId,
      title: "",
      createdBy: this.userId ?? "",
      createdAt: now,
      lastMessageAt: now,
      archivedAt: null,
      seq: 0,
    });
    this.view().loaded = true;
    if (remember) {
      this.rememberThread();
    }
    this.notify();
  }
  async selectThread(id: string) {
    const thread = this.threadsById.get(id);
    if (!thread || thread.branchId !== this.branchId) {
      return;
    }
    const release = this.connected ? this.retain() : undefined;
    try {
      this.activeThreadId = id;
      this.rememberThread();
      this.notify();
      if (!this.view().loaded) {
        await this.loadThread(id);
      }
    } finally {
      release?.();
    }
  }
  async searchThreads(query: string, archived: boolean, more = false) {
    if (this.booting) {
      await this.initializing;
      if (!this.connected || !this.snapshotLoaded) {
        return;
      }
    }
    if (more && (!this.threadListBefore || this.threadListLoading)) {
      return;
    }
    const request = ++this.listRequest;
    const generation = this.generation;
    const branch = this.branchId;
    const before = more ? this.threadListBefore : undefined;
    this.threadFilter = { query, archived };
    this.threadListLoading = true;
    this.notify();
    const params = new URLSearchParams({
      branchId: branch ?? "",
      query,
      archived: archived ? "1" : "0",
    });
    if (before) {
      params.set("before", before);
    }
    try {
      const page = await aiChatRequest<AiThreadPage>(
        this.url(`/threads?${params}`),
      );
      if (
        generation !== this.generation ||
        request !== this.listRequest ||
        branch !== this.branchId
      ) {
        return;
      }
      page.threads.forEach((thread) => this.applyThread(thread));
      this.threadIds = [
        ...new Set([
          ...(more ? this.threadIds : []),
          ...page.threads.map((thread) => thread.id),
        ]),
      ];
      this.threadListBefore = page.before;
    } catch (error) {
      if (generation === this.generation && request === this.listRequest) {
        this.error = normalizeError(error);
      }
    } finally {
      if (generation === this.generation && request === this.listRequest) {
        this.threadListLoading = false;
        this.notify();
      }
    }
  }
  async updateThread(
    id: string,
    patch: { title?: string; archived?: boolean },
  ) {
    const generation = this.generation;
    try {
      const thread = await aiChatRequest<AiThread>(
        this.url(`/threads/${encodeURIComponent(id)}`),
        patch,
      );
      if (generation !== this.generation) {
        return;
      }
      this.applyThread(thread);
      if (patch.archived && id === this.activeThreadId) {
        this.newThread();
      }
      this.notify();
    } catch (error) {
      if (generation === this.generation) {
        this.error = normalizeError(error);
        this.notify();
      }
    }
  }
  private applyThread(thread: AiThread) {
    const previous = this.threadsById.get(thread.id);
    if (previous && previous.seq > thread.seq) {
      return;
    }
    const latest = this.tasks
      .filter((task) => task.threadId === thread.id)
      .at(-1);
    const lastTask =
      latest &&
      (!thread.lastTask ||
        latest.createdAt > thread.lastTask.createdAt ||
        (latest.id === thread.lastTask.id &&
          (latest.seq ?? 0) > (thread.lastTask.seq ?? 0)))
        ? latest
        : thread.lastTask;
    this.threadsById.set(thread.id, {
      ...thread,
      lastTask: lastTask
        ? {
            id: lastTask.id,
            prompt: lastTask.prompt,
            status: lastTask.status,
            createdAt: lastTask.createdAt,
            seq: lastTask.seq,
            needsReconciliation: lastTask.needsReconciliation,
          }
        : undefined,
    });
    this.localThreads.delete(thread.id);
    if (!this.threadIds.includes(thread.id)) {
      this.threadIds.unshift(thread.id);
    }
  }
  private async loadThread(id: string) {
    const state = this.view(id);
    if (state.loading) {
      return;
    }
    const generation = this.generation;
    state.loading = true;
    this.notify();
    try {
      const page = await aiChatRequest<{ tasks: AiTask[]; before?: string }>(
        this.url(`?threadId=${encodeURIComponent(id)}`),
      );
      if (generation !== this.generation) {
        return;
      }
      page.tasks.forEach((task) => this.apply(task));
      state.before = page.before;
      state.loaded = true;
    } catch (error) {
      if (generation === this.generation) {
        this.error = normalizeError(error);
      }
    } finally {
      state.loading = false;
      if (generation === this.generation) {
        this.notify();
      }
    }
  }
  private _userId?: string;
  get userId() {
    return this._userId;
  }
  set userId(value: string | undefined) {
    if (value === this._userId) {
      return;
    }
    this.generation++;
    this._userId = value;
    this.threadsById.clear();
    this.lastThreadByBranch.clear();
    this.threadStates.clear();
    this.localThreads.clear();
    this.threadIds = [];
    this.threadListBefore = undefined;
    this.threadListLoading = false;
    this.threadFilter = { query: "", archived: false };
    this.loadingThreads.clear();
    this.listRequest++;
    this.branchReady = false;
    this._selectedModel = undefined;
    this.tasks = [];
    this.receipts.clear();
    this.localRecords.clear();
    this.editorSessionId = undefined;
    this.error = undefined;
    this.syncError = undefined;
    this.cursor = new AiEventCursor();
    this.buffer = [];
    this.missingRuns.clear();
    this.createThread(false);
  }
  get draft() {
    return this.view().draft;
  }
  set draft(value: LocalAiDraft) {
    this.view().draft = value;
    this.notify();
  }
  setThreadDraft(id: string, value: LocalAiDraft) {
    if (!this.threadStates.has(id)) {
      return;
    }
    this.view(id).draft = value;
    this.notify();
  }
  setThreadAttachments(id: string, attachments: LocalAiAttachment[]) {
    if (!this.threadStates.has(id)) {
      return;
    }
    this.view(id).draft = { ...this.view(id).draft, attachments };
    this.notify();
  }
  setThreadScroll(id: string, value: number) {
    if (this.threadStates.has(id)) {
      this.view(id).scrollTop = value;
    }
  }
  private _selectedModel?: string;
  get selectedModel() {
    return this._selectedModel;
  }
  set selectedModel(value: string | undefined) {
    if (value === this._selectedModel) {
      return;
    }
    this._selectedModel = value;
    this.notify();
  }
  private listeners = new Set<() => void>();
  private cursor = new AiEventCursor();
  private socket?: Socket;
  private timer?: ReturnType<typeof setInterval>;
  private connected = false;
  private generation = 0;
  private syncing = false;
  private subscribed = false;
  private snapshotLoaded = false;
  private nextSyncAt = 0;
  private syncRetryDelay = 0;
  private viewers = 0;
  private executing = false;
  private sending = false;
  private undoing = false;
  private executionController?: AbortController;
  private stoppedRuns = new Set<string>();
  private booting = false;
  private initializing?: Promise<void>;
  private buffer: AiEvent[] = [];
  private receipts = new Map<
    string,
    {
      sessionId: string;
      fence: number;
      result?: LocalEditToolResult;
      error?: string;
      uncertain?: boolean;
    }
  >();
  private executed = new Set<string>();
  private localRecords = new Set<string>();
  private editorSessionId?: string;
  constructor(
    readonly projectId: string,
    private getTools: () => PlasmicAiTools | undefined = () =>
      window.PLASMIC_AI_TOOLS,
  ) {}
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  snapshot = () => this.tasks;
  get running() {
    return this.sending || this.undoing || !!this.blockingTask;
  }
  canUndo(record: EditRecord) {
    return (
      this.localRecords.has(record.id) &&
      record.binding.sessionId === this.editorSessionId
    );
  }
  canStop(task: AiTask) {
    return task.authorId === this.userId;
  }
  private notify() {
    this.tasks = [...this.tasks];
    this.listeners.forEach((listener) => listener());
  }
  private apply = (task: AiTask) => {
    const index = this.tasks.findIndex((t) => t.id === task.id);
    if (index >= 0 && (this.tasks[index].seq ?? 0) > (task.seq ?? 0)) {
      return;
    }
    if (index < 0) {
      this.tasks.push(task);
    } else {
      this.tasks[index] = task;
    }
    this.tasks.sort(
      (a, b) =>
        a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id),
    );
    const thread = this.threadsById.get(task.threadId);
    if (thread) {
      this.applyThread(thread);
    } else if (task.threadId && !this.loadingThreads.has(task.threadId)) {
      this.loadingThreads.add(task.threadId);
      const generation = this.generation;
      void aiChatRequest<AiThread>(
        this.url(`/threads/${encodeURIComponent(task.threadId)}`),
      )
        .then((next) => {
          if (generation === this.generation) {
            this.applyThread(next);
            this.notify();
          }
        })
        .catch(() => undefined)
        .finally(() => this.loadingThreads.delete(task.threadId));
    }
    this.notify();
  };
  private loadingRuns = new Map<string, Promise<void>>();
  private missingRuns = new Set<string>();
  private applyEvent = (event: AiEvent) => {
    if (event.thread) {
      this.applyThread(event.thread);
      this.notify();
      return;
    }
    const task = this.tasks.find((candidate) => candidate.id === event.runId);
    const next = applyAiEvent(task, event);
    if (next) {
      this.apply(next);
      return;
    }
    this.missingRuns.add(event.runId);
    const generation = this.generation;
    void this.fetchRun(event.runId).catch((error) => {
      if (generation === this.generation) {
        this.failSync(error);
      }
    });
  };
  private fetchRun(runId: string) {
    if (this.loadingRuns.has(runId)) {
      return ensure(this.loadingRuns.get(runId), "Missing in-flight AI task snapshot");
    }
    const generation = this.generation;
    const loading = aiChatRequest<AiTask>(this.url(`/runs/${runId}`))
      .then((task) => {
        if (generation !== this.generation) {
          return;
        }
        this.apply(task);
        this.missingRuns.delete(runId);
      })
      .finally(() => {
        if (this.loadingRuns.get(runId) === loading) {
          this.loadingRuns.delete(runId);
        }
      });
    this.loadingRuns.set(runId, loading);
    return loading;
  }
  /** UI subscriptions and in-flight work own the connection, not project mounting. */
  retain() {
    const refreshDirectory = !this.viewers && this.connected && !this.booting && this.branchReady;
    this.viewers++;
    this.connect();
    if (refreshDirectory) {
      void this.restoreBranch();
    }
    let released = false;
    return () => {
      if (!released) {
        released = true;
        this.viewers--;
        this.disconnectIfIdle();
      }
    };
  }
  private disconnectIfIdle() {
    if (!this.viewers && !this.sending && !this.undoing && !this.activeRun && !this.executing && !this.receipts.size) {
      this.disconnect();
    }
  }
  private connect() {
    if (this.connected) {
      return;
    }
    this.connected = true;
    this.generation++;
    this.syncing = false;
    this.subscribed = false;
    this.snapshotLoaded = false;
    this.nextSyncAt = 0;
    this.syncRetryDelay = 0;
    this.syncError = undefined;
    const generation = this.generation;
    this.booting = true;
    this.socket = io({ path: "/api/v1/socket", transports: ["websocket"] });
    this.socket.on("connect", () => {
      this.socket?.emit(
        "subscribe",
        {
          namespace: "projects",
          projectIds: [this.projectId],
          studio: false,
        },
        () => {
          if (!this.connected || generation !== this.generation) {
            return;
          }
          this.subscribed = true;
          this.nextSyncAt = 0;
          void this.sync();
        },
      );
    });
    this.socket.on("disconnect", () => {
      this.subscribed = false;
    });
    this.socket.on("aiChat", (event: AiEvent) => {
      if (generation !== this.generation) {
        return;
      }
      if (event.projectId !== this.projectId) {
        return;
      }
      if (this.booting) {
        this.buffer.push(event);
        return;
      }
      this.cursor.accept(event, this.applyEvent);
      if (this.cursor.gap) {
        void this.sync();
      }
    });
    this.initializing = this.initialize(this.branchReady);
    this.notify();
    this.timer = setInterval(() => {
      if (!this.subscribed || !this.snapshotLoaded || this.syncRetryDelay || this.cursor.gap || this.missingRuns.size) {
        void this.sync();
      }
      void this.executePending().finally(() => this.disconnectIfIdle());
    }, 1000);
  }
  disconnect() {
    if (!this.connected) {
      return;
    }
    this.connected = false;
    this.subscribed = false;
    this.generation++;
    this.editorSessionId = undefined;
    if (this.timer) {
      clearInterval(this.timer);
    }
    this.timer = undefined;
    this.socket?.close();
    this.socket = undefined;
    this.booting = false;
    this.initializing = undefined;
    this.syncError = undefined;
    this.notify();
  }
  private url(suffix = "") {
    return `/api/v1/projects/${encodeURIComponent(this.projectId)}/ai/chat${suffix}`;
  }
  private async initialize(refreshDirectory = false) {
    this.booting = true;
    const generation = this.generation;
    try {
      const page = await aiChatRequest<{
        tasks: AiTask[];
        seq: number;
        before?: string;
      }>(this.url());
      if (!this.connected || generation !== this.generation) {
        return;
      }
      for (const task of this.tasks) {
        if (task.status === "running" && !page.tasks.some((next) => next.id === task.id)) {
          this.missingRuns.add(task.id);
        }
      }
      page.tasks.forEach((task) => this.apply(task));
      this.cursor.reset(page.seq);
      this.snapshotLoaded = true;
      this.booting = false;
      for (const event of this.buffer) {
        this.cursor.accept(event, this.applyEvent);
      }
      this.buffer = [];
      this.notify();
      await this.sync();
      if (refreshDirectory && this.viewers && generation === this.generation) {
        await this.restoreBranch();
      }
    } catch (error) {
      if (generation === this.generation) {
        this.booting = false;
        this.failSync(error);
      }
    }
  }
  async loadEarlier() {
    if (!this.before || this.historyLoading) {
      return;
    }
    const generation = this.generation;
    const id = this.activeThreadId;
    const state = this.view(id);
    state.loading = true;
    this.notify();
    try {
      const page = await aiChatRequest<{ tasks: AiTask[]; before?: string }>(
        this.url(
          `?threadId=${encodeURIComponent(id)}&before=${encodeURIComponent(this.before)}`,
        ),
      );
      if (generation !== this.generation) {
        return;
      }
      for (const task of page.tasks) {
        if (!this.tasks.some((t) => t.id === task.id)) {
          this.apply(task);
        }
      }
      state.before = page.before;
    } catch (error) {
      if (generation === this.generation) {
        this.error = normalizeError(error);
      }
    } finally {
      state.loading = false;
      if (generation === this.generation) {
        this.notify();
      }
    }
  }
  private async sync() {
    if (!this.connected || this.booting || this.syncing || Date.now() < this.nextSyncAt) {
      return;
    }
    if (!this.snapshotLoaded) {
      this.initializing = this.initialize(this.branchReady);
      await this.initializing;
      return;
    }
    this.syncing = true;
    const generation = this.generation;
    try {
      let page: AiEvent[];
      do {
        page = await aiChatRequest<AiEvent[]>(
          this.url(`/events?afterSeq=${this.cursor.seq}`),
        );
        if (generation !== this.generation) {
          return;
        }
        for (const event of page) {
          this.cursor.accept(event, this.applyEvent);
        }
      } while (page.length === 100 && this.connected);
      await Promise.all([...this.missingRuns].map((runId) => this.fetchRun(runId)));
      if (generation !== this.generation) {
        return;
      }
      this.syncRetryDelay = 0;
      this.nextSyncAt = this.subscribed ? 0 : Date.now() + 5000;
      if (this.syncError) {
        this.syncError = undefined;
        this.notify();
      }
    } catch (error) {
      if (generation === this.generation) {
        this.failSync(error);
      }
    } finally {
      if (generation === this.generation) {
        this.syncing = false;
      }
    }
  }
  private failSync(error: unknown) {
    this.syncRetryDelay = Math.min(this.syncRetryDelay ? this.syncRetryDelay * 2 : 5000, 30000);
    this.nextSyncAt = Date.now() + this.syncRetryDelay;
    // Keep one error identity throughout an outage; recovery clears the local notice.
    if (!this.syncError) {
      this.syncError = normalizeError(error);
      this.notify();
    }
  }
  private async raw(
    name: "getEditorContext" | "executeLocalEdit",
    input: Record<string, unknown>,
    signal?: AbortSignal,
  ) {
    const tools = ensure(this.getTools(), "The editor session has closed.");
    const result =
      name === "getEditorContext"
        ? await tools._getLocalContext()
        : await tools._executeLocal(input, signal);
    if (!result.success) {
      throw new Error(result.error.message);
    }
    return result.output;
  }
  async run(
    prompt: string,
    pinned?: LocalEditBinding,
    target?: PageGenerationOptions | "auto",
    attachments: LocalAiAttachment[] = [],
    model?: string,
    threadId = this.activeThreadId,
  ) {
    if (this.running || !prompt.trim()) {
      return;
    }
    this.sending = true;
    this.notify();
    const author = this.userId;
    const submittedDraft = this.view(threadId).draft;
    const clientRequestId = crypto.randomUUID();
    try {
      const context = PROTOTYPE_TOOL_META.getEditorContext.outputSchema.parse(
        JSON.parse(await this.raw("getEditorContext", {})),
      );
      if (!context.canEdit || context.projectId !== this.projectId) {
        throw new Error("Open an editable current project to use AI.");
      }
      this.connect();
      await this.initializing;
      if (this.userId !== author) {
        return;
      }
      if (!this.snapshotLoaded || this.syncError) {
        throw this.syncError ?? new UserError("AI conversations have not loaded.", "");
      }
      if (this.blockingTask) {
        throw new UserError("Finish or reconcile the active AI task before sending another request.", "");
      }
      const thread = this.threadsById.get(threadId);
      if (thread?.archivedAt) {
        throw new Error(
          "Restore this conversation before sending another message.",
        );
      }
      if (thread && thread.branchId !== context.branchId) {
        throw new Error(
          "Choose a conversation in the current branch before sending.",
        );
      }
      const binding = pinned ?? {
        projectId: this.projectId,
        branchId: context.branchId,
        sessionId: context.sessionId,
        changeCounter: context.changeCounter,
        componentUuid: context.componentUuid,
        ...(context.editorView?.arenaType === "custom"
          ? { canvasName: context.editorView.arenaId }
          : {}),
        elementUuids: context.selectedElementUuids,
        frameUuid: context.frameUuid,
      };
      const body = {
        clientRequestId,
        threadId,
        prompt,
        binding,
        target,
        attachments,
        model,
        context: JSON.stringify(context),
      };
      // Transport retry keeps the same identity, including the initial placeholder.
      let task: AiTask;
      try {
        task = await aiChatRequest<AiTask>(this.url(), body);
      } catch {
        task = await aiChatRequest<AiTask>(this.url(), body);
      }
      if (this.userId !== author) {
        return;
      }
      this.apply(task);
      if (this.view(threadId).draft === submittedDraft) {
        this.view(threadId).draft = { prompt: "", attachments: [] };
      }
      if (this.activeThreadId === threadId) {
        this.rememberThread();
      }
    } catch (error) {
      this.error = normalizeError(error);
      this.notify();
    } finally {
      this.sending = false;
      this.notify();
      this.disconnectIfIdle();
    }
  }
  stop() {
    const task = this.tasks.find((t) => t.status === "running");
    if (task && task.threadId === this.activeThreadId && this.canStop(task)) {
      const generation = this.generation;
      this.stoppedRuns.add(task.id);
      this.executionController?.abort();
      void aiChatRequest<AiTask>(this.url(`/runs/${task.id}/stop`), {})
        .then((next) => {
          if (generation === this.generation) {
            this.apply(next);
          }
        })
        .catch((error) => {
          if (generation === this.generation) {
            this.error = normalizeError(error);
            this.notify();
          }
        });
    }
  }
  private async executePending() {
    if (!this.connected || this.executing || !this.getTools()) {
      return;
    }
    this.executing = true;
    const author = this.userId;
    try {
      // Retry receipts before acquiring more work. The operation is never executed twice.
      for (const [id, ack] of this.receipts) {
        await aiChatRequest(
          this.url(`/tools/${encodeURIComponent(id)}/receipt`),
          ack,
        );
        this.receipts.delete(id);
      }
      const context = PROTOTYPE_TOOL_META.getEditorContext.outputSchema.parse(
        JSON.parse(await this.raw("getEditorContext", {})),
      );
      if (this.editorSessionId !== context.sessionId) {
        this.editorSessionId = context.sessionId;
        this.notify();
      }
      if (!this.tasks.some((t) => t.status === "running")) {
        return;
      }
      if (!context.canEdit || context.projectId !== this.projectId) {
        return;
      }
      const { call } = await aiChatRequest<{ call?: AiToolCall }>(
        this.url("/claim"),
        { sessionId: context.sessionId },
      );
      if (this.userId !== author || !call || this.executed.has(call.id)) {
        return;
      }
      this.executed.add(call.id);
      const ack: {
        sessionId: string;
        fence: number;
        result?: LocalEditToolResult;
        error?: string;
        uncertain?: boolean;
      } = { sessionId: context.sessionId, fence: call.fence };
      const controller = new AbortController();
      this.executionController = controller;
      const heartbeat = setInterval(() => {
        void aiChatRequest(
          this.url(`/tools/${encodeURIComponent(call.id)}/heartbeat`),
          { sessionId: context.sessionId, fence: call.fence },
        ).catch(() => undefined);
      }, 5000);
      try {
        if (this.stoppedRuns.has(call.runId)) {
          controller.abort();
        }
        controller.signal.throwIfAborted();
        ack.result = JSON.parse(
          await this.raw(
            "executeLocalEdit",
            {
              binding: call.binding,
              name: call.name,
              input: call.input,
              execution: { operationId: call.id, fence: call.fence },
            },
            controller.signal,
          ),
        );
        if (ack.result?.changed && this.userId === author) {
          this.localRecords.add(call.id);
        }
      } catch (error) {
        ack.error = normalizeError(error).message;
        try {
          const current =
            PROTOTYPE_TOOL_META.getEditorContext.outputSchema.parse(
              JSON.parse(await this.raw("getEditorContext", {})),
            );
          ack.uncertain = current.changeCounter !== call.binding.changeCounter;
        } catch {
          ack.uncertain = true;
        }
      } finally {
        clearInterval(heartbeat);
        this.executionController = undefined;
      }
      if (this.userId !== author) {
        return;
      }
      this.receipts.set(call.id, ack);
      await aiChatRequest(
        this.url(`/tools/${encodeURIComponent(call.id)}/receipt`),
        ack,
      );
      this.receipts.delete(call.id);
    } catch {
      /* Offline work waits; an uncertain dispatched operation is never repeated. */
    } finally {
      this.executing = false;
    }
  }
  async locate(task: AiTask, node: NonNullable<AiTask["nodes"]>[number]) {
    try {
      const context = PROTOTYPE_TOOL_META.getEditorContext.outputSchema.parse(
        JSON.parse(await this.raw("getEditorContext", {})),
      );
      if (context.branchId !== (node.branch ?? task.binding.branchId)) {
        throw new Error("Open the message's branch to locate this node.");
      }
      const tools = ensure(this.getTools(), "The editor session has closed.");
      const componentUuid = node.page ?? task.binding.componentUuid;
      const navigation = await tools.navigate({ componentUuid });
      if (!navigation.success) {
        throw new Error(navigation.error.message);
      }
      const result = await tools.selectElement({
        componentUuid,
        elementUuid: node.uuid,
      });
      if (!result.success) {
        throw new Error(result.error.message);
      }
    } catch (error) {
      this.error = normalizeError(error);
      this.notify();
    }
  }
  async reconcile(task: AiTask) {
    const generation = this.generation;
    try {
      const context = PROTOTYPE_TOOL_META.getEditorContext.outputSchema.parse(
        JSON.parse(await this.raw("getEditorContext", {})),
      );
      const binding = {
        projectId: context.projectId,
        branchId: context.branchId,
        sessionId: context.sessionId,
        changeCounter: context.changeCounter,
        componentUuid: context.componentUuid,
        elementUuids: context.selectedElementUuids,
        frameUuid: context.frameUuid,
      };
      const next = await aiChatRequest<AiTask>(
        this.url(`/runs/${task.id}/reconcile`),
        {
          binding,
          revision: ensure(
            context.revision,
            "Saved design revision is missing",
          ),
        },
      );
      if (generation === this.generation) {
        this.apply(next);
      }
    } catch (error) {
      this.error = normalizeError(error);
      this.notify();
    }
  }
  async retry(task: AiTask) {
    if (this.running || task.needsReconciliation || !this.canStop(task)) {
      return;
    }
    try {
      const tools = ensure(this.getTools(), "The editor session has closed.");
      let context = PROTOTYPE_TOOL_META.getEditorContext.outputSchema.parse(
        JSON.parse(await this.raw("getEditorContext", {})),
      );
      if (context.branchId !== task.binding.branchId) {
        throw new Error("Open the message's branch before retrying.");
      }
      if (task.binding.canvasName !== undefined) {
        const navigated = await tools.navigateCanvas({
          canvasName: task.binding.canvasName,
        });
        if (!navigated.success) {
          throw new Error(navigated.error.message);
        }
        context = PROTOTYPE_TOOL_META.getEditorContext.outputSchema.parse(
          JSON.parse(await this.raw("getEditorContext", {})),
        );
      } else if (task.binding.componentUuid) {
        const navigated = await tools.navigate({
          componentUuid: task.binding.componentUuid,
        });
        if (!navigated.success) {
          throw new Error(navigated.error.message);
        }
        const checked = await tools.read({
          componentUuids: [task.binding.componentUuid],
        });
        if (!checked.success) {
          throw new Error(checked.error.message);
        }
        context = PROTOTYPE_TOOL_META.getEditorContext.outputSchema.parse(
          JSON.parse(await this.raw("getEditorContext", {})),
        );
      }
      const { readAiAttachment } =
        await import("@/wab/client/components/copilot/AiAttachments");
      const attachments: LocalAiAttachment[] = [];
      for (const file of task.files) {
        const response = await fetch(this.url(`/attachments/${file.id}`), {
          credentials: "same-origin",
        });
        if (!response.ok) {
          throw new Error("Attachment is not accessible.");
        }
        attachments.push(
          await readAiAttachment(
            new File([await response.blob()], file.name, {
              type: file.mediaType,
            }),
          ),
        );
      }
      const binding = {
        ...task.binding,
        sessionId: context.sessionId,
        changeCounter: context.changeCounter,
        frameUuid: context.frameUuid,
      };
      await this.selectThread(task.threadId);
      this.draft = { prompt: task.prompt, attachments };
      await this.run(
        task.prompt,
        binding,
        task.binding.mode === "page" && !task.binding.componentUuid
          ? "auto"
          : undefined,
        attachments,
        this.selectedModel ?? task.model,
        task.threadId,
      );
    } catch (error) {
      this.error = normalizeError(error);
      this.notify();
    }
  }
  async undo(task: AiTask, record: EditRecord) {
    if (this.running || record.undone || !this.canUndo(record)) {
      return;
    }
    const generation = this.generation;
    this.undoing = true;
    this.notify();
    let operation: AiToolCall | undefined;
    try {
      operation = await aiChatRequest<AiToolCall>(
        this.url(`/runs/${task.id}/undo`),
        { recordId: record.id, clientRequestId: crypto.randomUUID() },
      );
      if (operation.status !== "completed") {
        const output: LocalEditToolResult = JSON.parse(
          await this.raw("executeLocalEdit", {
            binding: operation.binding,
            name: "undo",
            input: operation.input,
            execution: { operationId: operation.id, fence: operation.fence },
          }),
        );
        const ack = {
          sessionId: operation.binding.sessionId,
          fence: operation.fence,
          result: output,
        };
        this.receipts.set(operation.id, ack);
        await aiChatRequest(
          this.url(`/tools/${encodeURIComponent(operation.id)}/receipt`),
          ack,
        );
        this.receipts.delete(operation.id);
      }
      const next = await aiChatRequest<AiTask>(this.url(`/runs/${task.id}`));
      if (generation === this.generation) {
        this.apply(next);
      }
    } catch (error) {
      this.error = normalizeError(error);
      if (operation && !this.receipts.has(operation.id)) {
        const ack = {
          sessionId: operation.binding.sessionId,
          fence: operation.fence,
          error: this.error?.message,
          uncertain: true,
        };
        this.receipts.set(operation.id, ack);
      }
    } finally {
      this.undoing = false;
      this.notify();
    }
  }
}
const sessions = new Map<string, LocalEditSession>();
export function getLocalEditSession(projectId: string) {
  let session = sessions.get(projectId);
  if (!session) {
    session = new LocalEditSession(projectId);
    sessions.set(projectId, session);
  }
  return session;
}
