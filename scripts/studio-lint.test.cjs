const assert = require("node:assert/strict");
const path = require("node:path");
const { test } = require("node:test");
const { ESLint } = require("eslint");

const repo = path.resolve(__dirname, "..");
const configured = new ESLint({ cwd: repo });
const productionFile = "platform/wab/src/wab/client/components/Shell.tsx";

async function lintRules(file, source, names) {
  const config = await configured.calculateConfigForFile(file);
  const eslint = new ESLint({
    cwd: repo,
    useEslintrc: false,
    baseConfig: {
      parser: "@typescript-eslint/parser",
      parserOptions: { ecmaVersion: 2022, sourceType: "module" },
      plugins: ["@typescript-eslint"],
      rules: Object.fromEntries(names.map((name) => [name, config.rules[name]])),
    },
  });
  const [result] = await eslint.lintText(source, { filePath: "fixture.ts" });
  return result.messages;
}

test("Studio permits signature parameters and rest exclusions but flags dead imports and locals", async () => {
  const messages = await lintRules(productionFile, `
    import { unusedImport } from "example";
    export function handler(request, response) {
      const unusedLocal = 1;
      const { omitted, ...forwarded } = request;
      return forwarded;
    }
  `, ["@typescript-eslint/no-unused-vars"]);
  assert.equal(messages.length, 2);
  assert.ok(messages.some((message) => message.message.includes("unusedImport")));
  assert.ok(messages.some((message) => message.message.includes("unusedLocal")));
});

test("const checks allow mixed destructuring and still report immutable declarations", async () => {
  const rules = ["prefer-const"];
  assert.deepEqual(await lintRules(productionFile, `
    let { stable, mutable } = source;
    mutable += 1;
    consume(stable, mutable);
  `, rules), []);
  const messages = await lintRules(productionFile, `
    let immutable = 1;
    consume(immutable);
  `, rules);
  assert.equal(messages.length, 1);
  assert.equal(messages[0].ruleId, "prefer-const");
});

test("empty test doubles are allowed while unexplained production empty functions still warn", async () => {
  const rules = ["@typescript-eslint/no-empty-function"];
  const source = "export const callback = () => {};";
  assert.equal((await lintRules(productionFile, source, rules)).length, 1);
  assert.deepEqual(await lintRules(
    "platform/wab/src/wab/client/components/Shell.test.tsx", source, rules,
  ), []);
  assert.deepEqual(await lintRules(productionFile,
    "export const callback = () => { /* No subscription was installed. */ };", rules,
  ), []);
});

test("single-base declaration merging is allowed without allowing redundant empty interfaces", async () => {
  const rules = ["@typescript-eslint/no-empty-interface"];
  const augmentation = `
    declare module "vitest" {
      interface ExpectStatic extends CustomMatchers<unknown> {}
    }
  `;
  const declarationFile = "platform/wab/src/wab/client/__testonly__/setupTests.d.ts";
  assert.deepEqual(await lintRules(declarationFile, augmentation, rules), []);
  assert.equal((await lintRules(productionFile, augmentation, rules)).length, 1);
  assert.equal((await lintRules(declarationFile, "interface Empty {}", rules)).length, 1);
});

test("compile-time assignability exceptions are restricted to their named fixtures", async () => {
  const rules = ["@typescript-eslint/no-unused-vars"];
  const source = `
    const siteAssignableToSafeSite: SafeSite = site;
    const unusedLocal = 1;
  `;
  const messages = await lintRules(
    "platform/wab/src/wab/shared/site-operation/__testonly__/safetest.ts", source, rules,
  );
  assert.equal(messages.length, 1);
  assert.ok(messages[0].message.includes("unusedLocal"));
  assert.equal((await lintRules(productionFile, source, rules)).length, 2);

  const apiSource = `
    function testStyleSectionAssignableToPublicStyleSection(value) { return value; }
    const unusedLocal = 1;
  `;
  const apiMessages = await lintRules(
    "platform/wab/src/wab/shared/ApiSchema.test.ts", apiSource, rules,
  );
  assert.equal(apiMessages.length, 1);
  assert.ok(apiMessages[0].message.includes("unusedLocal"));
  assert.equal((await lintRules(productionFile, apiSource, rules)).length, 2);
});
