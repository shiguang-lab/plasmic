/** Inventory business error sources and raw UI sinks; review diagnostics separately. */
const fs = require("node:fs");
const path = require("node:path");
const { parse } = require("@babel/parser");
const base = path.resolve(__dirname, "../../src/wab");

function scanSource(source, file) {
  const errors = [],
    sinks = [], toastSinks = [];
  const ast = parse(source, {
    sourceType: "module",
    sourceFilename: file,
    plugins: ["typescript", "jsx", "decorators-legacy"],
  });
  function item(node) {
    return {
      file,
      line: node.loc.start.line,
      source: source.slice(node.start, node.end),
    };
  }
  function containsDiagnostic(node) {
    if (!node || typeof node !== "object") return false;
    if (node.type === "ConditionalExpression") return containsDiagnostic(node.consequent) || containsDiagnostic(node.alternate);
    if (node.type === "MemberExpression" && ["message", "description", "stack", "error", "errorMsg", "reason", "warning"].includes(node.property.name)
        && (/err|error|exception/i.test(source.slice(node.object.start, node.object.end)) || ["error", "errorMsg", "reason", "warning"].includes(node.property.name))) return true;
    if (node.type === "CallExpression" && ["getErrorMessage", "String"].includes(node.callee.name)
        && (node.callee.name === "getErrorMessage" || /err|error|exception/i.test(source.slice(node.start, node.end)))) return true;
    if (node.type === "JSXOpeningElement" && node.name.name === "ErrorDescription") return true;
    if (node.type === "Identifier" && ["errorMessage", "invalidCodeMessage", "invalidMessage"].includes(node.name)) return true;
    if (node.type === "TemplateLiteral" && node.expressions.some((expression) =>
        /^(err\w*|error\w*|e)$/.test(source.slice(expression.start, expression.end)))) return true;
    return Object.entries(node).some(([key, value]) =>
      !["loc", "extra", "comments"].includes(key) && (Array.isArray(value)
        ? value.some(containsDiagnostic) : value?.type && containsDiagnostic(value)));
  }
  function walk(node) {
    if (!node || typeof node !== "object") {
      return;
    }
    if (
      node.type === "NewExpression" &&
      /Error$/.test(node.callee.name ?? "") &&
      /^(server|shared)\//.test(file)
    ) {
      errors.push(item(node));
    }
    if (
      node.type === "CallExpression" &&
      ["checkPermissions", "ensureFound"].includes(node.callee.name)
    ) {
      errors.push(item(node));
    }
    if (
      file.startsWith("client/") &&
      ((node.type === "ObjectProperty" &&
        ["description", "message"].includes(node.key.name) &&
        node.value.type === "MemberExpression" &&
        node.value.property.name === "message") ||
        (node.type === "CallExpression" &&
          /^set\w*Error$/.test(node.callee.name ?? "") &&
          node.arguments.some(
            (a) =>
              a?.type === "MemberExpression" && a.property.name === "message",
          )))
    ) {
      sinks.push(item(node));
    }
    if (file.startsWith("client/") && node.type === "CallExpression" && node.callee.type === "MemberExpression"
        && ["notification", "message", "antdMessage"].includes(node.callee.object.name)
        && ["open", "error", "warning", "info"].includes(node.callee.property.name)
        && node.arguments.some(containsDiagnostic)) toastSinks.push(item(node));
    for (const [key, value] of Object.entries(node)) {
      if (["loc", "extra", "comments"].includes(key)) {
        continue;
      }
      if (Array.isArray(value)) {
        value.forEach((n) => n?.type && walk(n));
      } else if (value?.type) {
        walk(value);
      }
    }
  }
  walk(ast);
  return { errors, sinks, toastSinks };
}

function audit() {
  let filesScanned = 0;
  const errorSources = [],
    rawDisplaySinks = [], rawToastSinks = [];
  function walk(dir) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const file = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (
          ![
            "migrations",
            "icons",
            "plasmic",
            "__testonly__",
            "__mocks__",
          ].includes(e.name)
        ) {
          walk(file);
        }
      } else if (
        /\.tsx?$/.test(file) &&
        !/\.(test|spec|stories|d)\.tsx?$/.test(file)
      ) {
        filesScanned++;
        const result = scanSource(
          fs.readFileSync(file, "utf8"),
          path.relative(base, file),
        );
        errorSources.push(...result.errors);
        rawDisplaySinks.push(...result.sinks);
        rawToastSinks.push(...result.toastSinks);
      }
    }
  }
  for (const dir of ["server", "shared", "client"]) {
    walk(path.join(base, dir));
  }
  return { filesScanned, errorSources, rawDisplaySinks, rawToastSinks };
}
module.exports = { scanSource, audit };
if (require.main === module) {
  process.stdout.write(JSON.stringify(audit(), null, 2) + "\n");
}
