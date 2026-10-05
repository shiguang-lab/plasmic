import type { DeepReadonly } from "@/wab/commons/types";
import { switchType } from "@/wab/shared/common";
import {
  InteractionConditionalMode,
  stripParens,
  tryExtractJson,
} from "@/wab/shared/core/exprs";
import { UpdateVariableOperations } from "@/wab/shared/core/states";
import {
  CustomCode,
  EventHandler,
  Expr,
  FunctionExpr,
  ObjectPath,
} from "@/wab/shared/model/classes";
import { parseJsCode } from "@/wab/shared/parser-utils";
import type { Node } from "estree";

const UNKNOWN = Symbol("unknown canvas action value");
type Value = string | number | boolean | null | undefined | typeof UNKNOWN;
type Bindings = Map<string, Value>;

/** Static analysis only: no user functions, calls, or business state are executed. */
class ActionAnalysis {
  readonly writes: Bindings = new Map();
  constructor(readonly args: Bindings) {}

  path(node: Node): string[] | undefined {
    if (node.type === "Identifier" && node.name === "$state") {
      return [];
    }
    if (node.type === "MemberExpression") {
      const parent = this.path(node.object);
      const key = node.computed
        ? this.value(node.property)
        : node.property.type === "Identifier"
          ? node.property.name
          : UNKNOWN;
      if (parent && (typeof key === "string" || typeof key === "number")) {
        return [...parent, String(key)];
      }
    }
    return undefined;
  }

  value(node: Node): Value {
    switch (node.type) {
      case "Literal":
        return node.value === null ||
          ["string", "number", "boolean"].includes(typeof node.value)
          ? (node.value as Value)
          : UNKNOWN;
      case "Identifier":
        return node.name === "undefined"
          ? undefined
          : this.args.has(node.name)
            ? this.args.get(node.name)
            : UNKNOWN;
      case "MemberExpression": {
        const path = this.path(node);
        const key = JSON.stringify(path);
        return path && this.writes.has(key) ? this.writes.get(key) : UNKNOWN;
      }
      case "UnaryExpression": {
        const value = this.value(node.argument);
        return value === UNKNOWN
          ? UNKNOWN
          : node.operator === "!"
            ? !value
            : UNKNOWN;
      }
      case "LogicalExpression": {
        const left = this.value(node.left);
        if (left === UNKNOWN) return UNKNOWN;
        if (node.operator === "&&") return left ? this.value(node.right) : left;
        if (node.operator === "||") return left ? left : this.value(node.right);
        return left == null ? this.value(node.right) : left;
      }
      case "BinaryExpression": {
        const left = this.value(node.left),
          right = this.value(node.right);
        if (left === UNKNOWN || right === UNKNOWN) return UNKNOWN;
        switch (node.operator) {
          case "===":
            return left === right;
          case "!==":
            return left !== right;
          case "==":
            return left == right;
          case "!=":
            return left != right;
          default:
            return UNKNOWN;
        }
      }
      case "ConditionalExpression": {
        const test = this.value(node.test);
        return test === UNKNOWN
          ? UNKNOWN
          : this.value(test ? node.consequent : node.alternate);
      }
      default:
        return UNKNOWN;
    }
  }

  statement(node: Node): boolean {
    switch (node.type) {
      case "Program":
      case "BlockStatement":
        return node.body.every((child) => this.statement(child));
      case "ExpressionStatement":
        return this.statement(node.expression);
      case "ArrowFunctionExpression":
      case "FunctionExpression":
        // Only the handler itself is unwrapped, never functions declared inside it.
        const values = [...this.args.values()];
        node.params.forEach((param, index) => {
          if (param.type === "Identifier" && !this.args.has(param.name)) {
            this.args.set(param.name, values[index] ?? UNKNOWN);
          }
        });
        return this.statement(node.body);
      case "IfStatement": {
        const condition = this.value(node.test);
        if (condition === UNKNOWN) {
          // Unknown branches cannot establish a definite overlay association.
          this.writes.clear();
          return false;
        }
        const branch = condition ? node.consequent : node.alternate;
        return !branch || this.statement(branch);
      }
      case "AssignmentExpression": {
        const path = this.path(node.left);
        if (path) {
          this.writes.set(
            JSON.stringify(path),
            node.operator === "=" ? this.value(node.right) : UNKNOWN,
          );
        }
        return true;
      }
      case "SequenceExpression":
        return node.expressions.every((child) => this.statement(child));
      case "VariableDeclaration":
        node.declarations.forEach((decl) => {
          if (decl.id.type === "Identifier")
            this.args.set(
              decl.id.name,
              decl.init ? this.value(decl.init) : undefined,
            );
        });
        return true;
      case "ReturnStatement":
        if (node.argument) this.statement(node.argument);
        return false;
      case "ThrowStatement":
        return false;
      case "FunctionDeclaration":
      case "EmptyStatement":
      case "CallExpression":
      case "Literal":
      case "Identifier":
        return true;
      default:
        // Loops, unknown control flow, and unsupported syntax are not guessed.
        this.writes.clear();
        return false;
    }
  }

  expression(expr: DeepReadonly<Expr>): Value {
    return switchType(expr)
      .when(ObjectPath, (object) =>
        object.path[0] === "$state"
          ? (this.writes.get(
              JSON.stringify(object.path.slice(1).map(String)),
            ) ?? UNKNOWN)
          : UNKNOWN,
      )
      .when(CustomCode, (code) => {
        try {
          const node = parseJsCode(stripParens(code.code)).body[0];
          return node?.type === "ExpressionStatement"
            ? this.value(node.expression)
            : UNKNOWN;
        } catch {
          return UNKNOWN;
        }
      })
      .elseUnsafe((): Value => {
        const value = tryExtractJson(expr);
        return value === null ||
          ["string", "number", "boolean"].includes(typeof value)
          ? (value as Value)
          : UNKNOWN;
      });
  }

  handler(expr: DeepReadonly<Expr>) {
    switchType(expr)
      .when(CustomCode, (code) => {
        try {
          this.statement(parseJsCode(stripParens(code.code)));
        } catch {
          this.writes.clear();
        }
      })
      .when(FunctionExpr, (fn) => {
        const values = [...this.args.values()];
        fn.argNames.forEach((name, index) => {
          if (!this.args.has(name))
            this.args.set(name, values[index] ?? UNKNOWN);
        });
        this.handler(fn.bodyExpr);
      })
      .when(EventHandler, (handler) => {
        for (const interaction of handler.interactions) {
          if (interaction.conditionalMode === InteractionConditionalMode.Never)
            continue;
          if (
            interaction.conditionalMode ===
              InteractionConditionalMode.Expression &&
            interaction.condExpr
          ) {
            const condition = this.expression(interaction.condExpr);
            if (condition === UNKNOWN) {
              this.writes.clear();
              break;
            }
            if (!condition) continue;
          }
          const args = new Map(
            interaction.args.map((arg) => [arg.name, arg.expr]),
          );
          if (interaction.actionName === "updateVariable") {
            const variable = args.get("variable"),
              value = args.get("value"),
              operation = args.get("operation");
            if (
              !variable ||
              !value ||
              (operation &&
                this.expression(operation) !==
                  UpdateVariableOperations.NewValue)
            )
              continue;
            const path = switchType(variable)
              .when(ObjectPath, (object) =>
                object.path[0] === "$state"
                  ? object.path.slice(1).map(String)
                  : undefined,
              )
              .when(CustomCode, (code) => {
                try {
                  const node = parseJsCode(stripParens(code.code)).body[0];
                  return node?.type === "ExpressionStatement"
                    ? this.path(node.expression)
                    : undefined;
                } catch {
                  return undefined;
                }
              })
              .elseUnsafe(() => undefined);
            if (path)
              this.writes.set(JSON.stringify(path), this.expression(value));
          } else if (interaction.actionName === "customFunction") {
            const code = args.get("customFunction");
            if (code) this.handler(code);
          }
        }
      })
      .elseUnsafe(() => {});
  }
}

/** Prove that this action's explicit state writes make the open condition true. */
export function actionOpensOverlay(
  handlers: DeepReadonly<Expr>[],
  args: Record<string, unknown>,
  open: DeepReadonly<Expr>,
): boolean {
  const bindings: Bindings = new Map(
    Object.entries(args).map(([key, value]) => [
      key,
      value === null || ["string", "number", "boolean"].includes(typeof value)
        ? (value as Value)
        : UNKNOWN,
    ]),
  );
  const analysis = new ActionAnalysis(bindings);
  handlers.forEach((handler) => analysis.handler(handler));
  return (
    analysis.writes.size > 0 &&
    analysis.expression(open) === true &&
    new ActionAnalysis(bindings).expression(open) !== true
  );
}
