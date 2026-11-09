// MobX -> Zustand 迁移基线测绘。只读源码，不安装依赖、不运行产品代码。
//
//   node inventory.mjs --write   刷新 baseline.json
//   node inventory.mjs --check   校验 baseline.json 是否与当前源码一致
//
// 输出只包含可复现的计数与文件清单，不含时间戳，便于 --check 比较。
import { readdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const wab = path.resolve(here, "../../../platform/wab");
const srcRoot = path.join(wab, "src");
const baselinePath = path.join(here, "baseline.json");

const mode = process.argv[2];
if (!["--check", "--write"].includes(mode)) {
  throw new Error("Use --check or --write.");
}

function walk(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, out);
    } else if (entry.isFile() && /\.(ts|tsx)$/.test(entry.name) && !/\.(test|spec)\.(ts|tsx)$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

const count = (source, re) => (source.match(re) ?? []).length;
const rel = (file) => path.relative(wab, file).split(path.sep).join("/");

const files = walk(srcRoot).sort();
const sources = new Map(files.map((file) => [file, readFileSync(file, "utf8")]));
// Commented-out declarations are not state. Strip comments before counting so a
// `// private _foo = observable.box(...)` does not inflate the migration count.
const codeOf = (source) =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const metrics = {
  mobx: {
    observerFiles: 0,
    observerSites: 0,
    mobxReactImportFiles: 0,
    mobxImportFiles: 0,
    // Preserve separate client and whole-source counters.
    observable: { box: 0, array: 0, map: 0, set: 0, ref: 0, shallow: 0, total: 0 },
    observableAllSrc: { box: 0, array: 0, map: 0, set: 0, ref: 0, shallow: 0, total: 0 },
    autorunSites: 0,
    reactionSites: 0,
    whenSites: 0,
    computedFnFiles: 0,
    computedFnSites: 0,
    observableModelImportFiles: 0,
    mobxImportFileList: [],
    transitionalFiles: 0,
    scannedFiles: 0,
  },
  zustand: {
    files: 0,
    createSites: 0,
    createStoreSites: 0,
    useStoreSites: 0,
    useShallowSites: 0,
    shallowSites: 0,
    subscribeWithSelectorSites: 0,
    storeFiles: [],
  },
};

const observerByArea = new Map();
const remainingObserverFiles = [];

for (const [file, source] of sources) {
  const isMobxReact = /from\s+["']mobx-react(-lite)?["']/.test(source);
  const isMobx = /from\s+["']mobx["']/.test(source);
  const isMobxUtils = /from\s+["']mobx-utils["']/.test(source);
  const isZustand = /from\s+["']zustand(\/|["'])/.test(source);

  if (isMobxReact) {
    metrics.mobx.mobxReactImportFiles += 1;
    const sites = count(source, /\bobserver\s*\(/g);
    metrics.mobx.observerSites += sites;
    if (sites > 0) {
      metrics.mobx.observerFiles += 1;
      const area = rel(file).replace(/^src\/wab\//, "").split("/").slice(0, 3).join("/");
      observerByArea.set(area, (observerByArea.get(area) ?? 0) + 1);
      remainingObserverFiles.push(rel(file));
    }
  }

  if (isMobx) {
    metrics.mobx.mobxImportFiles += 1;
    metrics.mobx.mobxImportFileList.push(rel(file));
  }
  if (isMobxReact && isZustand) {
    metrics.mobx.transitionalFiles += 1;
  }
  // 也覆盖通过 import-mobx 间接使用 observable 的文件
  const isClient = rel(file).startsWith("src/wab/client/");
  for (const kind of ["box", "array", "map", "set", "ref", "shallow"]) {
    // Count declarations, not mentions in comments/docs.
    const hits = count(codeOf(source), new RegExp(`=\\s*observable\\.${kind}\\b`, "g"));
    metrics.mobx.observableAllSrc[kind] += hits;
    if (isClient) {
      metrics.mobx.observable[kind] += hits;
    }
  }

  metrics.mobx.autorunSites += count(source, /\bautorun\s*\(/g);
  metrics.mobx.reactionSites += count(source, /\breaction\s*\(/g);
  if (/import\s*{[^}]*\bwhen\b[^}]*}\s*from\s*["']mobx["']/s.test(source)) {
    metrics.mobx.whenSites += count(source, /\bwhen\s*\(/g);
  }
  if (isMobxUtils) {
    const sites = count(source, /\b(computedFn|maybeComputedFn|keyedComputedFn|ownedComputedFn)\s*\(/g);
    metrics.mobx.computedFnSites += sites;
    if (sites > 0) {
      metrics.mobx.computedFnFiles += 1;
    }
  }
  if (/from\s+["'][^"']*observable-model["']/.test(source)) {
    metrics.mobx.observableModelImportFiles += 1;
  }

  if (isZustand) {
    metrics.zustand.files += 1;
    metrics.zustand.createSites += count(source, /\bcreate\s*[<(]/g);
    const createStoreSites = count(source, /\bcreateStore\s*[<(]/g);
    metrics.zustand.createStoreSites += createStoreSites;
    metrics.zustand.useStoreSites += count(source, /\buseStore\s*[<(]/g);
    metrics.zustand.useShallowSites += count(source, /\buseShallow\s*\(/g);
    metrics.zustand.shallowSites += count(source, /from\s+["']zustand\/shallow["']/g);
    metrics.zustand.subscribeWithSelectorSites += count(source, /subscribeWithSelector/g);
    if (createStoreSites > 0 || /\bcreate\s*[<(]/.test(source)) {
      metrics.zustand.storeFiles.push(rel(file));
    }
  }
}

for (const bucket of [metrics.mobx.observable, metrics.mobx.observableAllSrc]) {
  bucket.total = ["box", "array", "map", "set", "ref", "shallow"].reduce(
    (sum, kind) => sum + bucket[kind],
    0,
  );
}
metrics.mobx.scannedFiles = files.length;
metrics.zustand.storeFiles.sort();
remainingObserverFiles.sort();
metrics.mobx.mobxImportFileList.sort();

const ctxFiles = [
  "src/wab/client/studio-ctx/StudioCtx.tsx",
  "src/wab/client/studio-ctx/view-ctx.ts",
  "src/wab/client/components/canvas/canvas-ctx.ts",
  "src/wab/client/studio-ctx/ViewportCtx.ts",
  "src/wab/client/studio-ctx/comments-ctx.ts",
  "src/wab/client/studio-ctx/multiplayer-ctx.ts",
  "src/wab/shared/core/observable-model.ts",
];

const ctx = ctxFiles.map((relative) => {
  const source = sources.get(path.join(wab, relative)) ?? "";
  return {
    file: relative,
    lines: source ? source.split("\n").length : 0,
    observable: count(
      codeOf(source),
      /observable\.(box|array|map|set|ref|shallow)/g,
    ),
    observerSites: count(source, /\bobserver\s*\(/g),
    computedGetters: count(source, /^\s{2}get [A-Za-z_$][\w$]*\(/gm),
    autorun: count(source, /\bautorun\s*\(/g),
    reaction: count(source, /\breaction\s*\(/g),
    zustand: /from\s+["']zustand/.test(source),
  };
});

const areas = [...observerByArea.entries()]
  .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
  .map(([area, filesWithObserver]) => ({ area, filesWithObserver }));

// All production source files must stay free of the removed runtime.
const mobxImportPattern = /from\s+["'](mobx|mobx-react|mobx-react-lite|mobx-utils)["']/;
const forbiddenMobxImports = [...sources]
  .filter(([, source]) => mobxImportPattern.test(codeOf(source)))
  .map(([file]) => rel(file)).sort();

const report = {
  schemaVersion: 2,
  scope: "platform/wab/src (ts/tsx, 排除 *.test.*)",
  metrics,
  observerByArea: areas,
  remainingObserverFiles,
  ctx,
  forbiddenMobxImports,
};

const serialized = `${JSON.stringify(report, null, 2)}\n`;
if (mode === "--write") {
  writeFileSync(baselinePath, serialized);
  console.log(`written ${path.relative(process.cwd(), baselinePath)}`);
} else {
  if (!existsSync(baselinePath)) {
    throw new Error("baseline.json 不存在，先运行 --write");
  }
  if (forbiddenMobxImports.length > 0) {
    console.error(`仍有 MobX imports：\n  ${forbiddenMobxImports.join("\n  ")}`);
    process.exit(1);
  }
  const current = readFileSync(baselinePath, "utf8");
  if (current !== serialized) {
    console.error("baseline.json 已过期，运行 --write 刷新");
    process.exit(1);
  }
  console.log("baseline.json 与当前源码一致，MobX imports 为零");
}
