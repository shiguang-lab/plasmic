import { isScope, parseJsCode } from "@/wab/shared/parser-utils";
import { ancestor } from "acorn-walk";
import type { ArrowFunctionExpression, FunctionDeclaration, FunctionExpression, Node, Pattern, VariableDeclaration } from "estree";

type FunctionNode = FunctionDeclaration | FunctionExpression | ArrowFunctionExpression;
type Positioned<T> = T & { start: number; end: number };
type Declaration = { node: Positioned<VariableDeclaration>; kind: "statement" | "for-init" | "for-binding" };
type FunctionScope = {
  node: FunctionNode;
  names: Set<string>;
  existing: Set<string>;
  blockFunctions: Set<string>;
  declarations: Declaration[];
  insertion: number;
  blocked: boolean;
};

function bindingNames(pattern: Pattern): string[] {
  switch (pattern.type) {
    case "Identifier": return [pattern.name];
    case "AssignmentPattern": return bindingNames(pattern.left);
    case "RestElement": return bindingNames(pattern.argument);
    case "ArrayPattern": return pattern.elements.flatMap((element) => element ? bindingNames(element) : []);
    case "ObjectPattern": return pattern.properties.flatMap((property) => bindingNames(property.type === "RestElement" ? property.argument : property.value));
    case "MemberExpression": return [];
  }
}

/** Lower function-local var declarations without changing their function-wide
 * bindings. Entry declarations retain undefined-before-initialization; original
 * initializers remain in place. In particular, loops retain one shared binding,
 * rather than acquiring let's per-iteration closure semantics. */
export function lowerFunctionVars(code: string): string {
  if (!/\bvar\b/.test(code)) { return code; }
  const source = `(\n${code}\n)`;
  let ast: ReturnType<typeof parseJsCode>;
  try { ast = parseJsCode(source); }
  catch { return code; } // Existing expression diagnostics own invalid syntax.
  const scopes = new Map<FunctionNode, FunctionScope>();
  const getScope = (parents: Node[]): FunctionScope | undefined => {
    for (let i = parents.length - 2; i >= 0; i--) {
      const node = parents[i];
      if (!isScope(node)) { continue; }
      if (node.type === "Program" || node.type === "StaticBlock" || node.body.type !== "BlockStatement") { return undefined; }
      let scope = scopes.get(node);
      if (!scope) {
        const body = node.body as Positioned<typeof node.body>;
        const existing = new Set(node.params.flatMap(bindingNames));
        let insertion = body.start + 1;
        let blocked = false;
        for (const statement of body.body) {
          if (statement.type === "FunctionDeclaration" && statement.id) { existing.add(statement.id.name); }
        }
        for (const statement of body.body) {
          if (!(statement.type === "ExpressionStatement" && "directive" in statement && typeof statement.directive === "string")) { break; }
          insertion = (statement as Positioned<typeof statement>).end;
          blocked ||= statement.directive === "use asm";
        }
        scope = { node, names: new Set(), existing, blockFunctions: new Set(), declarations: [], insertion, blocked };
        scopes.set(node, scope);
      }
      return scope;
    }
    return undefined;
  };
  ancestor(ast, {
    VariableDeclaration(node, parents) {
      if (node.kind !== "var") { return; }
      const scope = getScope(parents);
      if (!scope) { return; }
      const parent = parents[parents.length - 2];
      const kind = parent.type === "ForStatement" && parent.init === node ? "for-init" : (parent.type === "ForInStatement" || parent.type === "ForOfStatement") && parent.left === node ? "for-binding" : "statement";
      // Sloppy for-in initializers have an extra pre-loop evaluation step.
      if ((parent.type === "ForInStatement" || parent.type === "ForOfStatement") && node.declarations.some((declaration) => declaration.init)) { scope.blocked = true; }
      for (const declaration of node.declarations) {
        for (const name of bindingNames(declaration.id)) { scope.names.add(name); }
      }
      scope.declarations.push({ node: node as Positioned<VariableDeclaration>, kind });
    },
    CallExpression(node, parents) {
      if (node.callee.type === "Identifier" && node.callee.name === "eval") {
        const scope = getScope(parents);
        if (scope) { scope.blocked = true; }
      }
    },
    WithStatement(_node, parents) {
      const scope = getScope(parents);
      if (scope) { scope.blocked = true; }
    },
    FunctionDeclaration(node, parents) {
      const scope = getScope(parents);
      if (scope && parents[parents.length - 2] !== scope.node.body && node.id) { scope.blockFunctions.add(node.id.name); }
    },
  });
  const edits: Array<{ start: number; end: number; render(): string }> = [];
  const range = (node: Node) => { const positioned = node as Positioned<Node>; return render(positioned.start, positioned.end); };
  for (const scope of scopes.values()) {
    // Preserve dynamic scope, Annex B aliasing and strict-mode restricted
    // bindings. Strict compilation still diagnoses unsupported syntax.
    if (scope.blocked || ["let", "arguments", "eval"].some((name) => scope.names.has(name)) || [...scope.blockFunctions].some((name) => scope.names.has(name))) { continue; }
    const names = [...scope.names].filter((name) => !scope.existing.has(name));
    if (names.length) { edits.push({ start: scope.insertion, end: scope.insertion, render: () => `\nlet ${names.join(", ")};\n` }); }
    for (const { node, kind } of scope.declarations) {
      edits.push({ start: node.start, end: node.end, render: () => {
        if (kind === "for-binding") { return range(node.declarations[0].id); }
        const assignments = node.declarations.flatMap((declaration) => declaration.init ? [`(${range(declaration.id)} = (${range(declaration.init)}))`] : []);
        return assignments.join(", ") + (kind === "for-init" ? "" : ";");
      } });
    }
  }
  if (!edits.length) { return code; }
  edits.sort((a, b) => a.start - b.start || Number(b.start === b.end) - Number(a.start === a.end) || b.end - a.end);
  function render(start: number, end: number): string {
    let result = "", cursor = start;
    for (const edit of edits) {
      if (edit.start < cursor || edit.end > end || edit.start >= end) { continue; }
      result += source.slice(cursor, edit.start) + edit.render();
      cursor = edit.end;
    }
    return result + source.slice(cursor, end);
  }
  return render(2, source.length - 2);
}
