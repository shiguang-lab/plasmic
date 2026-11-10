import { types as t, traverse } from "@babel/core";

/** Existing Preview error boundaries are independent React render owners.
 * Give each one a module-level component, so Compiler analyzes each subtree
 * once instead of analyzing all nested render closures in a giant root.
 * Getter scopes retain deferred lexical reads; component and Hook coverage
 * is collected again after outlining. Component slots are left untouched. */
export function outlinePreviewRenderBoundaries(ast, candidates) {
  const owners = [];
  traverse(ast, {
    CallExpression(p) {
      const c = p.node.callee;
      if (
        t.isMemberExpression(c) &&
        !c.computed &&
        t.isIdentifier(c.property, { name: "renderBoundary" }) &&
        t.isMemberExpression(c.object) &&
        !c.object.computed &&
        t.isIdentifier(c.object.property, { name: "__plasmicLive" }) &&
        t.isIdentifier(
          t.isTSAsExpression(c.object.object)
            ? c.object.object.expression
            : c.object.object,
          { name: "window" },
        ) && !p.scope.getBinding("window")
      ) {
        const arg = p.get("arguments.0");
        if (
          arg.isArrowFunctionExpression() &&
          !arg.node.async &&
          arg.node.params.length === 0 &&
          !t.isBlockStatement(arg.node.body)
        )
          {owners.push(arg);}
      }
    },
  });
  if (!owners.length) { return false; }
  let index = 0;
  for (const owner of owners.reverse()) {
    let unsafe = candidates.some(
      (candidate) =>
        candidate.loc &&
        owner.node.loc &&
        (candidate.loc.start.line > owner.node.loc.start.line ||
          (candidate.loc.start.line === owner.node.loc.start.line &&
            candidate.loc.start.column >= owner.node.loc.start.column)) &&
        (candidate.loc.end.line < owner.node.loc.end.line ||
          (candidate.loc.end.line === owner.node.loc.end.line &&
            candidate.loc.end.column <= owner.node.loc.end.column)),
    );
    owner.traverse({
      Super() {
        unsafe = true;
      },
      PrivateName() {
        unsafe = true;
      },
      ThisExpression() {
        unsafe = true;
      },
      MetaProperty() {
        unsafe = true;
      },
      Identifier(p) {
        if (p.node.name === "arguments" && !p.scope.getBinding("arguments"))
          {unsafe = true;}
      },
      CallExpression(p) {
        if (
          t.isIdentifier(p.node.callee, { name: "eval" }) &&
          !p.scope.getBinding("eval")
        )
          {unsafe = true;}
      },
    });
    if (unsafe) {continue;}
    const program = owner.findParent((p) => p.isProgram()),
      scope = owner.scope.generateUidIdentifier("previewScope");
    const captures = new Map();
    owner.traverse({
      "Identifier|JSXIdentifier"(p) {
        if (!p.isReferencedIdentifier() && !p.isBindingIdentifier()) {return;}
        const binding = p.scope.getBinding(p.node.name);
        if (
          !binding ||
          binding.scope.path.isProgram() ||
          owner.isAncestor(binding.path)
        )
          {return;}
        let capture = captures.get(binding);
        if (!capture) {
          capture = {
            name: binding.identifier.name,
            paths: [],
            writable: binding.constantViolations.some((v) =>
              owner.isAncestor(v),
            ),
          };
          captures.set(binding, capture);
        }
        capture.paths.push(p);
      },
    });
    const params = [],
      args = [],
      accessors = [];
    for (const capture of captures.values()) {
      const read = program.scope.generateUidIdentifier("read"),
        key = t.identifier(capture.name);
      params.push(read);
      args.push(t.arrowFunctionExpression([], t.cloneNode(key)));
      accessors.push(
        t.objectMethod(
          "get",
          key,
          [],
          t.blockStatement([t.returnStatement(t.callExpression(read, []))]),
        ),
      );
      if (capture.writable) {
        const write = program.scope.generateUidIdentifier("write"),
          value = owner.scope.generateUidIdentifier("value");
        params.push(write);
        args.push(
          t.arrowFunctionExpression(
            [value],
            t.assignmentExpression("=", t.cloneNode(key), value),
          ),
        );
        accessors.push(
          t.objectMethod(
            "set",
            t.cloneNode(key),
            [value],
            t.blockStatement([
              t.expressionStatement(t.callExpression(write, [value])),
            ]),
          ),
        );
      }
      for (const p of capture.paths) {
        if (p.isJSXIdentifier()) {
          p.replaceWith(
            t.jsxMemberExpression(
              t.jsxIdentifier(scope.name),
              t.jsxIdentifier(capture.name),
            ),
          );
          continue;
        }
        if (p.parentPath.isObjectProperty() && p.parentPath.node.shorthand)
          {p.parentPath.node.shorthand = false;}
        const member = t.memberExpression(scope, t.cloneNode(key));
        const unbound =
          ((p.parentPath.isCallExpression() ||
            p.parentPath.isOptionalCallExpression()) &&
            p.key === "callee") ||
          (p.parentPath.isTaggedTemplateExpression() && p.key === "tag");
        p.replaceWith(
          unbound
            ? t.sequenceExpression([t.numericLiteral(0), member])
            : member,
        );
      }
    }
    let name;
    do {
      name = "PlasmicPreviewNode" + ++index;
    } while (owner.scope.hasBinding(name) || program.scope.hasBinding(name) || program.scope.hasGlobal(name) || program.scope.hasReference(name));
    const factory = owner.scope.generateUidIdentifier("createPreviewScope");
    const body = t.blockStatement([
      t.returnStatement(
        t.jsxFragment(t.jsxOpeningFragment(), t.jsxClosingFragment(), [
          t.jsxExpressionContainer(t.cloneNode(owner.node.body, true)),
        ]),
      ),
    ]);
    t.traverseFast(body, (n) => {
      n.loc ??= owner.node.loc;
    });
    const component = t.functionDeclaration(
      t.identifier(name),
      [t.objectPattern([t.objectProperty(t.identifier("scope"), scope)])],
      body,
    );
    component.loc = owner.node.loc;
    const declaration = t.functionDeclaration(
      factory,
      params,
      t.blockStatement([t.returnStatement(t.objectExpression(accessors))]),
    );
    const jsx = t.jsxElement(
      t.jsxOpeningElement(
        t.jsxIdentifier(name),
        [
          t.jsxAttribute(
            t.jsxIdentifier("scope"),
            t.jsxExpressionContainer(t.callExpression(factory, args)),
          ),
        ],
        true,
      ),
      null,
      [],
      true,
    );
    t.traverseFast(jsx, (n) => {
      n.loc ??= owner.node.loc;
    });
    owner.get("body").replaceWith(jsx);
    program.pushContainer("body", [declaration, component]);
  }
  if (!index) { return false; }
  // Bindings remain valid while callbacks are moved inside-out. Rebuilding
  // the entire module's scope for each boundary makes this pass quadratic.
  traverse(ast, {
    Program(p) {
      p.scope.crawl();
      p.stop();
    },
  });
  return true;
}
