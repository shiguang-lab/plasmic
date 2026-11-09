import { parseJsCode } from "@/wab/shared/parser-utils";
import { full } from "acorn-walk";
import type { MemberExpression, Node, UpdateExpression } from "estree";

type Positioned<T> = T & { start: number; end: number };

/** Keep JavaScript's member-update value and numeric coercion explicit when
 * emitting authored expressions. React Compiler 1.0.0 otherwise rereads the
 * property after storing it (react/react#35205), changing postfix into prefix. */
export function lowerMemberUpdates(code: string): string {
  if (!code.includes("++") && !code.includes("--")) { return code; }
  const source = `(\n${code}\n)`;
  const updates: Positioned<UpdateExpression & { argument: MemberExpression }>[] = [];
  try {
    full(parseJsCode(source), (node) => {
      if (node.type === "UpdateExpression" && node.argument.type === "MemberExpression" && node.argument.object.type !== "Super" && node.argument.property.type !== "PrivateIdentifier") {
        updates.push(node as Positioned<UpdateExpression & { argument: MemberExpression }>);
      }
    });
  } catch {
    // Invalid authored code is handled by the existing expression diagnostics.
    return code;
  }
  if (!updates.length) { return code; }
  updates.sort((a, b) => a.start - b.start || b.end - a.end);
  const range = (node: Node) => {
    const { start, end } = node as Positioned<Node>;
    return render(start, end);
  };
  const render = (start: number, end: number): string => {
    let result = "", cursor = start;
    for (const update of updates) {
      if (update.start < cursor || update.end > end) { continue; }
      const member = update.argument;
      const object = range(member.object);
      const key = member.computed ? range(member.property) : JSON.stringify((member.property as { name: string }).name);
      result += source.slice(cursor, update.start) + `((__plasmicObject, __plasmicKey) => {
        let __plasmicValue = __plasmicObject[__plasmicKey];
        const __plasmicPrevious = __plasmicValue${update.operator};
        __plasmicObject[__plasmicKey] = __plasmicValue;
        return ${update.prefix ? "__plasmicValue" : "__plasmicPrevious"};
      })(${object}, ${key})`;
      cursor = update.end;
    }
    return result + source.slice(cursor, end);
  };
  return render(0, source.length);
}
