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
  expect(screen.getByLabelText("2 of 4 steps completed")).toHaveTextContent(
    "2/4",
  );
  expect(screen.getByText("1 failed")).toBeInTheDocument();
  expect(screen.getAllByText("Read project resources")).toHaveLength(2);
  expect(screen.getByText("Validate prototype structure")).toBeInTheDocument();
  expect(screen.getByText("Step 3")).toBeInTheDocument();
  expect(screen.getByRole("alert")).toHaveTextContent("Node no longer exists.");
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
  expect(screen.getByText("1 changes")).toBeInTheDocument();
  expect(screen.getByTestId("local-ai-operations")).not.toHaveAttribute("open");
  expect(screen.getAllByTestId("ai-execution-step")).toHaveLength(1);
  expect(screen.getByTestId("local-ai-change")).toHaveAttribute(
    "data-ai-undone",
    "true",
  );
  expect(screen.getByText("Undone")).toBeInTheDocument();
  expect(screen.queryByText("Completed")).toBeNull();
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
  expect(screen.getAllByText("newServerTool")).toHaveLength(2);
});
