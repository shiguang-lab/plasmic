import type { PlasmicAiTools } from "@/wab/client/components/studio/TopFrameCopilotToolsBridge";
import {
  AiEventCursor,
  LocalEditSession,
  aiChatRequest,
} from "@/wab/client/copilot/local-edit-session";
import type { AiEvent, AiTask } from "@/wab/shared/copilot/ai-chat";
import { io, Socket } from "socket.io-client";
import { mock } from "vitest-mock-extended";
vi.mock("socket.io-client", () => ({ io: vi.fn() }));
const task: AiTask = {
  id: "run",
  threadId: "thread",
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

describe("AI event synchronization", () => {
  let socket = mock<Socket>();
  let session: LocalEditSession;
  const listeners = new Map<string, (...args: any[]) => void>();
  const request = vi.fn();
  const history = { tasks: [], seq: 0 };
  const success = (value: unknown) => ({ ok: true, json: async () => value });

  beforeEach(() => {
    vi.useFakeTimers();
    listeners.clear();
    socket = mock<Socket>();
    socket.on.mockImplementation((name, listener) => {
      listeners.set(name, listener);
      return socket;
    });
    vi.mocked(io).mockReturnValue(socket);
    request.mockReset().mockImplementation(async (url: string) => success(url.includes("/events?") ? [] : history));
    vi.stubGlobal("fetch", request);
    session = new LocalEditSession("project");
    session.newThread("thread");
  });

  afterEach(() => {
    session.disconnect();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  async function subscribe() {
    listeners.get("connect")?.();
    const call = socket.emit.mock.calls.at(-1);
    const acknowledge = call?.[2];
    if (typeof acknowledge !== "function") {
      throw new Error("Expected a subscription acknowledgement callback");
    }
    acknowledge();
    await vi.advanceTimersByTimeAsync(0);
  }

  async function start() {
    session.connect();
    await vi.advanceTimersByTimeAsync(0);
    await subscribe();
    request.mockClear();
  }

  it("does not poll while subscribed and applies pushed events", async () => {
    await start();
    listeners.get("aiChat")?.(event(1));
    await vi.advanceTimersByTimeAsync(60000);
    expect(request).not.toHaveBeenCalled();
    expect(session.tasks[0].phase).toBe("step 1");
  });

  it("keeps fallback reads until subscription is acknowledged, then catches up once", async () => {
    session.connect();
    await vi.advanceTimersByTimeAsync(0);
    request.mockClear();
    listeners.get("connect")?.();
    await vi.advanceTimersByTimeAsync(5000);
    expect(request).toHaveBeenCalledTimes(1);
    await subscribe();
    expect(request).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(60000);
    expect(request).toHaveBeenCalledTimes(2);
  });

  it("uses a five-second fallback during disconnection and stops after reconnection", async () => {
    await start();
    listeners.get("disconnect")?.();
    await vi.advanceTimersByTimeAsync(1000);
    expect(request).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(4000);
    expect(request).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1000);
    expect(request).toHaveBeenCalledTimes(2);
    await subscribe();
    expect(request).toHaveBeenCalledTimes(3);
    await vi.advanceTimersByTimeAsync(60000);
    expect(request).toHaveBeenCalledTimes(3);
  });

  it("backs off repeated failures, reports the outage once and clears it on recovery", async () => {
    await start();
    const notice = vi.fn();
    session.subscribe(() => { if (session.error) {notice(session.error);} });
    request.mockResolvedValue({ok: false, status: 502, json: async () => {throw new SyntaxError("Not JSON");}});
    listeners.get("disconnect")?.();
    await vi.advanceTimersByTimeAsync(1000);
    const error = session.error;
    expect(error).toMatchObject({statusCode: 502, request: {method: "GET", url: "/api/v1/projects/project/ai/chat/events?afterSeq=0"}});
    for (const delay of [5000, 10000, 20000, 30000]) {
      const count = request.mock.calls.length;
      await vi.advanceTimersByTimeAsync(delay - 1000);
      expect(request).toHaveBeenCalledTimes(count);
      await vi.advanceTimersByTimeAsync(1000);
      expect(request).toHaveBeenCalledTimes(count + 1);
    }
    expect(session.error).toBe(error);
    expect(notice).toHaveBeenCalledOnce();
    request.mockResolvedValue(success([]));
    await subscribe();
    expect(session.error).toBeUndefined();
    request.mockClear();
    await vi.advanceTimersByTimeAsync(60000);
    expect(request).not.toHaveBeenCalled();
  });

  it("retries the initial history snapshot before reading events after a failed startup", async () => {
    request.mockResolvedValue({ok: false, status: 503, json: async () => ({})});
    session.connect();
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(4000);
    expect(request).toHaveBeenCalledTimes(1);
    request.mockImplementation(async (url: string) => success(url.includes("/events?") ? [] : {tasks: [{...task, seq: 7}], seq: 7}));
    await vi.advanceTimersByTimeAsync(1000);
    expect(request.mock.calls.map(([url]) => url)).toEqual([
      "/api/v1/projects/project/ai/chat",
      "/api/v1/projects/project/ai/chat",
      "/api/v1/projects/project/ai/chat/events?afterSeq=7",
    ]);
    expect(session.tasks[0].id).toBe("run");
    expect(session.error).toBeUndefined();
  });

  it("repairs an event gap while subscribed without resuming idle polling", async () => {
    await start();
    request.mockResolvedValueOnce(success([event(1), event(2)]));
    listeners.get("aiChat")?.(event(3));
    await vi.advanceTimersByTimeAsync(0);
    expect(request).toHaveBeenCalledExactlyOnceWith("/api/v1/projects/project/ai/chat/events?afterSeq=0", expect.anything());
    expect(session.tasks[0].phase).toBe("step 3");
    await vi.advanceTimersByTimeAsync(60000);
    expect(request).toHaveBeenCalledOnce();
  });

  it("reconciles events received while the initial snapshot is in flight", async () => {
    const snapshot = Promise.withResolvers<ReturnType<typeof success>>();
    request.mockImplementation((url: string) => url.includes("/events?") ? Promise.resolve(success([event(2)])) : snapshot.promise);
    session.connect();
    listeners.get("aiChat")?.(event(3));
    await subscribe();
    expect(request).toHaveBeenCalledTimes(1);
    snapshot.resolve(success({tasks: [{...task, seq: 1, phase: "step 1"}], seq: 1}));
    await vi.advanceTimersByTimeAsync(0);
    expect(request).toHaveBeenLastCalledWith("/api/v1/projects/project/ai/chat/events?afterSeq=1", expect.anything());
    expect(session.tasks[0].phase).toBe("step 3");
    await vi.advanceTimersByTimeAsync(60000);
    expect(request).toHaveBeenCalledTimes(2);
  });
});

it("preserves request context for a network failure before an HTTP response", async () => {
  const cause = new TypeError("Failed to fetch");
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(cause));
  try {
    await expect(aiChatRequest("/api/v1/example", {prompt: "private"})).rejects.toMatchObject({
      name: "NetworkError", cause, request: {method: "POST", url: "/api/v1/example"},
    });
  } finally {vi.unstubAllGlobals();}
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

it("loads the conversation directory after the project event snapshot is established", async () => {
  const session = new LocalEditSession("project");
  session.userId = "bootstrap-owner";
  const initialized = Promise.withResolvers<void>();
  Reflect.set(session, "initializing", initialized.promise);
  const request = vi.fn(async () => ({ok: true, json: async () => ({threads: []})}));
  vi.stubGlobal("fetch", request);
  try {
    const loading = session.setBranch(null);
    expect(request).not.toHaveBeenCalled();
    initialized.resolve();
    await loading;
    expect(request).toHaveBeenCalledExactlyOnceWith(expect.stringContaining("/threads?"), expect.anything());
  } finally {vi.unstubAllGlobals();}
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

it("switches topics without moving the editor, losing drafts or stopping another conversation", async () => {
  const tools = mock<PlasmicAiTools>();
  const session = new LocalEditSession("project", () => tools);
  session.userId = "user";
  session.newThread("topic-a");
  const first = session.activeThreadId;
  session.draft = {prompt: "A draft", attachments: [{type: "text", name: "a.md", text: "Requirements A"}]};
  session.scrollTop = 120;
  session.tasks = [{...task, threadId: first}];
  session.newThread("topic-b");
  session.draft = {prompt: "B draft", attachments: []};
  expect(session.running).toBe(true);
  expect(session.visibleTasks).toEqual([]);
  session.stop();
  expect(tools._executeLocal).not.toHaveBeenCalled();
  await session.selectThread(first);
  expect(session.draft.prompt).toBe("A draft");
  expect(session.draft.attachments[0].name).toBe("a.md");
  expect(session.scrollTop).toBe(120);
  expect(session.visibleTasks.map(value => value.id)).toEqual(["run"]);
  expect(tools.navigate).not.toHaveBeenCalled();
  await session.selectThread("topic-b");
  expect(session.draft.prompt).toBe("B draft");
});

it("routes late attachment results to their originating topic while preserving newer text", async () => {
  const session = new LocalEditSession("project");
  session.newThread("topic-a");
  session.draft = {prompt: "Updated while reading", attachments: []};
  session.newThread("topic-b");
  session.draft = {prompt: "Unrelated draft", attachments: []};
  session.setThreadAttachments("topic-a", [{type: "text", name: "a.md", text: "A requirements"}]);
  expect(session.draft).toEqual({prompt: "Unrelated draft", attachments: []});
  await session.selectThread("topic-a");
  expect(session.draft).toEqual({prompt: "Updated while reading", attachments: [{type: "text", name: "a.md", text: "A requirements"}]});
});

it("keeps an unconfirmed stopped task discoverable and blocks sends from other topics", () => {
  const session = new LocalEditSession("project");
  session.newThread("topic-b");
  session.tasks = [{...task, threadId: "topic-a", status: "stopped", needsReconciliation: true}];
  expect(session.visibleTasks).toEqual([]);
  expect(session.activeRun).toBeUndefined();
  expect(session.blockingTask?.threadId).toBe("topic-a");
  expect(session.running).toBe(true);
});

it("pins an in-flight send to its original topic and clears only that topic's submitted draft", async () => {
  const tools = mock<PlasmicAiTools>();
  tools._getLocalContext.mockResolvedValue({success: true, output: JSON.stringify({
    ...task.binding, projectName: "Project", projectSummary: {artboards: 1, canvases: 1, images: 0, libraries: 0, pages: 1, components: 0},
    saveStatus: "saved", canvasName: "Page", browserImportCanvasName: "Browser Import", frameUuid: null,
    selectedElementUuids: [], instanceIndex: null, mode: "edit", canEdit: true, editorView: null, selectedSlot: null, previewKind: null, previewContext: null, path: [],
  })});
  const session = new LocalEditSession("project", () => tools);
  session.userId = "user";
  session.newThread("topic-a");
  session.draft = {prompt: "Send A", attachments: []};
  const response = Promise.withResolvers<unknown>();
  const request = vi.fn().mockReturnValue(response.promise);
  vi.stubGlobal("fetch", request);
  try {
    const sending = session.run("Send A", task.binding);
    await vi.waitFor(() => expect(request).toHaveBeenCalledTimes(1));
    session.newThread("topic-b");
    session.draft = {prompt: "Keep B", attachments: []};
    response.resolve({ok: true, json: async () => ({...task, prompt: "Send A", threadId: "topic-a"})});
    await sending;
    expect(JSON.parse(request.mock.calls[0][1].body).threadId).toBe("topic-a");
    expect(session.activeThreadId).toBe("topic-b");
    expect(session.draft.prompt).toBe("Keep B");
    expect(session.visibleTasks).toEqual([]);
    expect(session.activeRun?.threadId).toBe("topic-a");
    await session.selectThread("topic-a");
    expect(session.draft.prompt).toBe("");
    expect(session.visibleTasks).toHaveLength(1);
  } finally {vi.unstubAllGlobals();}
});

it("applies a late history page to its own topic without replacing the visible conversation", async () => {
  const session = new LocalEditSession("project");
  session.newThread("topic-a");
  session.draft = {prompt: "Keep A", attachments: []};
  session.before = "cursor-a";
  const pending = Promise.withResolvers<unknown>();
  vi.stubGlobal("fetch", vi.fn().mockReturnValue(pending.promise));
  try {
    const loading = session.loadEarlier();
    session.newThread("topic-b");
    pending.resolve({ok: true, json: async () => ({tasks: [{...task, threadId: "topic-a"}], before: "earlier-a"})});
    await loading;
    expect(session.activeThreadId).toBe("topic-b");
    expect(session.visibleTasks).toEqual([]);
    expect(session.before).toBeUndefined();
    await session.selectThread("topic-a");
    expect(session.before).toBe("earlier-a");
    expect(session.visibleTasks).toHaveLength(1);
  } finally {vi.unstubAllGlobals();}
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
      projectName: "Project", projectSummary: { artboards: 1, canvases: 1, images: 0, libraries: 0, pages: 1, components: 0 }, saveStatus: "saved", canvasName: "Page",
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
      previewKind: null, previewContext: null,
      path: [],
    }),
  });
  for (const tool of [tools.navigate, tools.selectElement]) {
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
  expect(tools.scrollElementIntoView).not.toHaveBeenCalled();
  expect(tools._executeLocal).not.toHaveBeenCalled();
});

it("reports a deleted node and does not try to scroll it into view", async () => {
  const tools = mock<PlasmicAiTools>();
  tools._getLocalContext.mockResolvedValue({
    success: true,
    output: JSON.stringify({
      projectName: "Project", projectSummary: { artboards: 1, canvases: 1, images: 0, libraries: 0, pages: 1, components: 0 }, saveStatus: "saved", canvasName: "Page",
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
      previewKind: null, previewContext: null,
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
        projectName: "Project", projectSummary: { artboards: 1, canvases: 1, images: 0, libraries: 0, pages: 1, components: 0 }, saveStatus: "saved", canvasName: "Page",
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
        previewKind: null, previewContext: null,
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
        task.threadId,
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
        projectName: "Project", projectSummary: { artboards: 1, canvases: 1, images: 0, libraries: 0, pages: 1, components: 0 }, saveStatus: "saved", canvasName: "Page", projectId: "project", branchId: null,
        sessionId: "session", changeCounter: 0, componentUuid: "page",
        frameUuid: null, selectedElementUuids: [], instanceIndex: null,
        mode: "edit", canEdit: true, editorView: null,
        selectedSlot: null, previewKind: null, previewContext: null, path: [],
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
