import { logger } from "@/wab/server/observability";
import type { Site } from "@/wab/shared/model/classes";
import { assert, ensure } from "@/wab/shared/common";
import esbuild, { type Plugin } from "esbuild";
import { AsyncLocalStorage } from "async_hooks";
import { createHash } from "crypto";
import { promises as fs } from "fs";
import path from "path";
import stringify from "safe-stable-stringify";
import { createRequire } from "module";

/** Immutable module graph and registrations for a library's declared exports. */
export interface LibraryArtifact {
  digest: string;
  packages: Record<string, string>;
  imports: Record<string, string>;
  files: Record<string, string>;
  resolutions: Record<string, Record<string, string>>;
  canvas: string;
  server: string;
}

export const librarySources = new AsyncLocalStorage<{
  moduleRoot: string;
  serverModules: Record<string, string>;
}>();

export const libraryExternals = [
  "react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime",
  "@plasmicapp/host", "@plasmicapp/query",
  "@plasmicapp/loader-runtime-registry", "@plasmicapp/data-sources-context",
  "next", "next/head", "next/link", "next/router",
];

export const libraryAssetLoaders = Object.fromEntries(
  [".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp", ".woff", ".woff2", ".ttf"].map(
    (ext) => [ext, "dataurl" as const],
  ),
);

export function registrationEntry(site: Pick<Site, "hostLessPackageInfo">, exportRegister = false) {
  const info = ensure(site.hostLessPackageInfo, "Expected component library");
  const calls = info.registerCalls.length ? info.registerCalls : ["registerAll"];
  const imports = info.npmPkg.map((pkg, i) => `import * as library_${i} from ${JSON.stringify(pkg)};`).join("\n");
  const invoke = info.npmPkg.flatMap((_pkg, i) => calls.map((call) => `library_${i}[${JSON.stringify(call)}]();`)).join("\n");
  return `${imports}\n${exportRegister ? `export function register(){${invoke}}` : invoke}`;
}

export async function buildLibraryArtifact(site: Site, moduleRoot: string, canvasEntry = registrationEntry(site), serverEntry = registrationEntry(site, true)): Promise<LibraryArtifact> {
  moduleRoot = await fs.realpath(moduleRoot);
  const info = ensure(site.hostLessPackageInfo, "Expected component library");
  const imports = Array.from(new Set([
    ...site.components.flatMap((c) => c.codeComponentMeta
      ? [c.codeComponentMeta.importPath, c.codeComponentMeta.helpers?.importPath] : []),
    ...site.customFunctions.map((f) => f.importPath),
    ...site.codeLibraries.map((lib) => lib.importPath),
    ...info.cssImport,
  ].filter((p): p is string => !!p))).sort();
  const packages: Record<string, string> = {};
  for (const pkg of info.npmPkg) {
    const manifest = JSON.parse(await fs.readFile(path.join(moduleRoot, "node_modules", pkg, "package.json"), "utf8"));
    packages[pkg] = manifest.version;
  }
  // Retain the resolver's module graph, rather than prebundling each library:
  // the final page build must share dependency contexts across libraries.
  logger().info(`Library ${info.name}: validating export graph`);
  const result = await esbuild.build({
    absWorkingDir: moduleRoot,
    entryPoints: Object.fromEntries(imports.map((specifier, index) => [`entry-${index}`, specifier])),
    bundle: true, splitting: true, format: "esm", platform: "browser",
    external: libraryExternals, write: false, outdir: "library-build",
    loader: libraryAssetLoaders, minify: true, target: "es2020", metafile: true,
    define: { "process.env.NODE_ENV": '"production"' },
  });
  const meta = ensure(result.metafile, "Missing library module graph");
  const rawFiles = new Map(await Promise.all(Object.keys(meta.inputs).map(async (name) =>
    [path.resolve(moduleRoot, name), await fs.readFile(path.resolve(moduleRoot, name))] as const,
  )));
  const rawResolutions = new Map(Object.entries(meta.inputs).map(([name, input]) => [
    path.resolve(moduleRoot, name), Object.fromEntries(input.imports.filter((dep) => !dep.external).map((dep) => [
      ensure(dep.original, `Missing import specifier for ${dep.path}`), path.resolve(moduleRoot, dep.path),
    ])),
  ]));
  const entries = Object.fromEntries(imports.map((specifier, index) => {
    const entry = ensure(Object.entries(meta.outputs).find(([file, output]) =>
      output.entryPoint && (file.endsWith(`/entry-${index}.js`) || file.endsWith(`/entry-${index}.css`))), `Missing export ${specifier}`);
    return [specifier, path.resolve(moduleRoot, ensure(entry[1].entryPoint, "Missing entry module"))];
  }));
  logger().info(`Library ${info.name}: snapshotting ${rawFiles.size} modules`);
  const ids = new Map<string, string>();
  for (const [filename, source] of rawFiles) {
    let root = path.dirname(filename);
    let identity = "";
    while (root !== path.dirname(root)) {
      try {
        const manifest = JSON.parse(await fs.readFile(path.join(root, "package.json"), "utf8"));
        if (manifest.name && manifest.version) {
          identity = `${manifest.name}@${manifest.version}/${path.relative(root, filename)}`;
          break;
        }
        root = path.dirname(root);
      } catch (error) {
        if (error.code !== "ENOENT") { throw error; }
        root = path.dirname(root);
      }
    }
    assert(!!identity, `Library module has no package manifest: ${filename}`);
    const extension = filename.endsWith(".module.css") ? ".module.css" : path.extname(filename);
    ids.set(filename, `${createHash("sha256").update(identity).update(source).digest("hex")}${extension}`);
  }
  const files = Object.fromEntries(Array.from(rawFiles, ([filename, source]) => [ensure(ids.get(filename), "Missing module ID"), source.toString("base64")]));
  const resolutions = Object.fromEntries(Array.from(rawResolutions, ([filename, resolved]) => [
    ensure(ids.get(filename), "Missing importer ID"),
    Object.fromEntries(Object.entries(resolved).map(([specifier, destination]) => [specifier, ensure(ids.get(destination), "Missing dependency ID")])),
  ]));
  const entryNames = Object.fromEntries(imports.map((specifier) => [specifier, ensure(ids.get(ensure(entries[specifier], `Missing export ${specifier}`)), "Missing export module ID")]));
  logger().info(`Library ${info.name}: building canvas registration`);
  const canvas = await buildLibraryRegistration(canvasEntry, moduleRoot, "browser", info.cssImport);
  logger().info(`Library ${info.name}: building server registration`);
  const server = await buildLibraryRegistration(serverEntry, moduleRoot, "node");
  const content = { packages, imports: entryNames, files, resolutions, canvas, server };
  return { ...content, digest: createHash("sha256").update(ensure(stringify(content), "Missing artifact content")).digest("hex") };
}

export async function buildLibraryRegistration(entry: string, moduleRoot: string, target: "node" | "browser", cssImports: string[] = []) {
  const globals: Record<string, string> = {
    react: "__Sub.React", "react-dom": "__Sub.ReactDOM", "react-dom/client": "__Sub.ReactDOMClient",
    "react/jsx-runtime": "__Sub.jsxRuntime", "react/jsx-dev-runtime": "__Sub.jsxDevRuntime",
    "@plasmicapp/host": "__Sub", "@plasmicapp/query": "__Sub.PlasmicQuery",
  };
  const runtimePlugin: Plugin = {
    name: "library-shared-runtime",
    setup(build) {
      build.onResolve({ filter: /.*/ }, async (args) => {
        if (args.namespace === "shared-library-runtime" && target === "node") {
          return { path: args.path, external: true };
        }
        const hostMethod = args.path.match(/^@plasmicapp\/host\/(register\w+)$/)?.[1];
        if (hostMethod || globals[args.path]) {
          return { path: args.path, namespace: "shared-library-runtime" };
        }
        // Ant Design 6 is already part of the shared canvas runtime. Libraries
        // must use that instance so AppShell's ConfigProvider also governs their controls.
        const antd = args.path.match(/^antd(?:\/es\/(button|config-provider|divider|dropdown|message|modal|notification|tooltip)(?:\/index\.js)?)?$/);
        if (target === "browser" && antd && args.importer) {
          const requireFromImporter = createRequire(args.importer);
          const manifest = JSON.parse(await fs.readFile(requireFromImporter.resolve("antd/package.json"), "utf8"));
          if (manifest.version.startsWith("6.")) {
            const exports: Record<string, string> = { button: "Button", "config-provider": "ConfigProvider", divider: "Divider", dropdown: "Dropdown", message: "message", modal: "Modal", notification: "notification", tooltip: "Tooltip" };
            const runtime = "(__Sub.Antd6 ?? window.__CanvasPkgs.Antd6)";
            return { path: args.path, namespace: "shared-antd-runtime", pluginData: { value: antd[1] ? `${runtime}.${exports[antd[1]]}` : runtime } };
          }
        }
        return undefined;
      });
      build.onLoad({ filter: /.*/, namespace: "shared-antd-runtime" }, (args) => ({ contents: `module.exports = ${args.pluginData.value};`, loader: "js" }));
      build.onLoad({ filter: /.*/, namespace: "shared-library-runtime" }, (args) => {
        const hostMethod = args.path.match(/^@plasmicapp\/host\/(register\w+)$/)?.[1];
        const value = target === "browser" ? (hostMethod ? `__Sub.${hostMethod}` : globals[args.path])
          : (hostMethod ? `require("@plasmicapp/host").${hostMethod}` : `require(${JSON.stringify(args.path)})`);
        return { contents: `module.exports = ${value};`, loader: "js" };
      });
      if (target === "node") {
        build.onLoad({ filter: /\.css$/ }, () => ({ contents: "", loader: "js" }));
      }
    },
  };
  const result = await esbuild.build({
    absWorkingDir: moduleRoot,
    stdin: { contents: entry, resolveDir: moduleRoot, loader: "js" },
    bundle: true, write: false, format: target === "browser" ? "iife" : "cjs",
    platform: target, loader: libraryAssetLoaders, minify: true,
    plugins: [runtimePlugin],
    define: { "process.env.NODE_ENV": '"production"' },
    outfile: path.join(moduleRoot, "registration.js"),
    banner: target === "browser" ? { js: "var __Sub = window.__Sub;" } : undefined,
  });
  const output = ensure(result.outputFiles, "Missing registration files");
  let js = ensure(output.find((f) => f.path.endsWith(".js")), "Missing registration JavaScript").text;
  if (target === "browser") {
    const css = [...output.filter((f) => f.path.endsWith(".css")).map((f) => f.text)];
    for (const specifier of cssImports) {
      const res = await esbuild.build({ entryPoints: [specifier], absWorkingDir: moduleRoot, bundle: true, write: false, outfile: "styles.css", loader: libraryAssetLoaders });
      css.push(...ensure(res.outputFiles, "Missing library CSS").map((f) => f.text));
    }
    if (css.length) {
      js = `(function(){var s=document.createElement("style");s.textContent=${JSON.stringify(css.join("\n"))};document.head.appendChild(s);})();\n${js}`;
    }
  }
  return js;
}

/** No npm resolution during page publishing: all transitive code is in these files. */
export async function materializeLibraryArtifacts(dir: string, artifacts: LibraryArtifact[]) {
  const aliases: Record<string, string> = {};
  const moduleResolutions: Record<string, Record<string, string>> = {};
  for (const artifact of artifacts) {
    const content = { packages: artifact.packages, imports: artifact.imports, files: artifact.files, resolutions: artifact.resolutions, canvas: artifact.canvas, server: artifact.server };
    assert(createHash("sha256").update(ensure(stringify(content), "Missing artifact content")).digest("hex") === artifact.digest, "Component library artifact checksum mismatch");
    const root = path.join(dir, "libraries");
    for (const [name, contents] of Object.entries(artifact.files)) {
      assert(!name.startsWith("/") && !name.split(/[\\/]/).includes(".."), "Invalid component library artifact path");
      await fs.mkdir(path.dirname(path.join(root, name)), { recursive: true });
      await fs.writeFile(path.join(root, name), Buffer.from(contents, "base64"));
    }
    for (const [file, resolved] of Object.entries(artifact.resolutions)) {
      const source = path.join(root, file);
      const destinations = Object.fromEntries(Object.entries(resolved).map(([specifier, name]) => [specifier, path.join(root, name)]));
      assert(!moduleResolutions[source] || stringify(moduleResolutions[source]) === stringify(destinations), `Conflicting transitive component library dependencies for ${file}`);
      moduleResolutions[source] = destinations;
    }
    for (const [specifier, file] of Object.entries(artifact.imports)) {
      assert(Object.hasOwn(artifact.files, file), `Missing library export ${specifier}`);
      const destination = path.join(root, file);
      assert(!aliases[specifier] || aliases[specifier] === destination, `Conflicting component library versions for ${specifier}`);
      aliases[specifier] = destination;
    }
  }
  return { libraryAliases: aliases, libraryResolutions: moduleResolutions };
}

export async function captureLibraryArtifact(site: Site) {
  const context = librarySources.getStore();
  const moduleRoot = context?.moduleRoot ?? path.resolve(process.cwd(), "../canvas-packages");
  const name = ensure(site.hostLessPackageInfo, "Expected component library").name;
  const canvasEntry = context ? registrationEntry(site)
    : `import ${JSON.stringify(path.join(moduleRoot, "src", `${name}.ts`))};`;
  const serverEntry = context ? registrationEntry(site, true)
    : `export {register} from ${JSON.stringify(path.join(moduleRoot, "src", `${name}.ts`))};`;
  return buildLibraryArtifact(site, moduleRoot, canvasEntry, serverEntry);
}
