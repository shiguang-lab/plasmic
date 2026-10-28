import { applyAiEvent, type AiTask } from "@/wab/shared/copilot/ai-chat";
const task: AiTask = {
  id: "run",
  threadId: "thread",
  seq: 1,
  authorId: "user",
  createdAt: "2026-10-14",
  prompt: "Read",
  files: [],
  parts: [{ type: "reasoning", step: 0, text: "Inspect", complete: false }],
  messages: [],
  records: [],
  operations: [],
  phase: "Thinking",
  status: "running",
  binding: {
    projectId: "project",
    sessionId: "session",
    branchId: null,
    componentUuid: "page",
    elementUuids: [],
    changeCounter: 0,
  },
};
it("replays reasoning deltas and typed text without turning summaries into assistant prose", () => {
  const next = applyAiEvent(task, {
    projectId: "project",
    runId: "run",
    seq: 2,
    update: {
      baseSeq: 1,
      fields: {},
      textDeltas: [{ index: 0, text: " results" }],
      replaceParts: [],
      appendParts: [
        {
          type: "markdown",
          channel: "commentary",
          step: 0,
          text: "Read the fields",
          complete: true,
        },
      ],
      appendRecords: [],
      replaceRecords: [],
      operations: [],
    },
  });
  expect(next?.parts[0]).toMatchObject({
    type: "reasoning",
    text: "Inspect results",
  });
  expect(next?.messages).toEqual(["Read the fields"]);
  const completed = applyAiEvent(next, {
    projectId: "project",
    runId: "run",
    seq: 3,
    update: {
      baseSeq: 2,
      fields: { status: "completed" },
      textDeltas: [],
      replaceParts: [
        {
          index: 0,
          part: {
            type: "reasoning",
            step: 0,
            text: "Inspect results",
            complete: true,
          },
        },
      ],
      appendParts: [
        {
          type: "markdown",
          channel: "answer",
          step: 1,
          text: "Three fields",
          complete: true,
        },
      ],
      appendRecords: [],
      replaceRecords: [],
      operations: [],
    },
  });
  expect(completed?.parts[0]).toMatchObject({ complete: true });
  expect(completed?.parts[2]).toMatchObject({
    channel: "answer",
    complete: true,
  });
});
