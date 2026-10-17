import { batchResult } from "@/wab/shared/copilot/batch-result";

it("preserves every operation's resources and messages without conflating partial reads", () => {
  const full = { __type: "Component", uuid: "page", states: [{ initial: false }], html: "hidden content" };
  const outcomes = [
    { results: [full], messages: ["Created child A"] },
    { results: [{ ...full }], messages: ["Created child B"] },
    { results: [{ __type: "Project", uuid: "project", tokens: [] }] },
    { results: [{ __type: "Project", uuid: "project", components: [] }] },
    { results: [], messages: ["Removed component"] },
  ];
  const result = batchResult<(typeof outcomes)[number]["results"][number]>(["insertHtml", "insertHtml", "deleteStyleToken", "deleteComponent", "deleteComponent"], outcomes);
  expect(result.resources).toHaveLength(3);
  expect(result.operations.map(({ resourceIndexes, messages }) => ({
    results: resourceIndexes.map((index) => result.resources[index]),
    ...(messages ? { messages } : {}),
  }))).toEqual(outcomes);
});
