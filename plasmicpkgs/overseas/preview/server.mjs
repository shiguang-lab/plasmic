import { context } from "esbuild";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
const root = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const output = path.resolve(root, "../../../desktop/desktop-report/app-shell/local-preview");
await mkdir(output, { recursive: true });
await writeFile(path.join(output, "index.html"), '<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>AppShell · 本地组件预览</title><style>html,body,#root{width:100%;height:100%;margin:0}.app-shell-preview{width:100%;height:100%}body{font-family:system-ui,sans-serif}*{box-sizing:border-box}</style></head><body><div id="root"></div><script src="/main.js"></script></body></html>');
const build = await context({ entryPoints: [path.join(root, "main.tsx")], outfile: path.join(output, "main.js"), bundle: true, platform: "browser", sourcemap: true,
  // The demo uses Antd6 controls from the root workspace alongside Overseas
  // from the platform workspace; both must share React and Antd contexts.
  alias: Object.fromEntries(["react", "react-dom", "antd", "@plasmicapp/host"].map(name => [name, path.dirname(require.resolve(`${name}/package.json`))])),
  define: { "process.env.NODE_ENV": '"development"' } });
await build.watch();
await build.serve({ host: "127.0.0.1", port: 3106, servedir: output });
console.log("AppShell registered host / gallery: http://127.0.0.1:3106; preview: http://127.0.0.1:3106/?preview");
