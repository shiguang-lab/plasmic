import { types } from "@babel/core";

const functionTypes = new Set(["FunctionDeclaration", "FunctionExpression", "ArrowFunctionExpression", "ObjectMethod", "ClassMethod", "ClassPrivateMethod"]);
const hookName = /^use[A-Z0-9]/;
const componentName = /^[A-Z]/;

function callName(node) {
  if (["TSAsExpression", "TSNonNullExpression", "TSExpressionWithTypeArguments"].includes(node?.type)) { return callName(node.expression); }
  if (node?.type === "Identifier") { return node.name; }
  if (node?.type === "MemberExpression" && !node.computed && node.property.type === "Identifier") { return node.property.name; }
  return undefined;
}

/** Read original, untransformed Babel File ASTs without mutating them.
 * Resolve imported base-class names across the audited source set, so a
 * subclass in another file cannot disappear from the migration inventory. */
export function reactComponentBases(asts) {
  const edges = [];
  for (const ast of asts) {
    const visit = (node) => {
      if ((node.type === "ClassDeclaration" || node.type === "ClassExpression") && node.id) {
        edges.push([node.id.name, callName(node.superClass)]);
      }
      if (node.type === "VariableDeclarator" && node.id.type === "Identifier") {
        edges.push([node.id.name, callName(node.init)]);
      }
      if (node.type === "ImportSpecifier" && node.imported.type === "Identifier") {
        edges.push([node.local.name, node.imported.name]);
      }
      visitChildren(node, visit);
    };
    visit(ast.program);
  }
  const bases = new Set(["Component", "PureComponent"]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const [name, base] of edges) {
      if (bases.has(base) && !bases.has(name)) { bases.add(name); changed = true; }
    }
  }
  return bases;
}

function visitChildren(node, visit) {
  for (const key of types.VISITOR_KEYS[node.type] ?? []) {
    const value = node[key];
    if (Array.isArray(value)) { value.forEach((child) => { if (child) { visit(child); } }); }
    else if (value) { visit(value); }
  }
}

/** Read the original Babel File AST before Compiler transforms it.
 * Source candidates are counted independently of Compiler's inference. In
 * particular, factory-owned fibers and render callbacks containing Hooks must
 * not disappear from coverage merely because Compiler never visited them. */
export function reactCompilerCandidates(ast, knownBases = []) {
  const candidates = [];
  const componentTypes = new Set(), reactNamespaces = new Set(["React"]);
  for (const statement of ast.program.body) {
    if (statement.type !== "ImportDeclaration" || statement.source.value !== "react") { continue; }
    for (const specifier of statement.specifiers) {
      if (specifier.type === "ImportDefaultSpecifier" || specifier.type === "ImportNamespaceSpecifier") { reactNamespaces.add(specifier.local.name); }
      else if (specifier.type === "ImportSpecifier" && ["ComponentType", "FunctionComponent", "FC"].includes(specifier.imported.name)) { componentTypes.add(specifier.local.name); }
    }
  }
  const returnsComponent = (factory) => {
    const annotation = factory?.returnType?.typeAnnotation;
    if (annotation?.type !== "TSTypeReference") { return false; }
    const type = annotation.typeName;
    return type.type === "Identifier" ? componentTypes.has(type.name)
      : type.type === "TSQualifiedName" && type.left.type === "Identifier" && reactNamespaces.has(type.left.name) && ["ComponentType", "FunctionComponent", "FC"].includes(type.right.name);
  };
  const componentBases = new Set(["Component", "PureComponent", ...knownBases]);
  const ancestry = [];
  function visit(node) {
    const parent = ancestry.at(-1);
    if (node.type === "VariableDeclarator" && node.id.type === "Identifier" && componentBases.has(callName(node.init))) { componentBases.add(node.id.name); }
    if ((node.type === "ClassDeclaration" || node.type === "ClassExpression") && componentBases.has(callName(node.superClass))) {
      const name = node.id?.name ?? (parent?.type === "VariableDeclarator" ? parent.id.name : undefined);
      if (name) { componentBases.add(name); }
      const errorCapture = node.body.body.some((member) => member.type === "ClassMethod" &&
        member.key.type === "Identifier" && (member.key.name === "componentDidCatch" || (member.static && member.key.name === "getDerivedStateFromError")));
      candidates.push({ name: name ?? "<anonymous>", kind: "class", errorCapture, loc: node.loc });
    }
    if (functionTypes.has(node.type)) {
      let name = node.id?.name;
      for (let index = ancestry.length - 1; !name && index >= 0; index--) {
        const owner = ancestry[index];
        if (owner.type === "VariableDeclarator" && owner.id.type === "Identifier") { name = owner.id.name; break; }
        if (owner.type === "CallExpression" && !["memo", "forwardRef"].includes(callName(owner.callee))) { break; }
        if (functionTypes.has(owner.type) || owner.type === "ReturnStatement" || owner.type === "ObjectProperty" || owner.type === "JSXAttribute" || owner.type === "JSXElement") { break; }
      }
      let hasHook = false, hasElement = false;
      const inspect = (child) => {
        if (functionTypes.has(child.type) || child.type === "ClassDeclaration" || child.type === "ClassExpression") { return; }
        if (child.type === "JSXElement" || child.type === "JSXFragment") { hasElement = true; }
        if (child.type === "CallExpression" || child.type === "OptionalCallExpression") {
          const called = callName(child.callee);
          if (called && hookName.test(called)) { hasHook = true; }
          if (called === "createElement") { hasElement = true; }
        }
        visitChildren(child, inspect);
      };
      visitChildren(node, inspect);
      const factory = ancestry.findLast((owner) => functionTypes.has(owner.type));
      const typedReturnedFiber = hasElement && !node.id && (parent?.type === "ReturnStatement" || parent?.type === "ArrowFunctionExpression" && parent.body === node) && returnsComponent(factory);
      const wrapper = parent?.type === "CallExpression" && ["memo", "forwardRef"].includes(callName(parent.callee));
      if (node.type !== "ClassMethod" && node.type !== "ClassPrivateMethod" && (hasHook || (name && hookName.test(name)) || wrapper || typedReturnedFiber || (name && componentName.test(name) && hasElement))) {
        candidates.push({ name: name ?? "<anonymous>", kind: name && hookName.test(name) ? "hook" : "component", nested: ancestry.some((owner) => functionTypes.has(owner.type)), loc: node.loc });
      }
    }
    ancestry.push(node);
    visitChildren(node, visit);
    ancestry.pop();
  }
  visit(ast.program);
  return candidates;
}

export function uncompiledCandidates(candidates, compiled, diagnostics) {
  const location = (entry) => `${entry.loc?.start.line}:${entry.loc?.start.column}`;
  const successes = new Set(compiled.map(location));
  const rejected = new Set(diagnostics.map((entry) => location({ loc: entry.fnLoc })));
  return candidates.filter((candidate) => !successes.has(location(candidate))).map((candidate) => ({ ...candidate, rejected: rejected.has(location(candidate)) }));
}
