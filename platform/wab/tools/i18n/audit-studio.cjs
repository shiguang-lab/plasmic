/** Report source text at UI sinks. Candidates need review: data and contracts
 * are deliberately not translated. Never use language-pack parity as coverage. */
const fs = require("node:fs");
const path = require("node:path");
const { parse } = require("@babel/parser");
const uiFields = new Set([
  "title",
  "label",
  "placeholder",
  "tooltip",
  "description",
  "message",
  "okText",
  "cancelText",
  "aria-label",
  "defaultContents",
  "actionText",
  "confirmLabel",
  "cancelLabel",
  "emptyMessage",
  "help",
  "text",
  "caption",
  "tooltipText",
  "emptyText",
  "buttonLabel",
  "confirmText",
  "helperText",
  "hint",
  "confirmButtonMessage",
  "noWorkspacesMessage",
  "textValue",
  "hoverText",
  "popover",
  "instruction",
  "emptyDescription",
  "disabledTooltip",
  "addText",
  "waitingChildren",
  "about",
  "inputBoxPlaceholder",
  "action",
  "emptyAddButtonText",
  "subtext",
  "popupTitle",
  "freeTrialTimeRemaining",
  "ruleName",
  "nextButtonText",
  "secondaryButtonText",
]);
const translated = new Set([
  "t",
  "uiT",
  "studioUiT",
  "translate",
  "translateUiLabel",
  "label",
  "uiLabel",
]);

function scanSource(source, file = "source.tsx") {
  const ast = parse(source, {
    sourceType: "module",
    plugins: ["typescript", "jsx"],
  });
  const candidates = new Map();
  const declarations = new Map();
  // Resolve only unambiguous local names. Cross-file data flow still needs review.
  function children(node, visit) {
    for (const [key, value] of Object.entries(node)) {
      if (["loc", "extra", "comments", "tokens"].includes(key)) {
        continue;
      }
      if (Array.isArray(value)) {
        value.forEach((x) => x?.type && visit(x));
      } else if (value?.type) {
        visit(value);
      }
    }
  }
  function index(node) {
    if (
      node.type === "VariableDeclarator" &&
      node.id.type === "Identifier" &&
      node.init
    ) {
      const name = node.id.name;
      declarations.set(name, declarations.has(name) ? null : node.init);
    }
    children(node, index);
  }
  index(ast);
  function report(node, kind) {
    const text =
      node.type === "TemplateLiteral"
        ? node.quasis.map((x) => x.value.cooked ?? x.value.raw).join("{…}")
        : node.value;
    if (typeof text !== "string" || !/[A-Za-z]{2}/.test(text)) {
      return;
    }
    candidates.set(node.start, {
      file,
      line: node.loc.start.line,
      start: node.start,
      end: node.end,
      kind,
      text: text.replace(/\s+/g, " ").trim(),
    });
  }
  function sink(node, kind, seen = new Set()) {
    if (!node || seen.has(node)) {
      return;
    }
    seen = new Set([...seen, node]);
    switch (node.type) {
      case "StringLiteral":
      case "JSXText":
        report(node, kind);
        break;
      case "TemplateLiteral":
        report(node, kind);
        node.expressions.forEach((n) => sink(n, "interpolation", seen));
        break;
      case "Identifier":
        sink(declarations.get(node.name), "variable:" + node.name, seen);
        break;
      case "ConditionalExpression":
        sink(node.consequent, kind, seen);
        sink(node.alternate, kind, seen);
        break;
      case "LogicalExpression":
      case "BinaryExpression":
        if (node.type === "LogicalExpression" || node.operator === "+") {
          sink(node.left, kind, seen);
          sink(node.right, kind, seen);
        }
        break;
      case "TSAsExpression":
      case "TSNonNullExpression":
      case "ParenthesizedExpression":
        sink(node.expression, kind, seen);
        break;
      case "CallExpression": {
        const name = node.callee.name ?? node.callee.property?.name;
        if (translated.has(name)) {
          // The key is localized, but interpolated fragments can still be English.
          const values = node.arguments[name === "translate" ? 2 : 1];
          if (values?.type === "ObjectExpression") {
            values.properties.forEach((p) =>
              sink(p.value, "interpolation", seen),
            );
          }
        } else if (["String", "pluralize", "capitalizeFirst"].includes(name)) {
          node.arguments.forEach((n) => sink(n, "interpolation", seen));
        }
        break;
      }
    }
  }
  function walk(node, parent) {
    if (
      node.type === "JSXOpeningElement" &&
      ["UiText", "UiLabel"].includes(node.name.name)
    ) {
      const values = node.attributes.find((a) => a.name?.name === "values")
        ?.value?.expression;
      if (values?.type === "ObjectExpression") {
        values.properties.forEach((p) => sink(p.value, "interpolation"));
      }
      return;
    }
    if (node.type === "JSXText") {
      sink(node, "jsx");
    }
    if (node.type === "JSXAttribute" && uiFields.has(node.name.name)) {
      sink(node.value?.expression ?? node.value, "attribute:" + node.name.name);
    }
    if (
      node.type === "JSXExpressionContainer" &&
      parent?.type !== "JSXAttribute"
    ) {
      sink(node.expression, "jsx-expression");
    }
    if (
      node.type === "ObjectProperty" &&
      (uiFields.has(node.key.name ?? node.key.value) ||
        (file.startsWith("tours/") && node.key.name === "content"))
    ) {
      sink(node.value, "property:" + (node.key.name ?? node.key.value));
    }
    if (node.type === "AssignmentPattern" && uiFields.has(node.left.name)) {
      sink(node.right, "default:" + node.left.name);
    }
    if (node.type === "CallExpression") {
      const name = node.callee.name ?? node.callee.property?.name;
      if (translated.has(name)) {
        sink(node, "translation");
      }
      if (
        (["message", "notification"].includes(node.callee.object?.name) &&
          ["info", "success", "error", "warn", "warning"].includes(name)) ||
        ["alert", "confirm", "prompt", "toast"].includes(name)
      ) {
        node.arguments.forEach((n) => sink(n, "call:" + name));
      }
    }
    children(node, (child) => walk(child, node));
  }
  walk(ast);
  return [...candidates.values()].sort((a, b) => a.line - b.line);
}

function scanDirectory(root) {
  const files = [],
    candidates = [];
  function visit(dir) {
    for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
      const file = path.join(dir, item.name);
      if (item.isDirectory()) {
        if (
          ![
            "node_modules",
            "icons",
            "__testonly__",
            "__mocks__",
            "i18n",
          ].includes(item.name)
        ) {
          visit(file);
        }
      } else if (
        /\.tsx?$/.test(file) &&
        !/\.(test|spec|stories|d)\.tsx?$/.test(file)
      ) {
        files.push(file);
        candidates.push(
          ...scanSource(
            fs.readFileSync(file, "utf8"),
            path.relative(root, file),
          ),
        );
      }
    }
  }
  visit(root);
  return { filesScanned: files.length, candidates };
}

module.exports = { scanSource, scanDirectory };
if (require.main === module) {
  const root = path.resolve(__dirname, "../../src/wab/client");
  // A parse error fails the command, rather than silently excluding a file.
  process.stdout.write(JSON.stringify(scanDirectory(root), null, 2) + "\n");
}
