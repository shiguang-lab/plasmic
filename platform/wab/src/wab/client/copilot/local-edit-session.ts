import type { PlasmicAiTools } from "@/wab/client/components/studio/TopFrameCopilotToolsBridge";
import { ensure } from "@/wab/shared/common";
import {
  LocalEditBinding,
  LocalEditRequest,
  LocalEditResponse,
  LocalEditStep,
  LocalEditToolResult,
  localEditBindingSchema,
  localEditCallSchema,
  localEditLimits,
} from "@/wab/shared/copilot/local-edit";
import { PROTOTYPE_TOOL_META } from "@/wab/shared/copilot/prototype-tools";

export type EditRecord = {
  id: string;
  name: string;
  input: Record<string, unknown>;
  before: string;
  after: string;
  binding: LocalEditBinding;
  undone?: boolean;
};
export type EditTask = {
  id: string;
  prompt: string;
  status: "running" | "completed" | "stopped" | "failed";
  phase: string;
  messages: string[];
  records: EditRecord[];
  binding?: LocalEditBinding;
  error?: string;
  savedRevision?: number;
  scopeLabel?: string;
  operations: {
    id: string;
    name: string;
    status: "running" | "completed" | "failed";
  }[];
};
export type PageGenerationOptions = { name: string; path: string };

type Transport = (
  request: LocalEditRequest,
  signal: AbortSignal,
) => Promise<LocalEditResponse>;

export async function localAiFetch<T>(
  projectId: string,
  action: "status" | "step",
  body?: LocalEditRequest,
  signal?: AbortSignal,
): Promise<T> {
  const response = await fetch(
    `/api/v1/projects/${encodeURIComponent(projectId)}/ai/edit/${action}`,
    {
      method: body ? "POST" : "GET",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
      signal,
    },
  );
  const result = await response.json();
  if (!response.ok) {
    throw new Error(result.error?.message ?? "AI request failed.");
  }
  return result as T;
}

/** Browser-only task state. Site data and undo history stay owned by Studio. */
export class LocalEditSession {
  tasks: EditTask[] = [];
  private listeners = new Set<() => void>();
  private controller?: AbortController;
  private busy = false;
  constructor(
    readonly projectId: string,
    private getTools: () => PlasmicAiTools | undefined = () =>
      window.PLASMIC_AI_TOOLS,
    private transport: Transport = (request, signal) =>
      localAiFetch(projectId, "step", request, signal),
  ) {}
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  snapshot = () => this.tasks;
  get running() {
    return this.busy;
  }
  private update(task: EditTask, patch: Partial<EditTask>) {
    Object.assign(task, patch);
    this.tasks = [...this.tasks];
    this.listeners.forEach((listener) => listener());
  }
  stop() {
    this.controller?.abort();
    const task = this.tasks.at(-1);
    if (this.controller && task?.status === "running") {
      this.update(task, { phase: "Stopping" });
    }
  }
  private async raw(
    name: keyof typeof PROTOTYPE_TOOL_META,
    input: Record<string, unknown>,
  ) {
    const tools = ensure(this.getTools(), "The editor session has closed.");
    const result =
      name === "executeLocalEdit"
        ? await tools._executeLocal(input, this.controller?.signal)
        : name === "getEditorContext"
          ? await tools._getLocalContext()
          : await tools[name](input);
    if (!result.success) {
      throw new Error(result.error.message);
    }
    return result.output;
  }
  private async scoped(
    task: EditTask,
    name: string,
    input: Record<string, unknown>,
  ): Promise<LocalEditToolResult> {
    const operation: EditTask["operations"][number] = {
      id: crypto.randomUUID(),
      name,
      status: "running",
    };
    this.update(task, { operations: [...task.operations, operation] });
    try {
      const output: LocalEditToolResult = JSON.parse(
        await this.raw("executeLocalEdit", {
          binding: ensure(task.binding, "Editing scope is missing."),
          name,
          input,
        }),
      );
      operation.status = "completed";
      this.update(task, {
        binding: output.binding,
        operations: [...task.operations],
      });
      return output;
    } catch (error) {
      operation.status = "failed";
      this.update(task, { operations: [...task.operations] });
      throw error;
    }
  }
  private record(
    task: EditTask,
    name: string,
    input: Record<string, unknown>,
    output: LocalEditToolResult,
    id = crypto.randomUUID(),
  ) {
    if (output.changed) {
      this.update(task, {
        records: [
          ...task.records,
          {
            id,
            name,
            input,
            before: output.before ?? "",
            after: output.after ?? "",
            binding: output.binding,
          },
        ],
      });
    }
  }
  async run(
    prompt: string,
    pinned?: LocalEditBinding,
    page?: PageGenerationOptions,
  ) {
    if (this.busy || !prompt.trim()) {
      return;
    }
    this.busy = true;
    const controller = new AbortController();
    this.controller = controller;
    const task: EditTask = {
      id: crypto.randomUUID(),
      prompt: prompt.trim(),
      status: "running",
      phase: "Reading context",
      messages: [],
      records: [],
      operations: [],
    };
    this.tasks = [...this.tasks.slice(-19), task];
    this.update(task, {});
    const checkStopped = () => controller.signal.throwIfAborted();
    try {
      checkStopped();
      const context = PROTOTYPE_TOOL_META.getEditorContext.outputSchema.parse(
        JSON.parse(await this.raw("getEditorContext", {})),
      );
      if (!context.canEdit || context.projectId !== this.projectId) {
        throw new Error("Open an editable current project to use AI.");
      }
      task.binding =
        (!page ? pinned : undefined) ??
        localEditBindingSchema.parse({
          projectId: context.projectId,
          branchId: context.branchId,
          sessionId: context.sessionId,
          changeCounter: context.changeCounter,
          componentUuid: page ? null : context.componentUuid,
          frameUuid: page ? null : context.frameUuid,
          elementUuids: page ? [] : context.selectedElementUuids,
          ...(page ? { mode: "page" } : {}),
        });
      if (page) {
        checkStopped();
        this.update(task, { phase: "Creating page" });
        const input = {
          type: "page",
          name: page.name.trim(),
          path: page.path.trim(),
        };
        const created = await this.scoped(task, "createComponent", input);
        this.record(task, "createComponent", input, created);
        checkStopped();
        await this.scoped(task, "navigate", {
          componentUuid: created.binding.componentUuid,
        });
        checkStopped();
      }
      const binding = ensure(task.binding, "Editing scope is missing.");
      ensure(
        binding.componentUuid,
        "Open a page or select an element before editing.",
      );
      const readInput = binding.elementUuids.length
        ? {
            elements: binding.elementUuids.map((elementUuid) => ({
              componentUuid: binding.componentUuid,
              elementUuid,
            })),
          }
        : { componentUuids: [binding.componentUuid] };
      checkStopped();
      const initial = await this.scoped(task, "read", readInput);
      const scopeNames = JSON.parse(initial.result).results.flatMap(
        (resource: { name?: string; baseVariantTplTree?: string }) => {
          const name =
            resource.name ??
            (resource.baseVariantTplTree
              ? new DOMParser()
                  .parseFromString(resource.baseVariantTplTree, "text/html")
                  .body.firstElementChild?.getAttribute("label")
              : undefined);
          return name ? [name] : [];
        },
      );
      this.update(task, { scopeLabel: scopeNames.join(", ") || undefined });
      checkStopped();
      const overview = await this.scoped(task, "read", {});
      const recent = this.tasks
        .filter(
          (previous) =>
            previous !== task &&
            previous.binding?.componentUuid === binding.componentUuid &&
            previous.binding?.sessionId === binding.sessionId,
        )
        .slice(-3)
        .map((previous) => ({
          request: previous.prompt,
          response: previous.messages.join("\n").slice(-2000),
          status: previous.status,
        }));
      const resources = `${initial.result}\n${overview.result}\nEditor context at submission:\n${JSON.stringify(context)}\nRecent conversation (context only):\n${JSON.stringify(recent)}`;
      const history: LocalEditStep[] = [];
      const completed = new Map<
        string,
        { signature: string; output: string }
      >();
      const started = Date.now();
      const limits = localEditLimits(binding);
      for (let stepIndex = 0; stepIndex < limits.steps; stepIndex++) {
        checkStopped();
        if (Date.now() - started > limits.taskMs) {
          throw new Error(
            "AI task reached its time limit. Completed changes are retained.",
          );
        }
        this.update(task, { phase: "Thinking" });
        const response = await this.transport(
          {
            binding: ensure(task.binding, "Editing scope is missing."),
            prompt: task.prompt,
            resources,
            history,
          },
          controller.signal,
        );
        checkStopped();
        const calls = response.calls.map((call) =>
          localEditCallSchema.parse(call),
        );
        if (response.text) {
          this.update(task, { messages: [...task.messages, response.text] });
        }
        if (!calls.length) {
          break;
        }
        const step: LocalEditStep = { text: response.text, calls, results: [] };
        for (const call of calls) {
          checkStopped();
          const signature = JSON.stringify([call.name, call.input]);
          const previous = completed.get(call.id);
          if (previous) {
            if (previous.signature !== signature) {
              throw new Error(
                "AI reused a tool call identity with different arguments.",
              );
            }
            step.results.push({ id: call.id, output: previous.output });
            continue;
          }
          this.update(task, {
            phase:
              call.name === "selectElement"
                ? "Selecting element"
                : call.name === "scrollElementIntoView"
                  ? "Revealing element"
                  : ["read", "queryElements", "getEditorContext"].includes(
                        call.name,
                      )
                    ? "Reading context"
                    : "Editing selection",
          });
          const output = await this.scoped(task, call.name, call.input);
          this.record(task, call.name, call.input, output, call.id);
          completed.set(call.id, { signature, output: output.result });
          step.results.push({ id: call.id, output: output.result });
          checkStopped();
        }
        history.push(step);
        if (stepIndex === limits.steps - 1) {
          throw new Error(
            "AI task reached its step limit. Completed changes are retained.",
          );
        }
      }
      checkStopped();
      this.update(task, { phase: "Checking structure" });
      const validation = JSON.parse(
        (await this.scoped(task, "validate", {})).result,
      );
      if (!validation.valid) {
        throw new Error(validation.errors.join("; "));
      }
      checkStopped();
      if (task.records.length) {
        this.update(task, { phase: "Saving changes" });
        const saved = JSON.parse((await this.scoped(task, "save", {})).result);
        this.update(task, { savedRevision: saved.revision });
      }
      checkStopped();
      this.update(task, { status: "completed", phase: "Completed" });
    } catch (error) {
      this.update(task, {
        status: controller.signal.aborted ? "stopped" : "failed",
        phase: controller.signal.aborted ? "Stopped" : "Failed",
        error: controller.signal.aborted
          ? undefined
          : error instanceof Error
            ? error.message
            : String(error),
      });
    } finally {
      this.busy = false;
      this.controller = undefined;
      this.update(task, {});
    }
  }
  async undo(task: EditTask, record: EditRecord) {
    if (this.busy || record.undone) {
      return;
    }
    this.busy = true;
    this.update(task, {});
    try {
      // The executor rejects this unless this exact transaction is still last.
      const output: LocalEditToolResult = JSON.parse(
        await this.raw("executeLocalEdit", {
          binding: record.binding,
          name: "undo",
          input: {},
        }),
      );
      record.undone = true;
      this.update(task, {
        binding: output.binding,
        records: [...task.records],
        savedRevision: undefined,
      });
      const saved = JSON.parse((await this.scoped(task, "save", {})).result);
      this.update(task, { savedRevision: saved.revision });
    } catch (error) {
      this.update(task, {
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      this.busy = false;
      this.update(task, {});
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
