import { componentReviewContextSchema } from "@/wab/shared/copilot/component-review";
import { PROTOTYPE_TOOL_META, prototypeMutationSchema } from "@/wab/shared/copilot/prototype-tools";
import { mapCopilotToolsToJsonSchema } from "@/wab/shared/copilot/copilot-tool-types";

const context = { purpose: "Switch customer information content panels without route navigation" };
describe("component review contract", () => {
  it("accepts one natural functional description without operation mappings", () => {
    expect(componentReviewContextSchema.parse(context)).toEqual(context);
    expect(componentReviewContextSchema.parse({ purpose: "Display read-only customer fields" }).purpose).toBe("Display read-only customer fields");
  });
  it("accepts an explicit user choice as a boolean and treats omission as false", () => {
    expect(componentReviewContextSchema.parse({ ...context, customOnly: true }).customOnly).toBe(true);
    expect(componentReviewContextSchema.parse({ ...context, customOnly: false }).customOnly).toBe(false);
    expect(componentReviewContextSchema.parse(context).customOnly).toBeUndefined();
  });
  it.each([
    {}, { purpose: " " }, { purpose: 123 }, { purpose: "x".repeat(501) },
    { ...context, customOnly: "true" }, { ...context, customOnly: null },
    { ...context, operationIndexes: [0] }, { regions: [context] },
  ])("rejects missing, malformed or obsolete fields: %j", input => {
    expect(componentReviewContextSchema.safeParse(input).success).toBe(false);
  });
  it("requires one context for both single mutations and an entire batch", () => {
    const create = { name: "Customers", type: "page" };
    expect(PROTOTYPE_TOOL_META.createComponent.inputSchema.safeParse(create).success).toBe(false);
    expect(PROTOTYPE_TOOL_META.createComponent.inputSchema.safeParse({ ...create, reviewContext: context }).success).toBe(true);
    const operation = { name: "createComponent", input: create };
    expect(prototypeMutationSchema.safeParse(operation).success).toBe(true);
    expect(PROTOTYPE_TOOL_META.executeBatch.inputSchema.safeParse({ operations: [operation] }).success).toBe(false);
    expect(PROTOTYPE_TOOL_META.executeBatch.inputSchema.safeParse({ operations: [operation, operation], reviewContext: context }).success).toBe(true);
    expect(PROTOTYPE_TOOL_META.read.inputSchema.safeParse({}).success).toBe(true);
    expect(PROTOTYPE_TOOL_META.save.inputSchema.safeParse({}).success).toBe(true);
  });
  it("publishes only purpose and an optional user-choice boolean to agents", () => {
    const metadata = mapCopilotToolsToJsonSchema(PROTOTYPE_TOOL_META);
    const schema = metadata.createComponent.inputSchema as { properties: { reviewContext: { properties: Record<string, unknown>; required: string[] } } };
    expect(Object.keys(schema.properties.reviewContext.properties).sort()).toEqual(["customOnly", "purpose"]);
    expect(schema.properties.reviewContext.required).toEqual(["purpose"]);
    expect(JSON.stringify(schema)).toContain("otherwise pass false");
    expect(JSON.stringify(schema)).toContain("without existing registered components");
  });
});
