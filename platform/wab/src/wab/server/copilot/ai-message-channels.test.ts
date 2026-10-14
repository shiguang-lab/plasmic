import { migrateAiMessageChannels } from "@/wab/server/copilot/ai-message-channels";
it("uses recorded tool decisions to label historical text and keeps unknown partial text incomplete", () => {
  expect(
    migrateAiMessageChannels(
      [
        { type: "markdown", text: "Reading.Done." },
        {
          type: "tool",
          operationId: "read",
          name: "read",
          status: "completed",
        },
        { type: "markdown", text: "Partial" },
      ],
      [
        { step: 0, response: { text: "Reading.", calls: [{}] } },
        { step: 1, response: { text: "Done.", calls: [] } },
      ],
    ),
  ).toEqual([
    {
      type: "markdown",
      channel: "commentary",
      step: 0,
      text: "Reading.",
      complete: true,
    },
    {
      type: "markdown",
      channel: "answer",
      step: 1,
      text: "Done.",
      complete: true,
    },
    { type: "tool", operationId: "read", name: "read", status: "completed" },
    {
      type: "markdown",
      channel: "commentary",
      text: "Partial",
      complete: false,
    },
  ]);
});
