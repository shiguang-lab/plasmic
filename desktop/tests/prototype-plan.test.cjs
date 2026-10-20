const test = require("node:test");
const assert = require("node:assert/strict");
const { validatePlan } = require("../src/prototype-plan.cjs");
const { planSchema, planExample } = require("../src/prototype-plan-schema.cjs");

test("the public complete plan example passes the actual validator", () => {
  assert.equal(validatePlan(planExample.suite, planExample.documents).length, 1);
  assert.equal(planSchema.properties.documents.properties.forms.type, "object");
});

test("plan format errors aggregate independent paths and point to the public schema", () => {
  const { suite, documents } = structuredClone(planExample);
  delete documents.structure.pages[0].screen;
  documents.structure.pages[0].copy.help = "wrong type";
  documents.forms.pages[0].forms = [{ name: "Basic", fields: [{ nodeName: "Name", name: "name", label: "名称", control: "Input", rules: [{ required: true }] }] }];
  assert.throws(() => validatePlan(suite, documents), (error) => {
    assert.equal(error.context.code, "INVALID_PLAN");
    assert.equal(error.context.operationExecuted, false);
    assert.equal(error.context.schemaTool.arguments.action, "plan_schema");
    assert.match(error.message, /screen/); assert.match(error.message, /copy\/help/); assert.match(error.message, /ruleType/);
    return true;
  });
});
