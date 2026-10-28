import { modelStep } from "@/wab/server/copilot/ai-activities";
import type { AiTask } from "@/wab/shared/copilot/ai-chat";
const state = vi.hoisted(() => ({
  task: undefined as AiTask | undefined,
  snapshots: [] as AiTask[],
}));
vi.mock("typeorm", () => ({
  getConnection: () => ({
    query: async () => [],
    transaction: async (callback: (db: unknown) => unknown) =>
      callback({ query: async () => [] }),
  }),
}));
vi.mock("@temporalio/activity", () => ({
  heartbeat: () => {},
  Context: {
    current: () => ({ cancellationSignal: new AbortController().signal }),
  },
}));
vi.mock("@/wab/server/copilot/ai-store", () => ({
  lockRun: async () => ({ status: "running", task: state.task }),
  getRun: async () => ({
    status: "running",
    projectId: "project",
    request: { context: "{}" },
    task: state.task,
  }),
  emitTask: async (_db: unknown, task: AiTask) => {
    state.snapshots.push(structuredClone(task));
  },
}));
vi.mock("@/wab/server/copilot/local-edit", () => ({
  generateLocalEditStep: async (
    _request: unknown,
    _channel: string,
    _signal: unknown,
    emit: (part: unknown) => Promise<void>,
  ) => {
    await emit({ type: "reasoning", text: "Thought summary", complete: false });
    await emit({ type: "reasoning", text: "", complete: true });
    await emit({ type: "markdown", text: "Output", complete: false });
    await emit({ type: "markdown", text: "", complete: true });
    return { text: "Output", reasoning: "Thought summary", calls: [] };
  },
}));
it("persists reasoning, channels, steps and completion without merging model turns", async () => {
  state.task = {
    id: "run",
    threadId: "thread",
    authorId: "owner",
    createdAt: "2026-10-14",
    prompt: "Read page",
    files: [],
    parts: [],
    messages: [],
    records: [],
    operations: [],
    binding: {
      projectId: "project",
      componentUuid: "page",
      branchId: null,
      sessionId: "session",
      changeCounter: 0,
      elementUuids: [],
    },
    phase: "Thinking",
    status: "running",
  };
  await modelStep("run", 0, [], "commentary");
  await modelStep("run", 1, [], "answer");
  expect(state.task.parts).toEqual([
    { type: "reasoning", step: 0, text: "Thought summary", complete: true },
    {
      type: "markdown",
      channel: "commentary",
      step: 0,
      text: "Output",
      complete: true,
    },
    { type: "reasoning", step: 1, text: "Thought summary", complete: true },
    {
      type: "markdown",
      channel: "answer",
      step: 1,
      text: "Output",
      complete: true,
    },
  ]);
  expect(
    state.snapshots.some((task) =>
      task.parts.some((part) => part.type === "reasoning"),
    ),
  ).toBe(true);
  expect(state.task.messages).toEqual(["Output", "Output"]);
});
