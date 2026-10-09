import { execFileSync } from "node:child_process";
import {
  cp,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  desktopSources,
  hashFiles,
  readStudioBuild,
} from "../../scripts/build-identity.mjs";
import { bundleStudioFonts } from "../../scripts/bundle-studio-fonts.mjs";

const desktop = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const config = JSON.parse(
  await readFile(path.join(desktop, "desktop.config.json"), "utf8"),
);
const fromIndex = process.argv.indexOf("--from");
const temporary = await mkdtemp(path.join(tmpdir(), "plasmic-desktop-"));
let container;
try {
  let source;
  let revision = null;
  let dirty = false;
  let studioBuild;
  if (fromIndex >= 0) {
    if (!process.argv[fromIndex + 1])
      throw new Error("--from requires the WAB production build directory");
    source = path.resolve(process.argv[fromIndex + 1]);
    studioBuild = await readStudioBuild(source, path.dirname(desktop));
    revision = studioBuild.revision;
    dirty = studioBuild.dirty;
  } else {
    if (!process.argv.includes("--cached-image")) {
      execFileSync("docker", ["pull", config.webImage], { stdio: "inherit" });
    }
    revision = execFileSync(
      "docker",
      [
        "image",
        "inspect",
        config.webImage,
        "--format",
        '{{ index .Config.Labels "org.opencontainers.image.revision" }}',
      ],
      { encoding: "utf8" },
    ).trim();
    container = execFileSync("docker", ["create", config.webImage], {
      encoding: "utf8",
    }).trim();
    source = path.join(temporary, "build");
    await mkdir(source);
    execFileSync("docker", ["cp", container + ":/opt/plasmic-web/.", source], {
      stdio: "inherit",
    });
  }
  await readFile(path.join(source, "index.html"));
  await readFile(path.join(source, "studio.js.template"));
  const target = path.join(desktop, "renderer");
  if (source === target)
    throw new Error(
      "--from must point to a separate production build directory",
    );
  await rm(target, { recursive: true, force: true });
  await cp(source, target, {
    recursive: true,
    filter: (file) => !file.endsWith(".map"),
  });
  await bundleStudioFonts(target, config.studioOrigin);
  const localeSource = path.join(
    desktop,
    "../platform/wab/src/wab/client/i18n",
  );
  await cp(
    path.join(localeSource, "locales"),
    path.join(target, "ui-locales"),
    { recursive: true },
  );
  await cp(
    path.join(localeSource, "locale-resolution.cjs"),
    path.join(target, "ui-locales/locale-resolution.cjs"),
  );
  let count = 0,
    bytes = 0;
  async function configure(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) await configure(file);
      else {
        let data = await readFile(file);
        if (/\.(html|js|css|json|template)$/.test(entry.name)) {
          let text = data
            .toString()
            .replaceAll("http://plasmic-origin.invalid", config.studioOrigin);
          data = Buffer.from(text);
          await writeFile(file, data);
        }
        count++;
        bytes += data.length;
      }
    }
  }
  await configure(target);
  await writeFile(
    path.join(target, "desktop-assets.json"),
    JSON.stringify(
      {
        ...config,
        revision,
        build: {
          kind: fromIndex >= 0 ? "local" : "release",
          revision,
          dirty,
          builtAt: studioBuild?.builtAt ?? new Date().toISOString(),
          sourceHash: studioBuild?.sourceHash,
          rendererHash: await hashFiles(target, ["."], ["desktop-assets.json"]),
          desktopHash: await hashFiles(desktop, desktopSources),
        },
        files: count,
        bytes,
      },
      null,
      2,
    ) + "\n",
  );
  console.log(
    `Bundled ${count} local assets (${(bytes / 1024 / 1024).toFixed(1)} MiB).`,
  );
} finally {
  if (container) execFileSync("docker", ["rm", container], { stdio: "ignore" });
  await rm(temporary, { recursive: true, force: true });
}
