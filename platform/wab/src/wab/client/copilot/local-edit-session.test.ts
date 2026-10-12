import type { PlasmicAiTools } from "@/wab/client/components/studio/TopFrameCopilotToolsBridge";
import {
  LocalEditSession,
  localAiFetch,
} from "@/wab/client/copilot/local-edit-session";
import {
  LocalEditBinding,
  LocalEditCall,
  LocalEditRequest,
  LocalEditResponse,
  localEditBindingSchema,
} from "@/wab/shared/copilot/local-edit";
import { mock } from "vitest-mock-extended";

const binding: LocalEditBinding = {
  projectId: "project",
  branchId: null,
  sessionId: "session",
  changeCounter: 0,
  componentUuid: "page",
  elementUuids: ["section"],
};
const call: LocalEditCall = {
  id: "edit-1",
  name: "changeElement",
  input: { componentUuid: "page", elementUuid: "title", text: "After" },
};
function fixture(
  transport: (
    r: LocalEditRequest,
    s: AbortSignal,
  ) => Promise<LocalEditResponse>,
) {
  const tools = mock<PlasmicAiTools>();
  tools.identify.mockResolvedValue({ success: true, output: "{}" });
  tools.getEditorContext.mockResolvedValue({
    success: true,
    output: JSON.stringify({
      ...binding,
      projectName: "Project",
      frameUuid: null,
      selectedElementUuids: ["section"],
      instanceIndex: null,
      mode: "edit",
      canEdit: true,
      editorView: null,
      selectedSlot: null,
      previewContext: null,
      path: [],
    }),
  });
  tools._getLocalContext.mockImplementation(() => tools.getEditorContext({}));
  tools._executeLocal.mockImplementation(async (request) => {
    const current = request.binding as LocalEditBinding;
    const changed = request.name === "changeElement";
    return {
      success: true,
      output: JSON.stringify({
        binding: {
          ...current,
          changeCounter: current.changeCounter + (changed ? 1 : 0),
        },
        changed,
        result: JSON.stringify(
          request.name === "validate"
            ? { valid: true, errors: [] }
            : request.name === "save"
              ? { saved: true, revision: 7 }
              : { results: [] },
        ),
        ...(changed ? { before: "Before", after: "After" } : {}),
      }),
    };
  });
  return {
    tools,
    session: new LocalEditSession("project", () => tools, transport),
  };
}

it("pins context, records actual edits, validates and confirms save", async () => {
  const transport = vi
    .fn()
    .mockResolvedValueOnce({ text: "Editing", calls: [call] })
    .mockResolvedValueOnce({ text: "Done", calls: [] });
  const { tools, session } = fixture(transport);
  const attachments = [
    { type: "text" as const, name: "requirements.md", text: "A table" },
  ];
  await session.run(
    "Change title",
    undefined,
    undefined,
    attachments,
    "alternate-model",
  );
  expect(transport.mock.calls.map(([request]) => request.attachments)).toEqual([
    attachments,
    attachments,
  ]);
  expect(
    transport.mock.calls.every(
      ([request]) => request.model === "alternate-model",
    ),
  ).toBe(true);
  const task = session.tasks[0];
  expect(task).toMatchObject({
    status: "completed",
    savedRevision: 7,
    binding: {
      componentUuid: "page",
      elementUuids: ["section"],
      changeCounter: 1,
    },
  });
  expect(task.records).toMatchObject([
    { id: "edit-1", before: "Before", after: "After" },
  ]);
  expect(tools._executeLocal.mock.calls.map(([r]) => r.name)).toEqual([
    "read",
    "read",
    "changeElement",
    "validate",
    "save",
  ]);
  expect(transport.mock.calls[1][0].history[0].results).toHaveLength(1);
});

it("confirms the saved revision after undoing the latest edit", async () => {
  const transport = vi
    .fn()
    .mockResolvedValueOnce({ text: "Editing", calls: [call] })
    .mockResolvedValueOnce({ text: "Done", calls: [] });
  const { tools, session } = fixture(transport);
  await session.run("Change title");
  const task = session.tasks[0];
  await session.undo(task, task.records[0]);
  expect(task.records[0].undone).toBe(true);
  expect(task.savedRevision).toBe(7);
  expect(tools._executeLocal.mock.calls.slice(-2).map(([r]) => r.name)).toEqual(
    ["undo", "save"],
  );
});

it("does not claim that an undo was saved when persistence fails", async () => {
  const transport = vi
    .fn()
    .mockResolvedValueOnce({ text: "Editing", calls: [call] })
    .mockResolvedValueOnce({ text: "Done", calls: [] });
  const { tools, session } = fixture(transport);
  await session.run("Change title");
  const original = tools._executeLocal.getMockImplementation();
  tools._executeLocal.mockImplementation(async (r, signal) =>
    r.name === "save"
      ? {
          success: false,
          error: { type: "EXECUTION_FAILED", message: "Save failed" },
        }
      : ((await original?.(r, signal)) ?? { success: true, output: "{}" }),
  );
  const task = session.tasks[0];
  await session.undo(task, task.records[0]);
  expect(task.records[0].undone).toBe(true);
  expect(task.savedRevision).toBeUndefined();
  expect(task.error).toBe("Save failed");
});
it.each([false, true])(
  "chains same-task undo guards and preserves a later human edit=%s",
  async (humanEdit) => {
    const transport = vi
      .fn()
      .mockResolvedValueOnce({
        text: "Editing",
        calls: [call, { ...call, id: "edit-2" }],
      })
      .mockResolvedValueOnce({ text: "Done", calls: [] });
    const { tools, session } = fixture(transport);
    let counter = 0;
    tools._executeLocal.mockImplementation(async (request) => {
      const currentBinding = localEditBindingSchema.parse(request.binding);
      if (currentBinding.changeCounter !== counter) {
        return {
          success: false,
          error: { type: "EXECUTION_FAILED", message: "The design changed." },
        };
      }
      const changed =
        request.name === "changeElement" || request.name === "undo";
      if (changed) {
        counter++;
      }
      return {
        success: true,
        output: JSON.stringify({
          binding: { ...currentBinding, changeCounter: counter },
          changed,
          result: JSON.stringify(
            request.name === "validate"
              ? { valid: true, errors: [] }
              : request.name === "save"
                ? { saved: true, revision: 7 }
                : { results: [] },
          ),
          ...(changed ? { before: "Before", after: "After" } : {}),
        }),
      };
    });
    await session.run("Two edits");
    const task = session.tasks[0];
    expect(task.status).toBe("completed");
    await session.undo(task, task.records[1]);
    expect(task.records[1].undone).toBe(true);
    expect(task.records[0].binding.changeCounter).toBe(1);
    expect(task.records[0].undoBinding?.changeCounter).toBe(3);
    if (humanEdit) {
      counter++;
    }
    await session.undo(task, task.records[0]);
    expect(!!task.records[0].undone).toBe(!humanEdit);
    if (humanEdit) {
      expect(task.error).toBe("The design changed.");
    }
    expect(counter).toBe(4);
  },
);

it("keeps an explicitly bound selection even when current selection changes", async () => {
  const { tools, session } = fixture(async () => ({
    text: "No change",
    calls: [],
  }));
  await session.run("Edit the original selection", {
    ...binding,
    elementUuids: ["original"],
  });
  expect(tools._executeLocal.mock.calls[0][0]).toMatchObject({
    binding: { elementUuids: ["original"] },
    input: { elements: [{ elementUuid: "original" }] },
  });
});

it("aborts an outstanding model request and never issues its tool calls", async () => {
  let entered = () => {};
  const started = new Promise<void>((resolve) => {
    entered = resolve;
  });
  const { tools, session } = fixture(async (_r, signal) => {
    entered();
    return new Promise((_resolve, reject) =>
      signal.addEventListener("abort", () => reject(signal.reason), {
        once: true,
      }),
    );
  });
  const run = session.run("Change title");
  await started;
  session.stop();
  await run;
  expect(session.tasks[0].status).toBe("stopped");
  expect(tools._executeLocal.mock.calls.map(([r]) => r.name)).toEqual([
    "read",
    "read",
  ]);
});

it("finishes an in-flight transaction, records it, and skips remaining calls after stop", async () => {
  const { tools, session } = fixture(async () => ({
    text: "Editing",
    calls: [call, { ...call, id: "edit-2" }],
  }));
  const original = tools._executeLocal.getMockImplementation();
  tools._executeLocal.mockImplementation(async (r, signal) => {
    const result = await original?.(r, signal);
    if (r.name === "changeElement") {
      session.stop();
    }
    if (!result) {
      throw new Error("Missing result");
    }
    return result;
  });
  await session.run("Change title");
  expect(session.tasks[0]).toMatchObject({
    status: "stopped",
    records: [{ id: "edit-1" }],
  });
  expect(
    tools._executeLocal.mock.calls.filter(([r]) => r.name === "changeElement"),
  ).toHaveLength(1);
  expect(tools._executeLocal.mock.calls.some(([r]) => r.name === "save")).toBe(
    false,
  );
});

it("does not repeat an already executed tool-call identity", async () => {
  const transport = vi
    .fn()
    .mockResolvedValueOnce({ text: "First", calls: [call] })
    .mockResolvedValueOnce({ text: "Repeated", calls: [call] })
    .mockResolvedValueOnce({ text: "Done", calls: [] });
  const { tools, session } = fixture(transport);
  await session.run("Change title");
  expect(
    tools._executeLocal.mock.calls.filter(([r]) => r.name === "changeElement"),
  ).toHaveLength(1);
  expect(session.tasks[0].records).toHaveLength(1);
});

it("stops on a failed tool without saving or claiming completion", async () => {
  const { tools, session } = fixture(async () => ({
    text: "Editing",
    calls: [call],
  }));
  const original = tools._executeLocal.getMockImplementation();
  tools._executeLocal.mockImplementation(async (r, signal) =>
    r.name === "changeElement"
      ? {
          success: false,
          error: { type: "EXECUTION_FAILED", message: "Stale context" },
        }
      : ((await original?.(r, signal)) ?? { success: true, output: "{}" }),
  );
  await session.run("Change title");
  expect(session.tasks[0]).toMatchObject({
    status: "failed",
    error: "Stale context",
    records: [],
  });
  expect(tools._executeLocal.mock.calls.some(([r]) => r.name === "save")).toBe(
    false,
  );
});

it.each([
  [true, false],
  [false, false],
  [true, true],
])(
  "pins the new page without leaking the previous selection (canvas ready=%s, automatic=%s)",
  async (ready, automatic) => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        mode: "page",
        name: "RecordsPage",
        path: "/records",
      }),
    });
    if (automatic) {
      vi.stubGlobal("fetch", fetchMock);
    }
    const transport = vi.fn().mockResolvedValue({ text: "Done", calls: [] });
    const { tools, session } = fixture(transport);
    const original = tools._executeLocal.getMockImplementation();
    tools._executeLocal.mockImplementation(async (r, signal) => {
      if (r.name === "createComponent") {
        const originalContext = await tools.getEditorContext({});
        if (!originalContext.success) {
          throw new Error("Context missing");
        }
        tools.getEditorContext.mockResolvedValue({
          success: true,
          output: JSON.stringify({
            ...JSON.parse(originalContext.output),
            componentUuid: ready ? "generated" : "page",
            frameUuid: ready ? "generated-frame" : "previous-frame",
            changeCounter: 1,
            selectedElementUuids: [],
          }),
        });
        return {
          success: true,
          output: JSON.stringify({
            binding: {
              ...(r.binding as LocalEditBinding),
              componentUuid: "generated",
              changeCounter: 1,
            },
            changed: true,
            result: JSON.stringify({ results: [] }),
            before: "No page",
            after: "New page",
          }),
        };
      }
      return (await original?.(r, signal)) ?? { success: true, output: "{}" };
    });
    try {
      await session.run(
        "Build a list",
        binding,
        automatic ? "auto" : { name: "RecordsPage", path: "/records" },
      );
    } finally {
      vi.unstubAllGlobals();
    }
    if (automatic) {
      expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
        prompt: "Build a list",
        hasCurrentPage: true,
      });
    }
    expect(tools._executeLocal.mock.calls[0][0]).toMatchObject({
      binding: {
        componentUuid: null,
        mode: "page",
        elementUuids: [],
        frameUuid: null,
      },
      name: "createComponent",
      input: { type: "page", name: "RecordsPage", path: "/records" },
    });
    expect(tools._executeLocal.mock.calls.map(([r]) => r.name)).toEqual([
      "createComponent",
      "navigate",
      "read",
      "read",
      "validate",
      "save",
    ]);
    expect(transport.mock.calls[0][0].binding).toMatchObject({
      componentUuid: "generated",
      mode: "page",
      elementUuids: [],
    });
    expect(transport.mock.calls[0][0].binding.frameUuid).toBe(
      ready ? "generated-frame" : null,
    );
    if (ready) {
      expect(transport.mock.calls[0][0].resources).toContain(
        '"componentUuid":"generated"',
      );
    } else {
      expect(transport.mock.calls[0][0].resources).toContain(
        "Editor context at submission:\nnull",
      );
    }
    expect(transport.mock.calls[0][0].resources).not.toContain(
      '"componentUuid":"page"',
    );
    expect(session.tasks[0]).toMatchObject({
      status: "completed",
      savedRevision: 7,
      records: [
        { name: "createComponent", before: "No page", after: "New page" },
      ],
    });
  },
);

it("retains page creation as an undoable record when stopped before navigation", async () => {
  const transport = vi.fn();
  const { tools, session } = fixture(transport);
  tools._executeLocal.mockImplementation(async (r) => {
    session.stop();
    return {
      success: true,
      output: JSON.stringify({
        binding: {
          ...(r.binding as LocalEditBinding),
          componentUuid: "generated",
          changeCounter: 1,
        },
        changed: true,
        result: "{}",
        before: "Before",
        after: "After",
      }),
    };
  });
  await session.run("Build", undefined, {
    name: "RecordsPage",
    path: "/records",
  });
  expect(session.tasks[0]).toMatchObject({
    status: "stopped",
    records: [{ name: "createComponent" }],
  });
  expect(tools._executeLocal).toHaveBeenCalledOnce();
  expect(transport).not.toHaveBeenCalled();
});

it.each(["local", "page"] as const)(
  "returns rejected %s arguments to the model and skips dependent calls without relaxing validation",
  async (mode) => {
    const bad = {
      id: "bad",
      name: "getEditorContext",
      input: { reason: "Inspect" },
    };
    const transport = vi
      .fn()
      .mockResolvedValueOnce({
        text: "Reading",
        calls: [bad, { ...call, id: "skip" }],
      })
      .mockResolvedValueOnce({ text: "Corrected", calls: [call] })
      .mockResolvedValueOnce({ text: "Done", calls: [] });
    const { tools, session } = fixture(transport);
    const original = tools._executeLocal.getMockImplementation();
    tools._executeLocal.mockImplementation(async (r, signal) =>
      r.name === "getEditorContext"
        ? {
            success: false,
            error: {
              type: "EXECUTION_FAILED",
              message: "Unrecognized key: reason",
            },
          }
        : ((await original?.(r, signal)) ?? { success: true, output: "{}" }),
    );
    await session.run("Build interactions", {
      ...binding,
      ...(mode === "page" ? { mode: "page" as const } : {}),
      elementUuids: [],
    });
    const results = transport.mock.calls[1][0].history[0].results;
    expect(JSON.parse(results[0].output)).toEqual({
      error: "Unrecognized key: reason",
    });
    expect(JSON.parse(results[1].output).error).toContain("Skipped");
    expect(
      session.tasks[0].operations.find(
        (operation) => operation.status === "failed",
      ),
    ).toMatchObject({
      name: "getEditorContext",
      error: "Unrecognized key: reason",
    });
    expect(
      tools._executeLocal.mock.calls.filter(
        ([r]) => r.name === "changeElement",
      ),
    ).toHaveLength(1);
    expect(session.tasks[0]).toMatchObject({
      status: "completed",
      savedRevision: 7,
      records: [{ id: "edit-1" }],
    });
  },
);

it.each([
  { projectId: "other" },
  { branchId: "other" },
  { sessionId: "other" },
  { changeCounter: 1 },
  { canEdit: false },
])(
  "never repairs a rejected page call after the editor context changes: %j",
  async (patch) => {
    const transport = vi.fn().mockResolvedValue({
      text: "Read",
      calls: [
        { id: "bad", name: "getEditorContext", input: { reason: "Inspect" } },
      ],
    });
    const { tools, session } = fixture(transport);
    const context = await tools.getEditorContext({});
    if (!context.success) {
      throw new Error("Context fixture failed");
    }
    tools._getLocalContext.mockResolvedValueOnce(context).mockResolvedValue({
      success: true,
      output: JSON.stringify({ ...JSON.parse(context.output), ...patch }),
    });
    const original = tools._executeLocal.getMockImplementation();
    tools._executeLocal.mockImplementation(async (r, signal) =>
      r.name === "getEditorContext"
        ? {
            success: false,
            error: { type: "EXECUTION_FAILED", message: "Rejected input" },
          }
        : ((await original?.(r, signal)) ?? { success: true, output: "{}" }),
    );
    await session.run("Build", { ...binding, mode: "page", elementUuids: [] });
    expect(transport).toHaveBeenCalledOnce();
    expect(session.tasks[0]).toMatchObject({
      status: "failed",
      error: "Rejected input",
      records: [],
    });
    expect(
      tools._executeLocal.mock.calls.some(([r]) => r.name === "save"),
    ).toBe(false);
  },
);

it("stops a page task after the repair budget is exhausted", async () => {
  const transport = vi.fn(
    async (request: LocalEditRequest): Promise<LocalEditResponse> => ({
      text: "Read",
      calls: [
        {
          id: "bad-" + request.history.length,
          name: "getEditorContext",
          input: { reason: "Inspect" },
        },
      ],
    }),
  );
  const { tools, session } = fixture(transport);
  const original = tools._executeLocal.getMockImplementation();
  tools._executeLocal.mockImplementation(async (r, signal) =>
    r.name === "getEditorContext"
      ? {
          success: false,
          error: { type: "EXECUTION_FAILED", message: "Rejected input" },
        }
      : ((await original?.(r, signal)) ?? { success: true, output: "{}" }),
  );
  await session.run("Build", { ...binding, mode: "page", elementUuids: [] });
  expect(transport).toHaveBeenCalledTimes(4);
  expect(session.tasks[0].status).toBe("failed");
  expect(session.tasks[0].records).toHaveLength(0);
});

it("surfaces a provider error even after keepalive headers committed HTTP 200", async () => {
  const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response('\n\n{"error":{"message":"AI service request failed."}}', {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }),
  );
  try {
    await expect(localAiFetch("project", "step")).rejects.toThrow(
      "AI service request failed.",
    );
  } finally {
    fetchMock.mockRestore();
  }
});

it("keeps the supplied selection binding after resolving editing intent", async () => {
  const transport = vi.fn().mockResolvedValue({ text: "Done", calls: [] });
  const { tools, session } = fixture(transport);
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValue({ ok: true, json: async () => ({ mode: "edit" }) }),
  );
  const pinned = { ...binding, elementUuids: ["pinned-selection"] };
  try {
    await session.run(
      "Redesign this page",
      pinned,
      "auto",
      [],
      "alternate-model",
    );
  } finally {
    vi.unstubAllGlobals();
  }
  expect(session.tasks[0].status).toBe("completed");
  expect(transport.mock.calls[0][0].binding).toEqual(pinned);
  expect(transport.mock.calls[0][0].model).toBe("alternate-model");

  expect(
    tools._executeLocal.mock.calls.some(([r]) => r.name === "createComponent"),
  ).toBe(false);
});
it("stopping during intent resolution prevents all design mutations", async () => {
  const transport = vi.fn();
  const { tools, session } = fixture(transport);
  vi.stubGlobal(
    "fetch",
    vi.fn().mockImplementation(async () => {
      session.stop();
      return {
        ok: true,
        json: async () => ({
          mode: "page",
          name: "RecordsPage",
          path: "/records",
        }),
      };
    }),
  );
  try {
    await session.run("Create a new records page", undefined, "auto");
  } finally {
    vi.unstubAllGlobals();
  }
  expect(session.tasks[0].status).toBe("stopped");
  expect(tools._executeLocal).not.toHaveBeenCalled();
  expect(transport).not.toHaveBeenCalled();
});

it("notifies shared model subscribers only when the selected model changes", () => {
  const { session } = fixture(vi.fn());
  const notify = vi.fn();
  const release = session.subscribe(notify);
  session.selectedModel = "alternate-model";
  expect(session.selectedModel).toBe("alternate-model");
  expect(notify).toHaveBeenCalledOnce();
  session.selectedModel = "alternate-model";
  expect(notify).toHaveBeenCalledOnce();
  release();
});
