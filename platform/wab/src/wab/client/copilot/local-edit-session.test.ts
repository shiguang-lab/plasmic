import type { PlasmicAiTools } from "@/wab/client/components/studio/TopFrameCopilotToolsBridge";
import {
  AiEventCursor,
  LocalEditSession,
  aiChatRequest,
} from "@/wab/client/copilot/local-edit-session";
import type { AiEvent, AiTask } from "@/wab/shared/copilot/ai-chat";
import { mock } from "vitest-mock-extended";
const task: AiTask = {
  id: "run",
  authorId: "user",
  createdAt: "2026-10-13T00:00:00Z",
  prompt: "hello",
  files: [],
  parts: [],
  status: "running",
  phase: "Thinking",
  messages: [],
  records: [],
  operations: [],
  binding: {
    projectId: "project",
    sessionId: "session",
    branchId: null,
    changeCounter: 0,
    componentUuid: "page",
    elementUuids: [],
  },
};
const event = (seq: number): AiEvent => ({
  projectId: "project",
  runId: task.id,
  seq,
  task: { ...task, phase: `step ${seq}` },
});
it("does not advance across gaps and applies duplicate and out-of-order events exactly once", () => {
  const cursor = new AiEventCursor();
  const apply = vi.fn();
  cursor.accept(event(3), apply);
  cursor.accept(event(2), apply);
  expect(cursor.seq).toBe(0);
  expect(apply).not.toHaveBeenCalled();
  expect(cursor.gap).toBe(true);
  cursor.accept(event(1), apply);
  cursor.accept(event(2), apply);
  expect(cursor.seq).toBe(3);
  expect(apply.mock.calls.map(([e]) => e.task.phase)).toEqual([
    "step 1",
    "step 2",
    "step 3",
  ]);
  expect(cursor.gap).toBe(false);
});
it("reconciles live events buffered during the history snapshot", () => {
  const cursor = new AiEventCursor();
  const apply = vi.fn();
  cursor.accept(event(12), apply);
  cursor.reset(10);
  cursor.accept(event(11), apply);
  expect(cursor.seq).toBe(12);
  expect(apply).toHaveBeenCalledTimes(2);
  cursor.accept(event(10), apply);
  expect(apply).toHaveBeenCalledTimes(2);
});
it("keeps drafts and model preferences local and notifies subscribers", () => {
  const session = new LocalEditSession("project");
  const notify = vi.fn();
  const unsubscribe = session.subscribe(notify);
  session.selectedModel = "model";
  session.selectedModel = "model";
  expect(notify).toHaveBeenCalledTimes(1);
  session.draft = {
    prompt: "Draft",
    attachments: [{ type: "text", name: "spec.md", text: "spec" }],
  };
  expect(session.draft.prompt).toBe("Draft");
  expect(session.tasks).toEqual([]);
  unsubscribe();
  session.draft = { prompt: "", attachments: [] };
  expect(notify).toHaveBeenCalledTimes(2);
});
it("does not expose native undo for historical operations", () => {
  const session = new LocalEditSession("project");
  expect(
    session.canUndo({
      id: "historical",
      name: "changeElement",
      input: {},
      before: "",
      after: "",
      binding: task.binding,
    }),
  ).toBe(false);
});
it("discards an earlier-history response after the account changes", async () => {
  const session = new LocalEditSession("project");
  session.userId = "original";
  session.before = "cursor";
  const { promise, resolve } = Promise.withResolvers<unknown>();
  vi.stubGlobal("fetch", vi.fn().mockReturnValue(promise));
  try {
    const loading = session.loadEarlier();
    session.userId = "another";
    resolve({
      ok: true,
      json: async () => ({ tasks: [task], before: "old-cursor" }),
    });
    await loading;
    expect(session.tasks).toEqual([]);
    expect(session.before).toBeUndefined();
  } finally {
    vi.unstubAllGlobals();
  }
});

it("accepts a failed tool receipt as acknowledged data and does not retry it forever", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: "failed", error: "Tool input rejected" }),
    }),
  );
  try {
    await expect(aiChatRequest("/receipt", {})).resolves.toEqual({
      status: "failed",
      error: "Tool input rejected",
    });
  } finally {
    vi.unstubAllGlobals();
  }
});
it("rejects authorization failures using the HTTP status", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => ({ error: { message: "Forbidden" } }),
    }),
  );
  try {
    await expect(aiChatRequest("/receipt", {})).rejects.toThrow("Forbidden");
  } finally {
    vi.unstubAllGlobals();
  }
});

it("retains the classification of a non-JSON authorization response", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => {
        throw new SyntaxError("HTML response");
      },
    }),
  );
  try {
    await expect(aiChatRequest("/receipt", {})).rejects.toMatchObject({
      statusCode: 403,
    });
  } finally {
    vi.unstubAllGlobals();
  }
});

it("locates a structured node on its referenced page without editing the design", async () => {
  const tools = mock<PlasmicAiTools>();
  tools._getLocalContext.mockResolvedValue({
    success: true,
    output: JSON.stringify({
      projectName: "Project",
      projectId: "project",
      branchId: null,
      sessionId: "session",
      changeCounter: 0,
      browserImportCanvasName: "Browser Import",
      componentUuid: "page",
      frameUuid: null,
      selectedElementUuids: [],
      instanceIndex: null,
      mode: "edit",
      canEdit: true,
      editorView: null,
      selectedSlot: null,
      previewContext: null,
      path: [],
    }),
  });
  for (const tool of [
    tools.navigate,
    tools.selectElement,
    tools.scrollElementIntoView,
  ]) {
    tool.mockResolvedValue({ success: true, output: "{}" });
  }
  const session = new LocalEditSession("project", () => tools);
  await session.locate(task, {
    uuid: "node",
    name: "StatusFilter",
    page: "other-page",
    branch: null,
  });
  expect(session.error).toBeUndefined();
  expect(tools.navigate).toHaveBeenCalledWith({ componentUuid: "other-page" });
  expect(tools.selectElement).toHaveBeenCalledWith({
    componentUuid: "other-page",
    elementUuid: "node",
  });
  expect(tools.scrollElementIntoView).toHaveBeenCalledWith({
    componentUuid: "other-page",
    elementUuid: "node",
  });
  expect(tools._executeLocal).not.toHaveBeenCalled();
});

it("reports a deleted node and does not try to scroll it into view", async () => {
  const tools = mock<PlasmicAiTools>();
  tools._getLocalContext.mockResolvedValue({
    success: true,
    output: JSON.stringify({
      projectName: "Project",
      projectId: "project",
      branchId: null,
      sessionId: "session",
      changeCounter: 0,
      browserImportCanvasName: "Browser Import",
      componentUuid: "page",
      frameUuid: null,
      selectedElementUuids: [],
      instanceIndex: null,
      mode: "edit",
      canEdit: true,
      editorView: null,
      selectedSlot: null,
      previewContext: null,
      path: [],
    }),
  });
  tools.navigate.mockResolvedValue({ success: true, output: "{}" });
  tools.selectElement.mockResolvedValue({
    success: false,
    error: { type: "EXECUTION_FAILED", message: "Element no longer exists." },
  });
  const session = new LocalEditSession("project", () => tools);
  await session.locate(task, {
    uuid: "deleted",
    name: "StatusFilter",
    page: "page",
    branch: null,
  });
  expect(session.error?.message).toBe("Element no longer exists.");
  expect(tools.scrollElementIntoView).not.toHaveBeenCalled();
});

it.each(["send", "retry"] as const)(
  "keeps an unfocused canvas binding during %s",
  async (action) => {
    const tools = mock<PlasmicAiTools>();
    tools._getLocalContext.mockResolvedValue({
      success: true,
      output: JSON.stringify({
        projectName: "Project",
        projectId: "project",
        branchId: null,
        sessionId: "session",
        changeCounter: 0,
      browserImportCanvasName: "Browser Import",
        componentUuid: null,
        frameUuid: null,
        selectedElementUuids: [],
        instanceIndex: null,
        mode: "edit",
        canEdit: true,
        editorView: {
          arenaId: "PageGroup",
          arenaType: "custom",
          frameUuid: null,
          scale: 1,
          scroll: { x: 0, y: 0 },
        },
        selectedSlot: null,
        previewContext: null,
        path: [],
      }),
    });
    const session = new LocalEditSession("project", () => tools);
    session.userId = "user";
    const binding = {
      ...task.binding,
      componentUuid: null,
      canvasName: "PageGroup",
    };
    if (action === "retry") {
      tools.navigateCanvas.mockResolvedValue({ success: true, output: "{}" });
      const run = vi.spyOn(session, "run").mockResolvedValue(undefined);
      await session.retry({ ...task, status: "failed", binding });
      expect(tools.navigateCanvas).toHaveBeenCalledWith({
        canvasName: "PageGroup",
      });
      expect(tools.navigate).not.toHaveBeenCalled();
      expect(run).toHaveBeenCalledWith(
        task.prompt,
        expect.objectContaining(binding),
        undefined,
        [],
        undefined,
      );
    } else {
      const request = vi
        .fn()
        .mockResolvedValue({ ok: true, json: async () => task });
      vi.stubGlobal("fetch", request);
      try {
        await session.run("Update this canvas");
        expect(session.error).toBeUndefined();
        const body = JSON.parse(request.mock.calls[0][1].body);
        expect(body.binding).toMatchObject(binding);
        expect(body.target).toBeUndefined();
      } finally {
        vi.unstubAllGlobals();
      }
    }
  },
);

it.each(["run", "retry", "locate"] as const)(
  "rejects incomplete editor context before %s can dispatch any work",
  async (action) => {
    const tools = mock<PlasmicAiTools>();
    tools._getLocalContext.mockResolvedValue({
      success: true,
      output: JSON.stringify({
        projectName: "Project", projectId: "project", branchId: null,
        sessionId: "session", changeCounter: 0, componentUuid: "page",
        frameUuid: null, selectedElementUuids: [], instanceIndex: null,
        mode: "edit", canEdit: true, editorView: null,
        selectedSlot: null, previewContext: null, path: [],
      }),
    });
    const request = vi.fn();
    vi.stubGlobal("fetch", request);
    try {
      const session = new LocalEditSession("project", () => tools);
      session.userId = "user";
      if (action === "run") {
        await session.run("Update this page");
      } else if (action === "retry") {
        await session.retry({ ...task, status: "failed" });
      } else {
        await session.locate(task, { uuid: "node", name: "Node", page: "page", branch: null });
      }
      expect(session.error).toMatchObject({
        name: "ZodError",
        issues: [expect.objectContaining({ path: ["browserImportCanvasName"] })],
      });
      expect(request).not.toHaveBeenCalled();
      expect(tools.navigate).not.toHaveBeenCalled();
      expect(tools.navigateCanvas).not.toHaveBeenCalled();
      expect(tools.selectElement).not.toHaveBeenCalled();
      expect(tools.scrollElementIntoView).not.toHaveBeenCalled();
      expect(tools._executeLocal).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  },
);
