import type { PlasmicAiTools } from "@/wab/client/components/studio/TopFrameCopilotToolsBridge";
import { LocalEditSession } from "@/wab/client/copilot/local-edit-session";
import {
  LocalEditBinding,
  LocalEditCall,
  LocalEditRequest,
  LocalEditResponse,
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
  await session.run("Change title");
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

it("creates and pins one new routed page before invoking the model", async () => {
  const transport = vi.fn().mockResolvedValue({ text: "Done", calls: [] });
  const { tools, session } = fixture(transport);
  const original = tools._executeLocal.getMockImplementation();
  tools._executeLocal.mockImplementation(async (r, signal) => {
    if (r.name === "createComponent") {
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
  await session.run("Build a list", binding, {
    name: "RecordsPage",
    path: "/records",
  });
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
  expect(session.tasks[0]).toMatchObject({
    status: "completed",
    savedRevision: 7,
    records: [
      { name: "createComponent", before: "No page", after: "New page" },
    ],
  });
});

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
