import { AiExecutionProgress } from "@/wab/client/components/copilot/AiExecutionProgress";
import { LocalEditSession } from "@/wab/client/copilot/local-edit-session";
import type { AiTask, EditRecord } from "@/wab/shared/copilot/ai-chat";
import "@testing-library/jest-dom/vitest";
import {
  cleanup,
  configure,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import React from "react";
import { mock } from "vitest-mock-extended";

vi.mock("@/wab/client/i18n", () => ({
  useI18n: () => ({
    label: (text: string) => text,
    t: (text: string, values?: Record<string, string | number>) =>
      text.replace(/\{(\w+)\}/g, (_, key) => String(values?.[key] ?? key)),
  }),
}));
beforeEach(() => configure({ testIdAttribute: "data-test-id" }));
afterEach(() => {
  cleanup();
  configure({ testIdAttribute: "data-testid" });
});
const binding = {
  projectId: "project",
  sessionId: "session",
  branchId: null,
  componentUuid: "page",
  elementUuids: [],
  changeCounter: 0,
};
function task(overrides: Partial<AiTask> = {}): AiTask {
  return {
    id: "task",
    threadId: "thread",
    authorId: "user",
    createdAt: "2026-10-13T00:00:00Z",
    prompt: "Update title",
    binding,
    files: [],
    parts: [],
    messages: [],
    records: [],
    operations: [],
    status: "running",
    phase: "Reading context",
    ...overrides,
  };
}

it("shows ordered, readable steps, actual counts and distinct running and failed states", () => {
  render(
    <AiExecutionProgress
      session={mock<LocalEditSession>()}
      task={task({
        operations: [
          { id: "read-1", name: "read", status: "completed" },
          {
            id: "read-2",
            name: "read",
            status: "failed",
            error: "Node no longer exists.",
          },
          { id: "change", name: "changeElement", status: "running" },
          { id: "validate", name: "validate", status: "completed" },
        ],
      })}
    />,
  );
  expect(screen.getByLabelText("4 tool calls")).toHaveTextContent("4");
  expect(screen.getByText("1 rejected calls")).toBeInTheDocument();
  expect(screen.getAllByText("Read project resources")).toHaveLength(2);
  expect(screen.getByText("Validate prototype structure")).toBeInTheDocument();
  expect(screen.getByText("Step 3")).toBeInTheDocument();
  expect(screen.getByText("Tool call was rejected.")).toBeInTheDocument();
  expect(
    screen.getByText("Node no longer exists.").closest("details"),
  ).not.toHaveAttribute("open");
  expect(
    screen
      .getAllByTestId("ai-execution-step")
      .map((step) => step.dataset.operationId),
  ).toEqual(["read-1", "read-2", "change", "validate"]);
  expect(screen.getByText("Running")).toBeInTheDocument();
});

it("puts target, input, before/after and undo inside their corresponding operation", () => {
  const session = mock<LocalEditSession>({ running: false });
  session.canUndo.mockReturnValue(true);
  const record: EditRecord = {
    id: "change",
    name: "changeElement",
    input: { elementUuid: "node", styles: { padding: "18px" } },
    before: "padding: 16px",
    after: "padding: 18px",
    binding,
  };
  const node = {
    uuid: "node",
    name: "StatusFilter",
    page: "page",
    branch: null,
  };
  const current = task({
    records: [record],
    nodes: [node],
    operations: [
      { id: "read", name: "read", status: "completed" },
      { id: "change", name: "changeElement", status: "completed" },
    ],
  });
  render(
    <AiExecutionProgress
      task={current}
      session={session}
      lastRecord={record}
    />,
  );
  const [read, change] = screen.getAllByTestId("ai-execution-step");
  expect(within(read).queryByTestId("local-ai-change")).toBeNull();
  expect(within(change).getByTestId("local-ai-change")).toHaveTextContent(
    '"padding": "18px"',
  );
  expect(change).toHaveTextContent("padding: 16px");
  expect(change).toHaveTextContent("padding: 18px");
  fireEvent.click(
    within(change).getByRole("button", { name: "Locate node StatusFilter" }),
  );
  expect(session.locate).toHaveBeenCalledWith(current, node);
  // The undo action lives in the disclosure, whose contents remain mounted.
  fireEvent.click(within(change).getByText("Undo"));
  expect(session.undo).toHaveBeenCalledWith(current, record);
});

it("keeps historical change records even when no matching operation is available", () => {
  const record: EditRecord = {
    id: "historical",
    name: "changeElement",
    input: {},
    before: "old",
    after: "new",
    binding,
    undone: true,
  };
  render(
    <AiExecutionProgress
      task={task({ status: "completed", records: [record] })}
      session={mock<LocalEditSession>()}
    />,
  );
  expect(screen.getByLabelText("1 changes")).toHaveTextContent("1");
  expect(screen.getByTestId("local-ai-operations")).not.toHaveAttribute("open");
  expect(screen.getAllByTestId("ai-execution-step")).toHaveLength(1);
  expect(screen.getByTestId("local-ai-change")).toHaveAttribute(
    "data-ai-undone",
    "true",
  );
  expect(screen.getByText("Undone")).toBeInTheDocument();
  expect(screen.getByTestId("ai-process-state")).toHaveAttribute(
    "aria-label",
    "Completed",
  );
});

it("preserves unknown operation names without inventing a tool description", () => {
  render(
    <AiExecutionProgress
      task={task({
        operations: [
          { id: "unknown", name: "newServerTool", status: "running" },
        ],
      })}
      session={mock<LocalEditSession>()}
    />,
  );
  expect(
    within(screen.getByTestId("ai-execution-step")).getAllByText(
      "newServerTool",
    ),
  ).toHaveLength(2);
});

it("keeps chronological parts and folds thought summaries and technical details", () => {
  const parts: AiTask["parts"] = [
    { type: "tool", operationId: "read", name: "read", status: "completed" },
    {
      type: "reasoning",
      step: 0,
      text: "A long provider summary",
      complete: true,
    },
    {
      type: "markdown",
      channel: "commentary",
      text: "Checking the page",
      complete: true,
    },
    {
      type: "tool",
      operationId: "context",
      name: "getEditorContext",
      status: "completed",
    },
  ];
  const { container } = render(
    <AiExecutionProgress
      session={mock<LocalEditSession>()}
      parts={parts}
      task={task({
        parts,
        operations: [
          {
            id: "read",
            name: "read",
            title: "Read page structure",
            target: "StandardListPage",
            status: "completed",
          },
          { id: "context", name: "getEditorContext", status: "completed" },
        ],
      })}
    />,
  );
  expect(
    Array.from(container.querySelectorAll("ol > li")).map((item) =>
      item.getAttribute("data-test-id"),
    ),
  ).toEqual([
    "ai-execution-step",
    "ai-reasoning",
    "ai-process-message",
    "ai-execution-step",
  ]);
  expect(
    screen.getByRole("button", { name: "Thought summary" }),
  ).toHaveAttribute("aria-expanded", "false");
  expect(
    screen
      .getAllByTestId("ai-operation-details")
      .every((item) => !item.hasAttribute("open")),
  ).toBe(true);
  expect(screen.getByText("StandardListPage")).toBeInTheDocument();
});
it("retains the same markdown and node reference when folding a thought summary", () => {
  const session = mock<LocalEditSession>();
  const currentTask = task({
    parts: [
      {
        type: "reasoning",
        step: 0,
        complete: true,
        text: "Inspect [StandardListPage](#plasmic-node/page).\n\nKeep the design unchanged.",
      },
    ],
  });
  render(
    <AiExecutionProgress
      session={session}
      task={currentTask}
      parts={currentTask.parts}
    />,
  );
  const thought = screen.getByTestId("ai-reasoning-details");
  const toggle = within(thought).getByRole("button", {
    name: "Thought summary",
  });
  const markdown = within(thought).getByTestId("ai-markdown");
  const node = within(thought).getByRole("button", {
    name: "Locate node StandardListPage",
  });
  const body = document.getElementById(
    toggle.getAttribute("aria-controls") ?? "",
  );
  expect(body).toHaveAttribute("data-collapsed", "true");
  fireEvent.click(toggle);
  expect(toggle).toHaveAttribute("aria-expanded", "true");
  expect(body).toHaveAttribute("data-collapsed", "false");
  expect(within(thought).getByTestId("ai-markdown")).toBe(markdown);
  expect(within(thought).getByTestId("ai-node-reference")).toBe(node);
  fireEvent.click(node);
  expect(session.locate).toHaveBeenCalledWith(
    currentTask,
    expect.objectContaining({ uuid: "page" }),
  );
  expect(toggle).toHaveAttribute("aria-expanded", "true");
  fireEvent.click(toggle);
  expect(body).toHaveAttribute("data-collapsed", "true");
  expect(within(thought).getByTestId("ai-markdown")).toBe(markdown);
  expect(within(thought).getByTestId("ai-node-reference")).toBe(node);
});

it("shows recovery only when the server links the successful retry", () => {
  render(
    <AiExecutionProgress
      session={mock<LocalEditSession>()}
      task={task({
        status: "completed",
        operations: [
          {
            id: "failed",
            name: "getEditorContext",
            status: "failed",
            error: "raw error",
            recoveredBy: "retry",
          },
          {
            id: "retry",
            name: "getEditorContext",
            status: "completed",
            retryOf: "failed",
          },
          {
            id: "unrelated",
            name: "getEditorContext",
            status: "failed",
            error: "another error",
          },
          { id: "new", name: "getEditorContext", status: "completed" },
        ],
      })}
    />,
  );
  expect(screen.getByText("1 recovered retries")).toBeInTheDocument();
  expect(screen.getByText("1 rejected calls")).toBeInTheDocument();
  expect(screen.getByText("Recovered")).toBeInTheDocument();
  expect(screen.queryByText("Incomplete")).toBeNull();
  expect(
    screen
      .getAllByTestId("ai-execution-step")
      .map((item) => item.dataset.operationStatus),
  ).toEqual(["recovered", "completed", "failed", "completed"]);
});
it.each([true, false])(
  "preserves chosen disclosure state through completion: open=%s",
  (chosenOpen) => {
    const session = mock<LocalEditSession>();
    const current = task();
    const view = render(
      <AiExecutionProgress session={session} task={current} />,
    );
    const summary = screen
      .getByTestId("local-ai-operations")
      .querySelector("summary");
    if (!summary) throw new Error("Process summary missing");
    fireEvent.click(summary);
    if (chosenOpen) fireEvent.click(summary);
    view.rerender(
      <AiExecutionProgress
        session={session}
        task={{ ...current, status: "completed" }}
      />,
    );
    expect(screen.getByTestId("local-ai-operations").hasAttribute("open")).toBe(
      chosenOpen,
    );
  },
);
it("collapses on completion unless the user chooses otherwise", () => {
  const session = mock<LocalEditSession>();
  const current = task();
  const view = render(<AiExecutionProgress session={session} task={current} />);
  expect(screen.getByTestId("local-ai-operations")).toHaveAttribute("open");
  view.rerender(
    <AiExecutionProgress
      session={session}
      task={{ ...current, status: "completed" }}
    />,
  );
  expect(screen.getByTestId("local-ai-operations")).not.toHaveAttribute("open");
});

it.each(["running", "completed", "stopped", "failed"] as const)(
  "uses a leading status icon and an icon-only call count for %s",
  (status) => {
    render(
      <AiExecutionProgress
        task={task({
          status,
          operations: [{ id: "read", name: "read", status: "completed" }],
        })}
        session={mock<LocalEditSession>()}
      />,
    );
    const process = screen.getByTestId("local-ai-operations");
    const summary = process.querySelector("summary");
    expect(summary?.textContent).toBe("Processing1");
    expect(summary?.firstElementChild).toBe(
      screen.getByTestId("ai-process-state"),
    );
    expect(screen.getByTestId("ai-process-state")).toHaveAttribute(
      "data-status",
      status,
    );
    expect(!!summary?.querySelector("[data-progress-caret]")).toBe(
      status === "completed",
    );
    expect(screen.getByTestId("ai-process-count")).toHaveAccessibleName(
      "1 tool calls",
    );
  },
);
