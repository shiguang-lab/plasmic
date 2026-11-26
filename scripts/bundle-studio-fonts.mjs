import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const BUNDLED_FONT_PLACEHOLDER = "__PLASMIC_BUNDLED_FONTS__";

const BUNDLED_CANVAS_FONTS = [
  {
    family: "IBM Plex Mono",
    cssUrl:
      "https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:ital,wght@0,300;0,400;0,500;0,600;0,700;1,300;1,400;1,500;1,600;1,700&display=swap",
    license: { dir: "ofl/ibmplexmono", file: "OFL.txt" },
  },
  {
    family: "Inconsolata",
    cssUrl:
      "https://fonts.googleapis.com/css2?family=Inconsolata:wght@400;500;600;700;900&display=swap",
    license: { dir: "ofl/inconsolata", file: "OFL.txt" },
  },
  {
    family: "Inter",
    cssUrl:
      "https://fonts.googleapis.com/css2?family=Inter:ital,wght@0,300;0,400;0,500;0,600;0,700;0,900;1,400;1,500;1,600;1,700&display=swap",
    license: { dir: "ofl/inter", file: "OFL.txt" },
  },
  {
    family: "Open Sans",
    cssUrl:
      "https://fonts.googleapis.com/css2?family=Open+Sans:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;1,400;1,600;1,700&display=swap",
    license: { dir: "ofl/opensans", file: "OFL.txt" },
  },
  {
    family: "Paytone One",
    cssUrl: "https://fonts.googleapis.com/css2?family=Paytone+One&display=swap",
    license: { dir: "ofl/paytoneone", file: "OFL.txt" },
  },
  {
    family: "Roboto",
    cssUrl:
      "https://fonts.googleapis.com/css2?family=Roboto:ital,wght@0,100;0,300;0,400;0,500;0,700;0,900;1,400;1,700&display=swap",
    license: { dir: "ofl/roboto", file: "OFL.txt" },
  },
  {
    family: "Roboto Mono",
    cssUrl:
      "https://fonts.googleapis.com/css2?family=Roboto+Mono:ital,wght@0,400;0,500;0,600;0,700;1,400;1,700&display=swap",
    license: { dir: "ofl/robotomono", file: "OFL.txt" },
  },
  {
    family: "Arimo",
    cssUrl:
      "https://fonts.googleapis.com/css2?family=Arimo:ital,wght@0,400;0,500;0,600;0,700;1,400;1,700&display=swap",
    license: { dir: "ofl/arimo", file: "OFL.txt" },
    fallbacks: ["Arial", "Helvetica", "Helvetica Neue"],
  },
  {
    family: "Tinos",
    cssUrl:
      "https://fonts.googleapis.com/css2?family=Tinos:ital,wght@0,400;0,700;1,400;1,700&display=swap",
    license: {
      dir: "ofl/tinos",
      file: "OFL.txt",
      url: "https://raw.githubusercontent.com/googlefonts/tinos/main/OFL.txt",
    },
    fallbacks: ["Times New Roman"],
  },
  {
    family: "Cousine",
    cssUrl:
      "https://fonts.googleapis.com/css2?family=Cousine:ital,wght@0,400;0,700;1,400;1,700&display=swap",
    license: { dir: "ofl/cousine", file: "OFL.txt" },
    fallbacks: ["Courier New"],
  },
];

function defaultDownload(url) {
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

export function createMetricFallbackCss(sourceCss, sourceFamily, targetFamily) {
  return sourceCss
    .replaceAll(
      `font-family: '${sourceFamily}'`,
      `font-family: '${targetFamily}'`,
    )
    .replaceAll(
      `font-family: "${sourceFamily}"`,
      `font-family: '${targetFamily}'`,
    )
    .replaceAll("src: url(", `src: local('${targetFamily}'), url(`);
}

function slug(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export async function bundleStudioFonts(
  target,
  studioOrigin,
  options = {},
) {
  const download = options.download ?? defaultDownload;
  // The Studio HTML includes a fixed Google Fonts stylesheet. Bundle it and
  // built-in open-source canvas fonts too, so launching the editor or rendering
  // covers never waits for Google's CDN or OS-installed fonts.
  const html = await readFile(path.join(target, "index.html"), "utf8");
  const fontUrls = [
    ...new Set(
      html.match(/https:\/\/fonts\.googleapis\.com\/css2[^"<>]+/g) || [],
    ),
  ];
  const fontReplacements = new Map();
  const fontsDirectory = path.join(target, "static/desktop-fonts");
  const aliasesDirectory = path.join(fontsDirectory, "aliases");
  await mkdir(fontsDirectory, { recursive: true });
  await mkdir(aliasesDirectory, { recursive: true });
  const downloadedAssets = new Set();

  async function localizeCss(url) {
    let css = download(url).toString();
    for (const assetUrl of new Set(
      css.match(/https:\/\/fonts\.gstatic\.com\/[^)\s]+/g) || [],
    )) {
      const name =
        createHash("sha256").update(assetUrl).digest("hex").slice(0, 24) +
        path.extname(new URL(assetUrl).pathname);
      if (!downloadedAssets.has(name)) {
        await writeFile(path.join(fontsDirectory, name), download(assetUrl));
        downloadedAssets.add(name);
      }
      css = css.replaceAll(
        assetUrl,
        studioOrigin + "/static/desktop-fonts/" + name,
      );
    }
    return css;
  }

  for (const encodedUrl of fontUrls) {
    const url = encodedUrl.replaceAll("&amp;", "&");
    const css = await localizeCss(url);
    const name =
      createHash("sha256").update(url).digest("hex").slice(0, 24) + ".css";
    await writeFile(path.join(fontsDirectory, name), css);
    fontReplacements.set(
      encodedUrl,
      studioOrigin + "/static/desktop-fonts/" + name,
    );
  }

  const manifest = { families: {}, fallbacks: {} };
  for (const font of BUNDLED_CANVAS_FONTS) {
    const css = await localizeCss(font.cssUrl);
    const cssFileName =
      createHash("sha256").update(font.cssUrl).digest("hex").slice(0, 24) +
      ".css";
    await writeFile(path.join(fontsDirectory, cssFileName), css);
    manifest.families[font.family] = cssFileName;

    for (const fallbackFamily of font.fallbacks ?? []) {
      const aliasFileName = `${slug(fallbackFamily)}.css`;
      const aliasCss = createMetricFallbackCss(
        css,
        font.family,
        fallbackFamily,
      );
      await writeFile(path.join(aliasesDirectory, aliasFileName), aliasCss);
      manifest.fallbacks[fallbackFamily] = `aliases/${aliasFileName}`;
    }

    const licensePrefix = font.license.dir.split("/").pop();
    await writeFile(
      path.join(fontsDirectory, `${licensePrefix}-${font.license.file}`),
      download(
        font.license.url ??
          `https://raw.githubusercontent.com/google/fonts/main/${font.license.dir}/${font.license.file}`,
      ),
    );
  }

  await writeFile(
    path.join(fontsDirectory, "manifest.json"),
    JSON.stringify(manifest, null, 2),
  );
  const encodedManifest = Buffer.from(
    JSON.stringify(manifest),
    "utf8",
  ).toString("base64");
  fontReplacements.set(BUNDLED_FONT_PLACEHOLDER, encodedManifest);

  async function rewrite(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) await rewrite(file);
      else if (/\.(html|js|css|json|template)$/.test(entry.name)) {
        const original = await readFile(file, "utf8");
        let text = original;
        for (const [url, local] of fontReplacements) {
          text = text.replaceAll(url, local);
        }
        if (text !== original) await writeFile(file, text);
      }
    }
  }
  await rewrite(target);
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  await bundleStudioFonts(path.resolve(process.argv[2]), process.argv[3]);
}
