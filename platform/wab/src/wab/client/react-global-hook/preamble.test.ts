import fs from "fs";
import path from "path";
import vm from "vm";

it.each(["public/static/js/preamble.js", "public/index.html", "../sub/public/static/host.html"])("does not reuse renderer ids after frame teardown: %s", (file) => {
  const source = fs.readFileSync(path.resolve(__dirname, "../../../../", file), "utf8");
  const script = file.endsWith(".js") ? source : Array.from(source.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)).map((m) => m[1]).find((s) => s.includes("lastRendererId"));
  expect(script).toBeDefined();
  const win: any = {};
  win.parent = win;
  vm.runInNewContext(script as string, { window: win });
  const hook = win.__REACT_DEVTOOLS_GLOBAL_HOOK__;
  const retained = {}, replacement = {};
  const first = hook.inject({}), second = hook.inject(retained);
  hook.renderers.delete(first);
  const third = hook.inject(replacement);
  expect([first, second, third]).toEqual([1, 2, 3]);
  expect(hook.renderers.get(second)).toBe(retained);
  expect(hook.renderers.get(third)).toBe(replacement);
});
