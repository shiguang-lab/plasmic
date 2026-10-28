import {
  AiResponse,
  aiResponseSections,
} from "@/wab/client/components/copilot/AiResponse";
import { LocalEditSession } from "@/wab/client/copilot/local-edit-session";
import type { AiMessagePart, AiTask } from "@/wab/shared/copilot/ai-chat";
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { mock } from "vitest-mock-extended";

vi.mock("@/wab/client/i18n", () => ({
  useI18n: () => ({
    label: (text: string) => text,
    t: (text: string, values?: Record<string, string | number>) =>
      text.replace(/\{(\w+)\}/g, (_, key) => String(values?.[key] ?? key)),
  }),
}));
afterEach(cleanup);
const tool = (name: string): AiMessagePart => ({
  type: "tool",
  name,
  operationId: name,
  status: "completed",
});
const text = (
  value: string,
  channel: "commentary" | "answer" = "commentary",
  complete = true,
): AiMessagePart => ({
  type: "markdown",
  channel,
  text: value,
  step: 0,
  complete,
});
function task(
  parts: AiMessagePart[],
  status: AiTask["status"] = "completed",
): AiTask {
  return {
    id: "run",
    threadId: "thread",
    authorId: "user",
    createdAt: "2026-10-14T00:00:00Z",
    prompt: "Inspect page",
    files: [],
    parts,
    status,
    phase: status === "running" ? "Thinking" : "Completed",
    messages: parts.filter((p) => p.type === "markdown").map((p) => p.text),
    records: [],
    operations: parts
      .filter((p) => p.type === "tool")
      .map((p) => ({ id: p.operationId, name: p.name, status: "completed" })),
    binding: {
      projectId: "project",
      branchId: null,
      sessionId: "session",
      changeCounter: 0,
      componentUuid: "page",
      elementUuids: [],
    },
  };
}
it("keeps commentary and tool operations in order, with the answer and subsequent validation in their actual positions", () => {
  const value = task([
    tool("read"),
    text("Checking the fields"),
    tool("queryElements"),
    text("The page has three fields", "answer"),
    tool("validate"),
    tool("save"),
  ]);
  const { container } = render(
    <AiResponse task={value} session={mock<LocalEditSession>()} />,
  );
  expect(aiResponseSections(value).map((s) => s.type)).toEqual([
    "process",
    "answer",
    "process",
  ]);
  expect(
    Array.from(
      container.querySelectorAll(
        '[data-test-id="local-ai-operations"], [data-test-id="ai-answer"]',
      ),
    ).map((e) => e.getAttribute("data-test-id")),
  ).toEqual(["local-ai-operations", "ai-answer", "local-ai-operations"]);
  const first = container.querySelector('[data-test-id="local-ai-operations"]');
  expect(
    Array.from(
      first?.querySelectorAll(
        '[data-test-id="ai-execution-step"], [data-test-id="ai-process-message"]',
      ) ?? [],
    ).map((e) => e.getAttribute("data-operation-id") ?? e.textContent?.trim()),
  ).toEqual(["read", "Checking the fields", "queryElements"]);
  expect(screen.getByText("Final response")).toBeInTheDocument();
  expect(first).not.toHaveAttribute("open");
  const separator = screen.getByRole("separator");
  expect(separator.previousElementSibling).toBe(first);
  expect(separator.nextElementSibling).toHaveAttribute(
    "data-test-id",
    "ai-answer",
  );
});
it("keeps explicitly typed commentary in its process block while streaming", () => {
  const session = mock<LocalEditSession>();
  const rendered = render(
    <AiResponse task={task([tool("read")], "running")} session={session} />,
  );
  const process = rendered.container.querySelector(
    '[data-test-id="local-ai-operations"]',
  );
  rendered.rerender(
    <AiResponse
      task={task([tool("read"), text("I will inspect fields")], "running")}
      session={session}
    />,
  );
  expect(process).toBe(rendered.container.firstElementChild);
  expect(screen.queryByText("Generating response")).toBeNull();
  rendered.rerender(
    <AiResponse
      task={task(
        [tool("read"), text("I will inspect fields"), tool("queryElements")],
        "running",
      )}
      session={session}
    />,
  );
  expect(
    rendered.container.querySelector('[data-test-id="ai-answer"]'),
  ).toBeNull();
  expect(
    screen
      .getByText("I will inspect fields")
      .closest('[data-test-id="local-ai-operations"]'),
  ).toBe(process);
});
it.each(["failed", "stopped"] as const)(
  "does not present %s partial output as a final answer",
  (status) => {
    render(
      <AiResponse
        task={task([tool("read"), text("Partial description")], status)}
        session={mock<LocalEditSession>()}
      />,
    );
    expect(screen.queryByText("Final response")).toBeNull();
    expect(screen.getByText("Partial description")).toBeInTheDocument();
  },
);
it("collapses a completed process but leaves a failed process open for inspection", () => {
  const session = mock<LocalEditSession>();
  const rendered = render(
    <AiResponse task={task([tool("read")], "running")} session={session} />,
  );
  const process = rendered.container.querySelector("details");
  expect(process).toHaveAttribute("open");
  rendered.rerender(
    <AiResponse task={task([tool("read")])} session={session} />,
  );
  expect(process).not.toHaveAttribute("open");
  fireEvent.click(screen.getByText("Processing"));
  rendered.rerender(
    <AiResponse task={task([tool("read")], "failed")} session={session} />,
  );
  expect(process).toHaveAttribute("open");
});

it("uses server channels even when their position would have fooled the old heuristic", () => {
  const value = task([
    text("Explicit answer", "answer"),
    tool("read"),
    text("Still commentary"),
  ]);
  expect(aiResponseSections(value).map((part) => part.type)).toEqual([
    "answer",
    "process",
  ]);
  const { container } = render(
    <AiResponse task={value} session={mock<LocalEditSession>()} />,
  );
  expect(
    screen.getByText("Explicit answer").closest('[data-test-id="ai-answer"]'),
  ).toBeTruthy();
  expect(
    screen
      .getByText("Still commentary")
      .closest('[data-test-id="local-ai-operations"]'),
  ).toBeTruthy();
  expect(container.querySelectorAll('[data-test-id="ai-answer"]')).toHaveLength(
    1,
  );
});
it("shows received thought summaries before explicitly streamed answer text and preserves incomplete answers", () => {
  const value = task(
    [
      {
        type: "reasoning",
        text: "Summary of the analysis",
        step: 0,
        complete: true,
      },
      text("Partial answer", "answer", false),
    ],
    "failed",
  );
  render(<AiResponse task={value} session={mock<LocalEditSession>()} />);
  expect(screen.getByText("Thought summary")).toBeTruthy();
  expect(screen.getByText("Incomplete response")).toBeTruthy();
  expect(screen.queryByText("Final response")).toBeNull();
});
