import { execFileSync } from "node:child_process";
import {
  cp,
  mkdir,
  readFile,
  readdir,
  rm,
  writeFile,
  mkdtemp,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

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
  if (fromIndex >= 0) {
    if (!process.argv[fromIndex + 1])
      throw new Error("--from requires the WAB production build directory");
    source = path.resolve(process.argv[fromIndex + 1]);
  } else {
    execFileSync("docker", ["pull", config.webImage], { stdio: "inherit" });
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
  // The Studio HTML includes a fixed Google Fonts stylesheet. Bundle it and
  // its fonts too, so launching the editor never waits for Google's CDN.
  const html = await readFile(path.join(target, "index.html"), "utf8");
  const fontUrls = [
    ...new Set(
      html.match(/https:\/\/fonts\.googleapis\.com\/css2[^"<>]+/g) || [],
    ),
  ];
  const fontReplacements = new Map();
  const fontsDirectory = path.join(target, "static/desktop-fonts");
  await mkdir(fontsDirectory, { recursive: true });
  function download(url) {
    return execFileSync(
      "curl",
      [
        "--fail",
        "--silent",
        "--show-error",
        "--location",
        "--max-time",
        "60",
        "--user-agent",
        "Mozilla/5.0 Chrome/130.0.0.0 Safari/537.36",
        url,
      ],
      { maxBuffer: 64 * 1024 * 1024 },
    );
  }
  for (const encodedUrl of fontUrls) {
    const url = encodedUrl.replaceAll("&amp;", "&");
    let css = download(url).toString();
    for (const assetUrl of new Set(
      css.match(/https:\/\/fonts\.gstatic\.com\/[^)\s]+/g) || [],
    )) {
      const name =
        createHash("sha256").update(assetUrl).digest("hex").slice(0, 24) +
        path.extname(new URL(assetUrl).pathname);
      await writeFile(path.join(fontsDirectory, name), download(assetUrl));
      css = css.replaceAll(
        assetUrl,
        config.studioOrigin + "/static/desktop-fonts/" + name,
      );
    }
    const name =
      createHash("sha256").update(url).digest("hex").slice(0, 24) + ".css";
    await writeFile(path.join(fontsDirectory, name), css);
    fontReplacements.set(
      encodedUrl,
      config.studioOrigin + "/static/desktop-fonts/" + name,
    );
  }
  for (const family of [
    "ibmplexmono",
    "inconsolata",
    "inter",
    "paytoneone",
    "roboto",
    "robotomono",
  ]) {
    await writeFile(
      path.join(fontsDirectory, family + "-OFL.txt"),
      download(
        "https://raw.githubusercontent.com/google/fonts/main/ofl/" +
          family +
          "/OFL.txt",
      ),
    );
  }
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
          for (const [url, local] of fontReplacements)
            text = text.replaceAll(url, local);
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
