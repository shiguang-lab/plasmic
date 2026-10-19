import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { parse } from "@babel/parser";
const root = path.resolve(__dirname, "../../../..");
function legacyReferences(source: string, filename = "consumer.tsx"): string[] {
  if (filename.endsWith(".html")) return /refreshXModules|__GetlibsReadyResolver|js\/getlibs\.js/.test(source) ? ["legacy HTML consumer"] : [];
  const file = parse(source, { sourceType: "unambiguous", allowReturnOutsideFunction: true, plugins: ["typescript", "decorators-legacy", ...(/\.[jt]sx$/.test(filename) ? ["jsx" as const] : [])] });
  const references: string[] = [];
  function visit(node: any) {
    if (!node || typeof node !== "object") return;
    if (node.type === "Identifier" && ["refreshXModules", "__GetlibsReadyResolver", "SystemJS", "updateModules"].includes(node.name)) references.push(node.name);
    if (node.type === "StringLiteral" && /client\.527c56\.js|(?:^|\/)js\/getlibs\.js/.test(node.value)) references.push(node.value);
    if (node.type === "MemberExpression" && node.object?.name === "getBuiltinComponentRegistrations" && node.property?.name === "cache") references.push("getBuiltinComponentRegistrations.cache");
    for (const value of Object.values(node)) {
      if (Array.isArray(value)) value.forEach(visit);
      else if (value && typeof value === "object") visit(value);
    }
  }
  visit(file);
  return references;
}
function scan(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) return entry.name === "build" ? [] : scan(file);
    if (!/\.(?:[cm]?[jt]sx?|html)$/.test(entry.name) || /(?:\.test\.|\.spec\.|\.snap$)/.test(entry.name)) return [];
    return legacyReferences(fs.readFileSync(file, "utf8"), file).map((reference) => `${path.relative(root, file)}: ${reference}`);
  });
}
it("has no executable legacy Preview consumers in source, SDK hosts or tools", () => {
  expect(["platform/wab/src", "platform/wab/tools", "platform/live-frame/src", "platform/sub/public/static", "packages/host/src"].flatMap((name) => scan(path.join(root, name)))).toEqual([]);
});
it.each(["win.System.refreshXModules()", "win.__GetlibsReadyResolver = resolve", "updateModules(doc, modules)", 'fetch("client.527c56.js")', "getBuiltinComponentRegistrations.cache.delete(runtime)"])("recognizes the old Preview contract independently: %s", (source) => {
  expect(legacyReferences(source).length).toBeGreaterThan(0);
});
it("does not confuse the regression guard itself with an executable legacy call", () => {
  expect(legacyReferences("const forbidden = /refreshXModules|__GetlibsReadyResolver/;")).toEqual([]);
});
it("retains only the published legacy URL reload prompt, with no old rendering engine", () => {
  const source = fs.readFileSync(path.join(root, "platform/wab/public/static/js/getlibs.js"), "utf8");
  const render = vi.fn();
  const window: any = { __Sub: { React: { createElement: (...args: any[]) => args }, hostUtils: { setPlasmicRootNode: render } } };
  vm.runInNewContext(source, { window });
  expect(Object.keys(window.System).sort()).toEqual(["newModule", "refreshXModules", "resolveSync", "set"]);
  expect(window.SystemJS).toBe(window.System);
  window.System.refreshXModules();
  expect(render).toHaveBeenCalledExactlyOnceWith(["div", { style: { padding: 16 } }, "Plasmic Studio was updated. Please reload this browser tab to use live preview."]);
});
