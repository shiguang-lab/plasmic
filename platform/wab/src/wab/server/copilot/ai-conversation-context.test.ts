import {
  conversationContext,
  type ConversationTurn,
} from "@/wab/server/copilot/ai-conversation-context";

const turn = (id: number): ConversationTurn => ({
  id: `run-${id}`,
  prompt: `Requirement ${id}`,
  answer: `Suggestion ${id}`,
  status: "completed",
  files: [],
  changes: [{ name: "changeElement", undone: id === 2 }],
});

it("retains source identities, user corrections and undone results in chronological order", () => {
  const context = JSON.parse(conversationContext([turn(3), turn(2), turn(1)]));
  expect(
    context.turns.map((value: { sourceRunId: string }) => value.sourceRunId),
  ).toEqual(["run-1", "run-2", "run-3"]);
  expect(context.turns[1].changes).toEqual([
    { name: "changeElement", undone: true },
  ]);
  expect(context.note).toContain(
    "assistant suggestions are not user decisions",
  );
  expect(context.earlierMessagesOmitted).toBe(false);
});

it("bounds long conversations and identifies omitted history instead of claiming complete memory", () => {
  const turns = Array.from({ length: 100 }, (_, index) => ({
    ...turn(index),
    prompt: `Latest ${index} ` + "需求".repeat(3000),
    answer: "Advice ".repeat(2000),
  }));
  const text = conversationContext(turns);
  const context = JSON.parse(text);
  expect(text.length).toBeLessThan(12500);
  expect(context.earlierMessagesOmitted).toBe(true);
  expect(context.turns.at(-1).sourceRunId).toBe("run-0");
  expect(context.turns.at(-1).userRequest).toContain("Latest 0");
});
