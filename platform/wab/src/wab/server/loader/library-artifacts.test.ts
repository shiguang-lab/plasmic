import { buildLibraryArtifact, materializeLibraryArtifacts } from "@/wab/server/loader/library-artifacts";
import { bundleModules } from "@/wab/server/loader/module-bundler";
import { writeCodeBundlesToDisk } from "@/wab/server/loader/module-writer";
import type { CachedCodegenOutputBundle } from "@/wab/server/workers/codegen";
import type { Site } from "@/wab/shared/model/classes";
import { promises as fs } from "fs";
import os from "os";
import path from "path";
import { runInNewContext } from "vm";
import { expect, it } from "vitest";

it("publishes an unknown library with CSS, context and transitive code without installing it in Loader", async () => {
  const source = await fs.mkdtemp(path.join(os.tmpdir(), "new-library-source-"));
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "new-library-page-"));
  const pkg = "@preview-test/new-library";
  const site = {
    hostLessPackageInfo: { name: "new-library", npmPkg: [pkg], registerCalls: [], cssImport: [], deps: [] },
    components: [{ codeComponentMeta: { importPath: `${pkg}/Panel` } }, { codeComponentMeta: { importPath: `${pkg}/Context` } }],
    codeLibraries: [], customFunctions: [],
  } as unknown as Site;
  try {
    const root = path.join(source, "node_modules", pkg);
    await fs.mkdir(root, { recursive: true });
    await fs.writeFile(path.join(root, "package.json"), JSON.stringify({ name: pkg, version: "1.0.0", main: "index.js" }));
    await fs.writeFile(path.join(root, "index.js"), `import {registerComponent} from "@plasmicapp/host"; import {Panel} from "./Panel.js"; export function registerAll(){registerComponent(Panel,{name:"NewPanel",props:{},importPath:"${pkg}/Panel",importName:"Panel"});}`);
    await fs.writeFile(path.join(root, "Panel.js"), 'import "./panel.css"; import {label} from "transitive-library"; export function Panel(){return label;}');
    await fs.writeFile(path.join(root, "Context.js"), 'export function Context(){return "context";}');
    await fs.writeFile(path.join(root, "panel.css"), '.new-library-panel { color: rgb(1, 2, 3); }');
    await fs.mkdir(path.join(source, "node_modules/transitive-library"));
    await fs.writeFile(path.join(source, "node_modules/transitive-library/package.json"), '{"name":"transitive-library","version":"2.0.0","main":"index.js"}');
    await fs.writeFile(path.join(source, "node_modules/transitive-library/index.js"), 'export const label="immutable-v1";');
    const artifact = await buildLibraryArtifact(site, source);
    expect(artifact.packages).toEqual({ [pkg]: "1.0.0" });
    const registry: unknown[] = [];
    const styles: { textContent: string }[] = [];
    runInNewContext(artifact.canvas, { window: { __Sub: { registerComponent: (...args: unknown[]) => registry.push(args) } }, document: { createElement: () => ({}), head: { appendChild: (style: { textContent: string }) => styles.push(style) } } });
    expect(registry).toHaveLength(1);
    expect(styles.map((style) => style.textContent).join("")).toContain(".new-library-panel");
    // Neither source nor its dependencies are available to the page publisher.
    await fs.writeFile(path.join(source, "node_modules/transitive-library/index.js"), 'export const label="changed-v2";');
    const newer = await buildLibraryArtifact(site, source);
    expect(newer.digest).not.toBe(artifact.digest);
    await fs.rm(source, { recursive: true, force: true });
    const output = {
      components: [{ id: "new-library-page", displayName: "New library", plasmicName: "NewLibrary", skeletonModuleFileName: "page.tsx", renderModuleFileName: "render.tsx", cssFileName: "css__page.css", isPage: false, isCode: false, metadata: {}, skeletonModule: `export {Panel} from "${pkg}/Panel"; export {Context} from "${pkg}/Context";` }],
      projectConfig: { projectId: "test", projectName: "Test", version: "1.0.0", indirect: false, cssFileName: "project.css", cssRules: "", fontUsages: [] },
      defaultStyles: { defaultStyleCssFileName: "defaults.css", defaultStyleCssRules: "" },
      globalVariants: [], iconAssets: [], imageAssets: [], externalCssImports: [],
    } as unknown as CachedCodegenOutputBundle;
    await writeCodeBundlesToDisk(dir, [output]);
    // JSONB may reorder keys: verify the digest after a reordered round trip.
    const roundTrip = { ...artifact, files: Object.fromEntries(Object.entries(artifact.files).reverse()) };
    const libraryModules = await materializeLibraryArtifacts(dir, [roundTrip]);
    const bundle = await bundleModules(dir, [output], { "new-library-page": [] }, [], { platform: "nextjs", mode: "production", loaderVersion: 10, browserOnly: true, ...libraryModules });
    expect(Array.isArray(bundle.modules) ? undefined : bundle.modules.server).toEqual([]);
    expect(JSON.stringify(bundle)).toContain("immutable-v1");
    expect(JSON.stringify(bundle)).not.toContain("changed-v2");
    expect(JSON.stringify(bundle)).toContain(".new-library-panel");
    await expect(materializeLibraryArtifacts(dir, [{ ...artifact, canvas: "tampered" }])).rejects.toThrow("checksum");
    await expect(materializeLibraryArtifacts(dir, [artifact, newer])).rejects.toThrow("Conflicting transitive component library dependencies");
  } finally {
    await fs.rm(source, { recursive: true, force: true });
    await fs.rm(dir, { recursive: true, force: true });
  }
});
