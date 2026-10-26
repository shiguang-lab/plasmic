import type { PenNode } from "@/wab/client/pen-importer/types";
import { assert } from "@/wab/shared/common";
import variant from "@jitl/quickjs-singlefile-browser-release-sync";
import { newQuickJSWASMModuleFromVariant } from "quickjs-emscripten-core";

let engine: ReturnType<typeof newQuickJSWASMModuleFromVariant> | undefined;

/** No host callbacks, modules, DOM, filesystem or networking are exposed. */
export async function runPenScript(
  code: string,
  node: PenNode,
): Promise<PenNode[]> {
  const input = { ...node.inputs };
  for (const line of code.split("\n")) {
    const match =
      /^\s*\*?\s*@input\s+([\w-]+):\s*(number|boolean|string|color|enum|ref)(.*)$/.exec(
        line,
      );
    if (!match) {continue;}
    const [, key, type, rest] = match;
    const raw = /\s=\s*(.+)$/.exec(rest)?.[1]?.trim();
    const options =
      type === "enum"
        ? [...rest.matchAll(/"((?:[^"\\]|\\.)*)"/g)].map((m) =>
            JSON.parse(`"${m[1]}"`),
          )
        : [];
    if (input[key] === undefined) {
      if (raw) {
        try {
          input[key] = JSON.parse(raw);
        } catch {
          input[key] = raw;
        }
      } else
        {input[key] =
          type === "number"
            ? 0
            : type === "boolean"
              ? false
              : (options[0] ?? "");}
    }
    // Stored instance inputs are authoritative. Some libraries intentionally pass
    // richer values than their editor-control annotations (e.g. pagination JSON).
    if (type === "number" && typeof input[key] === "number") {
      let value = input[key];
      assert(Number.isFinite(value), `Invalid script number: ${key}`);
      const min = /min\s*=\s*(-?[\d.]+)/.exec(rest);
      const max = /max\s*=\s*(-?[\d.]+)/.exec(rest);
      if (min) {value = Math.max(value, Number(min[1]));}
      if (max) {value = Math.min(value, Number(max[1]));}
      input[key] = value;
    }
  }
  const wasm = await (engine ??= newQuickJSWASMModuleFromVariant(variant));
  const runtime = wasm.newRuntime();
  runtime.setMemoryLimit(64 * 1024 * 1024);
  runtime.setMaxStackSize(512 * 1024);
  const deadline = Date.now() + 2000;
  runtime.setInterruptHandler(() => Date.now() > deadline);
  const context = runtime.newContext();
  try {
    const pencil = JSON.stringify({
      width: node.width ?? 200,
      height: node.height ?? 200,
      input,
    });
    // Source text executes inside QuickJS/WASM, never in the host JS realm.
    const result = context.evalCode(`
      let seed = 1;
      Math.random = () => ((seed = Math.imul(seed, 1664525) + 1013904223 >>> 0) / 4294967296);
      const pencil = JSON.parse(${JSON.stringify(pencil)});
      JSON.stringify((function() { ${code}\n })());
    `);
    if (result.error) {
      const error = context.dump(result.error);
      result.error.dispose();
      throw new Error(
        `Pen script failed (${node.name ?? node.scriptUri}): ${error?.message ?? error}`,
      );
    }
    let json: string;
    try {
      json = context.getString(result.value);
    } finally {
      result.value.dispose();
    }
    assert(json.length <= 8 * 1024 * 1024, "Pen script output is too large");
    const output = JSON.parse(json);
    assert(Array.isArray(output), "Pen scripts must return an array of layers");
    let count = 0;
    const check = (nodes: PenNode[], depth: number) => {
      assert(depth <= 64, "Pen script hierarchy is too deep");
      for (const n of nodes) {
        assert(
          n && typeof n.type === "string" && ++count <= 1000,
          "Invalid or excessive Pen script layers",
        );
        if (n.children) {
          assert(Array.isArray(n.children), "Invalid script children");
          check(n.children, depth + 1);
        }
      }
    };
    check(output, 0);
    return output;
  } finally {
    context.dispose();
    runtime.dispose();
  }
}
