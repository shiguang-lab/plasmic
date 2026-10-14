import {
  aiOperationDetails,
  aiOperationError,
} from "@/wab/server/copilot/ai-operation-details";
import type { AiTask } from "@/wab/shared/copilot/ai-chat";
const task = {
  binding: { componentUuid: "page" },
  scopeLabel: "StandardListPage",
  nodes: [{ uuid: "node", name: "StatusFilter" }],
} as AiTask;
it("describes reads from actual requested resources and recorded identities", () => {
  expect(aiOperationDetails("read", {}, task)).toEqual({
    title: "Read project overview",
  });
  expect(
    aiOperationDetails("read", { componentUuids: ["page"] }, task),
  ).toEqual({ title: "Read page structure", target: "StandardListPage" });
  expect(
    aiOperationDetails(
      "read",
      { elements: [{ componentUuid: "page", elementUuid: "node" }] },
      task,
    ),
  ).toEqual({ title: "Read selected elements", target: "StatusFilter" });
  expect(aiOperationDetails("read", { elements: [null] }, task)).toEqual({});
  expect(
    aiOperationDetails("changeElement", { elementUuid: "unknown" }, task),
  ).toEqual({ target: "unknown" });
});
it("summarizes argument errors without exposing JSON as the main message", () => {
  expect(
    aiOperationError(
      '[{"code":"unrecognized_keys","message":"Unexpected reason"}]',
    ),
  ).toBe("Tool arguments were rejected.");
  expect(aiOperationError("Node no longer exists.\nRaw details")).toBe(
    "Node no longer exists.",
  );
});
