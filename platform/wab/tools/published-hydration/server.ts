import { genLoaderHtmlBundle } from "@/wab/server/loader/gen-html-bundle";
import { getHydrationScript, getHydrationScriptVersioned } from "@/wab/server/routes/loader-assets";
import express from "express";
import { bundleModules } from "@/wab/server/loader/module-bundler";
import { makeGlobalContextsProviderFileName } from "@/wab/server/loader/module-writer";
import { promises as fs } from "node:fs";
import path from "node:path";

export async function startServer({ fixtureSource, directory, baseline, reactDomClient }: { fixtureSource: string; directory: string; baseline: string; reactDomClient: string }) {
  const projectId = "published-hydration-regression";
  await fs.rm(directory, { recursive: true, force: true });
  await fs.mkdir(directory, { recursive: true });
  await fs.symlink(path.resolve(process.cwd(), "../loader-bundle-env/node_modules"), path.join(directory, "node_modules"), "dir");
  const source = JSON.stringify(fixtureSource.replace(/\\/g, "/"));
  const globalContext = makeGlobalContextsProviderFileName(projectId);
  const files: Record<string, string> = {
    "package.json": "{}",
    "root-provider.tsx": 'export {PlasmicRootProvider as default} from "@plasmicapp/react-web/skinny";',
    "page.tsx": `import React from "react"; import {PublishedPage} from ${source}; import {globalVariantHooks} from "@plasmicapp/loader-runtime-registry"; export default function Page(props){return <PublishedPage {...props} theme={globalVariantHooks["theme-group"]()}/>}`,
    [globalContext]: `export {PublishedContext as default} from ${source};`,
    "tokens.tsx": `export {PublishedTokens as StyleTokensProvider} from ${source};`,
    "theme.tsx": 'export const useTheme=()=>undefined;',
    "css__page.css": 'body{margin:0;background:#f2f3f8}input{margin:12px;padding:6px}form{padding:12px 0}button,a{margin-right:8px}h1{font-size:24px}section[role="dialog"]{padding:16px;border:1px solid #ddd;background:#fff}',
    "css-entrypoint.tsx": 'import "./css__page.css";',
  };
  for (const [name, content] of Object.entries(files)) await fs.writeFile(path.join(directory, name), content);
  const bundle = await bundleModules(directory, [{
    components: [{ id: "published-page", displayName: "PublishedPage", plasmicName: "PublishedPage", renderModuleFileName: "page.tsx", skeletonModuleFileName: "page.tsx", cssFileName: "css__page.css", path: "/published", isPage: true, isCode: false, metadata: {} }],
    globalVariants: [{ id: "theme-group", name: "Theme", type: "global-user-defined", contextFileName: "theme.tsx" }],
    projectConfig: { projectId, projectName: "Published hydration fixture", version: "1.2.3", indirect: false, fontUsages: [], hasStyleTokenOverrides: true, styleTokensProviderBundle: { fileName: "tokens.tsx" }, globalContextBundle: {} },
    activeSplits: [],
  }] as any, { "published-page": [] }, [], { platform: "react", mode: "production", loaderVersion: 10, browserOnly: false });
  await fs.writeFile(path.join(directory, "published-bundle.json"), JSON.stringify(bundle));
  const requests: Array<{ method: string; url: string }> = [];
  const app = express();
  app.use((req, _res, next) => { requests.push({ method: req.method, url: req.url }); next(); });
  const published = express.Router();
  published.get("/api/v1/loader/code/published", (req, res) => {
    if (req.query.projectId !== `${projectId}@1.2.3`) return res.status(404).json({ error: "Pinned project version required" });
    return res.redirect(`${req.baseUrl}/api/v1/loader/code/versioned?projectId=${encodeURIComponent(`${projectId}@1.2.3`)}`);
  });
  published.get("/api/v1/loader/code/versioned", (req, res) => {
    if (req.query.projectId !== `${projectId}@1.2.3`) return res.status(404).json({ error: "Pinned project version required" });
    return res.json(bundle);
  });
  published.get("/static/js/loader-hydrate.js", getHydrationScript);
  published.get("/static/js/loader-hydrate-js", getHydrationScript);
  published.get("/static/js/loader-hydrate.:hash.js", getHydrationScriptVersioned);
  app.use("/", published);
  app.use("/codegen", published);
  app.get("/baseline.js", (_req, res) => res.type("js").send(baseline));
  app.get("/published-mark.svg", (_req, res) => res.type("svg").send('<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><rect width="32" height="32" rx="6" fill="#635bff"/></svg>'));
  app.get("/favicon.ico", (_req, res) => res.status(204).end());
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Missing published test address");
  const url = `http://127.0.0.1:${address.port}`;
  const publicUrl = url + "/codegen";
  process.env.CODEGEN_HOST = publicUrl;
  process.env.CODEGEN_ORIGIN_HOST = url;
  app.get("/published", async (req, res, next) => {
    try {
      const mode = req.query.mode as string;
      const theme = req.query.theme === "light" ? "light" : "dark";
      const { html } = await genLoaderHtmlBundle({ projectId, projectToken: "fixture-token", component: "PublishedPage", version: "1.2.3", hydrate: mode !== "ssr", embedHydrate: !["remote", "cached-html"].includes(mode), prepass: true, componentProps: { title: "发布页面验收", initialCount: 0 }, globalVariants: [{ name: "Theme", value: theme, projectId }] });
      let body = html;
      if (mode === "baseline") {
        const module = { type: "code", fileName: "react-dom/client", imports: ["react-dom"], code: `var module={};\n${reactDomClient}\nObject.assign(exports,module.exports);` };
        const prepare = `<script>{const node=document.querySelector("[data-plasmic-component-data]");const data=JSON.parse(node.getAttribute("data-plasmic-component-data"));data.bundle.modules.browser.push(${JSON.stringify(module).replace(/</g, "\\u003c")});node.setAttribute("data-plasmic-component-data",JSON.stringify(data));}</script>`;
        body = body.replace(/(<script async="" src=)/, prepare + "$1").replace(/src="[^"]*\/static\/js\/loader-hydrate\.js"/, 'src="/baseline.js"');
      }
      if (mode === "cached-html") body = body.replace(/ data-plasmic-host="[^"]*"/, "");
      body = body.replace(/(<script async="" src=)/, '<script>window.__publishedSsr=document.querySelector("[data-testid=published-page]")</script>$1');
      res.type("html").send(`<!doctype html><html><head><meta charset="utf-8"></head><body>${body}</body></html>`);
    } catch (error) { next(error); }
  });
  app.use((error: any, _req: any, res: any, _next: any) => res.status(error.statusCode || error.status || 500).json({ error: error.message }));
  return { url, publicUrl, requests, close: () => new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())) };
}
