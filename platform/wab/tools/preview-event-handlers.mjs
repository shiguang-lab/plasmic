import { traverse, types as t } from "@babel/core";

/** Business events execute outside React render. Outline their closures before
 * React Compiler sees them, independently of the JavaScript syntax they use.
 * Native JS retains completion/exception semantics; accessors retain live lexical
 * bindings. Components and Hooks remain in the original strict coverage check. */
export function outlineEventHandlers(ast, candidates) {
  const owners = new Set();
  const visited = new Set();
  const contains = (node, loc) => node.loc && loc &&
    (node.loc.start.line < loc.start.line || node.loc.start.line === loc.start.line && node.loc.start.column <= loc.start.column) &&
    (node.loc.end.line > loc.end.line || node.loc.end.line === loc.end.line && node.loc.end.column >= loc.end.column);
  const add = path => {
    if (!path?.node || visited.has(path.node)) {return;}
    visited.add(path.node);
    if (path.isIdentifier()) {
      const binding = path.scope.getBinding(path.node.name);
      if (binding?.path.isVariableDeclarator()) {return add(binding.path.get("init"));}
      if (binding?.path.isFunctionDeclaration()) {return add(binding.path);}
      return;
    }
    if (path.isConditionalExpression()) { add(path.get("consequent")); add(path.get("alternate")); return; }
    if (path.isLogicalExpression()) { add(path.get("left")); add(path.get("right")); return; }
    if (!path.getFunctionParent() ||
        !["ArrowFunctionExpression", "FunctionExpression", "FunctionDeclaration"].includes(path.node.type) ||
        candidates.some(candidate => contains(path.node, candidate.loc))) {return;}
    if (path.isFunctionDeclaration() && !path.parentPath.isBlockStatement()) {return;}
    let needsOriginalScope = false;
    path.traverse({
      Super() { needsOriginalScope = true; },
      PrivateName() { needsOriginalScope = true; },
      CallExpression(callPath) {
        if (t.isIdentifier(callPath.node.callee, { name: "eval" }) && !callPath.scope.getBinding("eval")) {needsOriginalScope = true;}
      },
    });
    if (!needsOriginalScope) {owners.add(path);}
  };
  traverse(ast, {
    CallExpression(path) {
      const callee = path.get("callee");
      if (!callee.isIdentifier()) {return;}
      const binding = callee.scope.getBinding(callee.node.name);
      if (binding?.path.isImportSpecifier() &&
          t.isIdentifier(binding.path.node.imported, { name: "createStateEventHandler" }) &&
          binding.path.parent.source.value === "@plasmicapp/react-web") {add(path.get("arguments.1"));}
    },
    JSXAttribute(path) {
      if (!t.isJSXIdentifier(path.node.name) || !/^on[A-Z]/.test(path.node.name.name)) {return;}
      const value = path.get("value");
      if (value.isJSXExpressionContainer()) {add(value.get("expression"));}
    },
  });
  // Inner handlers are moved first, so each closure is outlined only once.
  for (const owner of [...owners].reverse()) {
    const program = owner.findParent(path => path.isProgram());
    const closure = owner.scope.generateUidIdentifier("eventClosure");
    const factory = program.scope.generateUidIdentifier("createEventHandler");
    const captures = new Map();
    let lexicalThis;
    let lexicalArguments;
    let lexicalNewTarget;
    const isLexical = path => {
      for (let fn = path.getFunctionParent(); fn; fn = fn.getFunctionParent()) {
        if (!fn.isArrowFunctionExpression()) {return false;}
        if (fn === owner) {return true;}
      }
      return false;
    };
    owner.traverse({
      "Identifier|JSXIdentifier"(path) {
        if (path.parentPath === owner && path.key === "id") {return;}
        if (!path.isReferencedIdentifier() && !path.isBindingIdentifier()) {return;}
        const binding = path.scope.getBinding(path.node.name);
        if (!binding) {
          if (path.node.name === "arguments" && path.isReferencedIdentifier() && isLexical(path)) {
            lexicalArguments ??= { name: "arguments", paths: [], value: t.identifier("arguments") };
            lexicalArguments.paths.push(path);
          }
          return;
        }
        if (binding.scope.path.isProgram() || binding.path === owner && !owner.isFunctionDeclaration() || owner.isAncestor(binding.path)) {return;}
        let capture = captures.get(binding);
        if (!capture) {
          capture = { name: binding.identifier.name, paths: [], value: t.identifier(binding.identifier.name),
            writable: binding.constantViolations.some(violation => owner.isAncestor(violation)) };
          captures.set(binding, capture);
        }
        capture.paths.push(path);
      },
      ThisExpression(path) {
        if (!isLexical(path)) {return;}
        lexicalThis ??= { name: "this", paths: [], value: t.thisExpression() };
        lexicalThis.paths.push(path);
      },
      MetaProperty(path) {
        if (path.node.meta.name !== "new" || !isLexical(path)) {return;}
        lexicalNewTarget ??= { name: "newTarget", paths: [], value: t.cloneNode(path.node) };
        lexicalNewTarget.paths.push(path);
      },
    });
    const params = [], args = [], accessors = [];
    for (const capture of [...captures.values(), lexicalThis, lexicalArguments, lexicalNewTarget].filter(Boolean)) {
      const read = program.scope.generateUidIdentifier("read"), key = t.identifier(capture.name);
      params.push(read);
      args.push(t.arrowFunctionExpression([], capture.value));
      accessors.push(t.objectMethod("get", key, [], t.blockStatement([t.returnStatement(t.callExpression(read, []))])));
      if (capture.writable) {
        const write = program.scope.generateUidIdentifier("write"), value = owner.scope.generateUidIdentifier("value");
        params.push(write);
        args.push(t.arrowFunctionExpression([value], t.assignmentExpression("=", t.cloneNode(capture.value), value)));
        accessors.push(t.objectMethod("set", t.cloneNode(key), [value], t.blockStatement([t.expressionStatement(t.callExpression(write, [value]))])));
      }
      for (const path of capture.paths) {
        if (path.isJSXIdentifier()) {
          path.replaceWith(t.jsxMemberExpression(t.jsxIdentifier(closure.name), t.jsxIdentifier(capture.name)));
          continue;
        }
        if (path.parentPath.isObjectProperty() && path.parentPath.node.shorthand) {path.parentPath.node.shorthand = false;}
        const member = t.memberExpression(closure, t.cloneNode(key));
        // A captured bare call/tag must not acquire the closure as its `this`.
        const unbound = (path.parentPath.isCallExpression() || path.parentPath.isOptionalCallExpression()) && path.key === "callee" ||
          path.parentPath.isTaggedTemplateExpression() && path.key === "tag";
        path.replaceWith(unbound ? t.sequenceExpression([t.numericLiteral(0), member]) : member);
      }
    }
    const original = t.cloneNode(owner.node, true);
    if (t.isFunctionDeclaration(original)) {original.type = "FunctionExpression";}
    const declaration = t.functionDeclaration(factory, params, t.blockStatement([
      t.variableDeclaration("const", [t.variableDeclarator(closure, t.objectExpression(accessors))]),
      t.returnStatement(original),
    ]));
    const call = t.callExpression(factory, args);
    // HIR uses a Symbol for nodes with no source span. Give new render nodes
    // the handler's span so Babel's retainLines printer receives real locations.
    t.traverseFast(call, node => { node.loc ??= owner.node.loc; });
    if (owner.isFunctionDeclaration()) {
      const block = owner.parentPath;
      const name = t.cloneNode(owner.node.id);
      owner.remove();
      block.unshiftContainer("body", t.variableDeclaration("let", [t.variableDeclarator(name, call)]));
    } else {owner.replaceWith(call);}
    program.pushContainer("body", declaration);
    program.scope.crawl();
  }
}
