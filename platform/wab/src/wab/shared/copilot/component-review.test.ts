import { componentReviewContextSchema, describeReviewRegistration } from "@/wab/shared/copilot/component-review";
import { PROTOTYPE_TOOL_META, prototypeMutationSchema } from "@/wab/shared/copilot/prototype-tools";
import { mapCopilotToolsToJsonSchema } from "@/wab/shared/copilot/copilot-tool-types";

const context = { purpose: "Switch customer information content panels without route navigation" };
test("component suggestions expose runtime props without leaking internal editing controls", () => {
  const described = describeReviewRegistration({ name: "Overlay", props: {
    previewOpen: { type: "boolean", editOnly: true, description: "Internal editing reveal" },
    open: { type: "boolean" },
    value: { type: "string", editOnly: true, uncontrolledProp: "defaultValue" },
    onOpenChange: { type: "eventHandler", argTypes: [{ name: "open", type: "boolean" }] },
  } });
  expect(described.props).toEqual(["open", "value"]);
  expect(described.events).toEqual(["onOpenChange"]);
  expect(JSON.stringify(described)).not.toContain("previewOpen");
  expect(JSON.stringify(described)).not.toContain("Internal editing reveal");
});
test("summary field order follows registration priorities while retrieval text remains sorted", () => {
  const described = describeReviewRegistration({ name: "Records", props: { value: "string", zebra: "boolean", appearance: "object" } });
  expect(described.props).toEqual(["value", "zebra", "appearance"]);
  expect(described.sections[1]).toBe("appearance: object\nvalue: string\nzebra: boolean");
});
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
