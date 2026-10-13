import { normalizeError } from "@/wab/client/ErrorNotifications";
import type { PlasmicAiTools } from "@/wab/client/components/studio/TopFrameCopilotToolsBridge";
import { deserializeApiError } from "@/wab/shared/ApiErrors/errors";
import { ensure } from "@/wab/shared/common";
import type {
  AiEvent,
  AiTask,
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
  const response = await fetch(url, {
    method: body === undefined ? "GET" : "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const result = await response.json().catch((error) => {
    if (!response.ok) {
      return {};
    }
    throw error;
  });
  if (!response.ok) {
    throw deserializeApiError(result.error, response.status);
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
  before?: string;
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
    this._draft = { prompt: "", attachments: [] };
    this._selectedModel = undefined;
    this.tasks = [];
    this.receipts.clear();
    this.localRecords.clear();
    this.editorSessionId = undefined;
    this.error = undefined;
    this.before = undefined;
    this.cursor = new AiEventCursor();
    this.buffer = [];
    this.missingRuns.clear();
    this.notify();
  }
  private _draft: LocalAiDraft = { prompt: "", attachments: [] };
  get draft() {
    return this._draft;
  }
  set draft(value: LocalAiDraft) {
    this._draft = value;
    this.notify();
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
  private executing = false;
  private sending = false;
  private undoing = false;
  private executionController?: AbortController;
  private stoppedRuns = new Set<string>();
  private booting = false;
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
    return (
      this.sending ||
      this.undoing ||
      this.tasks.some((task) => task.status === "running")
    );
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
    this.notify();
  };
  private loadingRuns = new Set<string>();
  private missingRuns = new Set<string>();
  private applyEvent = (event: AiEvent) => {
    const task = this.tasks.find((candidate) => candidate.id === event.runId);
    const next = applyAiEvent(task, event);
    if (next) {
      this.apply(next);
      return;
    }
    this.missingRuns.add(event.runId);
    this.fetchRun(event.runId);
  };
  private fetchRun(runId: string) {
    if (this.loadingRuns.has(runId)) {
      return;
    }
    this.loadingRuns.add(runId);
    const generation = this.generation;
    void aiChatRequest<AiTask>(this.url(`/runs/${runId}`))
      .then((task) => {
        if (generation !== this.generation) {
          return;
        }
        this.apply(task);
        this.missingRuns.delete(runId);
      })
      .catch((error) => {
        if (generation === this.generation) {
          this.error = normalizeError(error);
          this.notify();
        }
      })
      .finally(() => {
        this.loadingRuns.delete(runId);
      });
  }
  connect() {
    if (this.connected) {
      return;
    }
    this.connected = true;
    this.generation++;
    this.syncing = false;
    const generation = this.generation;
    this.booting = true;
    this.socket = io({ path: "/api/v1/socket", transports: ["websocket"] });
    this.socket.on("connect", () => {
      this.socket?.emit("subscribe", {
        namespace: "projects",
        projectIds: [this.projectId],
        studio: false,
      });
      void this.sync();
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
    void this.initialize();
    this.timer = setInterval(() => {
      void this.sync();
      void this.executePending();
    }, 1000);
  }
  disconnect() {
    this.connected = false;
    this.generation++;
    this.editorSessionId = undefined;
    if (this.timer) {
      clearInterval(this.timer);
    }
    this.timer = undefined;
    this.socket?.close();
    this.socket = undefined;
  }
  private url(suffix = "") {
    return `/api/v1/projects/${encodeURIComponent(this.projectId)}/ai/chat${suffix}`;
  }
  private async initialize() {
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
      this.tasks = page.tasks;
      this.before = page.before;
      this.cursor.reset(page.seq);
      this.booting = false;
      for (const event of this.buffer) {
        this.cursor.accept(event, this.applyEvent);
      }
      this.buffer = [];
      this.notify();
      await this.sync();
    } catch (error) {
      if (generation === this.generation) {
        this.error = normalizeError(error);
        this.booting = false;
        this.notify();
      }
    }
  }
  async loadEarlier() {
    if (!this.before) {
      return;
    }
    const generation = this.generation;
    const page = await aiChatRequest<{ tasks: AiTask[]; before?: string }>(
      this.url(`?before=${encodeURIComponent(this.before)}`),
    );
    if (generation !== this.generation) {
      return;
    }
    for (const task of page.tasks) {
      if (!this.tasks.some((t) => t.id === task.id)) {
        this.apply(task);
      }
    }
    this.before = page.before;
    this.notify();
  }
  private async sync() {
    if (!this.connected || this.booting || this.syncing) {
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
      this.missingRuns.forEach((runId) => this.fetchRun(runId));
      if (this.error) {
        this.error = undefined;
        this.notify();
      }
    } catch (error) {
      if (generation === this.generation) {
        this.error = normalizeError(error);
        this.notify();
      }
    } finally {
      if (generation === this.generation) {
        this.syncing = false;
      }
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
  ) {
    if (this.running || !prompt.trim()) {
      return;
    }
    this.sending = true;
    this.notify();
    const author = this.userId;
    const clientRequestId = crypto.randomUUID();
    try {
      const context = PROTOTYPE_TOOL_META.getEditorContext.outputSchema.parse(
        JSON.parse(await this.raw("getEditorContext", {})),
      );
      if (!context.canEdit || context.projectId !== this.projectId) {
        throw new Error("Open an editable current project to use AI.");
      }
      const binding = pinned ?? {
        projectId: this.projectId,
        branchId: context.branchId,
        sessionId: context.sessionId,
        changeCounter: context.changeCounter,
        componentUuid: context.componentUuid,
        elementUuids: context.selectedElementUuids,
        frameUuid: context.frameUuid,
      };
      const body = {
        clientRequestId,
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
      this.draft = { prompt: "", attachments: [] };
    } catch (error) {
      this.error = normalizeError(error);
      this.notify();
    } finally {
      this.sending = false;
      this.notify();
    }
  }
  stop() {
    const task = this.tasks.find((t) => t.status === "running");
    if (task && this.canStop(task)) {
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
      for (const name of ["selectElement", "scrollElementIntoView"] as const) {
        const result = await tools[name]({
          componentUuid,
          elementUuid: node.uuid,
        });
        if (!result.success) {
          throw new Error(result.error.message);
        }
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
      if (task.binding.componentUuid) {
        const navigated = await tools.navigate({
          componentUuid: task.binding.componentUuid,
        });
        if (!navigated.success) {
          throw new Error(navigated.error.message);
        }
        const checked = await tools.read(
          task.binding.elementUuids.length
            ? {
                elements: task.binding.elementUuids.map((elementUuid) => ({
                  componentUuid: task.binding.componentUuid,
                  elementUuid,
                })),
              }
            : { componentUuids: [task.binding.componentUuid] },
        );
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
      this.draft = { prompt: task.prompt, attachments };
      await this.run(
        task.prompt,
        task.binding.componentUuid ? binding : undefined,
        task.binding.componentUuid ? undefined : "auto",
        attachments,
        this.selectedModel ?? task.model,
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
