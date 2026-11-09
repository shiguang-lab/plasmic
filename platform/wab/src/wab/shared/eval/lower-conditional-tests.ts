import { isScope, parseJsCode } from "@/wab/shared/parser-utils";
import { ancestor } from "acorn-walk";
import type { Expression } from "estree";

/** Compiler 1.0.0 cannot reconstruct a ternary test containing logical value
 * blocks. A sequence keeps the complete test in one value block, without
 * changing its scope, evaluation order, short circuiting or number of reads. */
export function lowerConditionalTests(code: string): string {
  if (!code.includes("?")) { return code; }
  const source = `(\n${code}\n)`;
  const tests = new Set<Expression>();
  try {
    ancestor(parseJsCode(source), {
      LogicalExpression(_node, parents) {
        for (let i = parents.length - 2; i >= 0; i--) {
          const parent = parents[i];
          if (isScope(parent)) { break; }
          if (parent.type === "ConditionalExpression" && parents[i + 1] === parent.test && parent.test.type !== "SequenceExpression") {
            tests.add(parent.test);
          }
        }
      },
    });
  } catch {
    // Invalid authored syntax retains the existing expression diagnostics.
    return code;
  }
  const insertions = [...tests].flatMap((test) => {
    const positioned = test as Expression & { start: number; end: number };
    return [{ at: positioned.start, text: "(0, " }, { at: positioned.end, text: ")" }];
  }).sort((a, b) => a.at - b.at);
  let result = "", cursor = 2;
  for (const insertion of insertions) {
    result += source.slice(cursor, insertion.at) + insertion.text;
    cursor = insertion.at;
  }
  return result + source.slice(cursor, source.length - 2);
}
