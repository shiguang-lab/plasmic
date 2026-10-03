import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile, readdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { pathToFileURL } from "node:url";

export async function bundleStudioFonts(target, studioOrigin) {
  // The Studio HTML includes a fixed Google Fonts stylesheet. Bundle it and
  // its fonts too, so launching the editor never waits for Google's CDN.
  const html = await readFile(path.join(target, "index.html"), "utf8");
  const fontUrls = [
    ...new Set(
      html.match(/https:\/\/fonts\.googleapis\.com\/css2[^"<>]+/g) || [],
    ),
  ];
  if (!fontUrls.length) return;
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
        studioOrigin + "/static/desktop-fonts/" + name,
      );
    }
    const name =
      createHash("sha256").update(url).digest("hex").slice(0, 24) + ".css";
    await writeFile(path.join(fontsDirectory, name), css);
    fontReplacements.set(
      encodedUrl,
      studioOrigin + "/static/desktop-fonts/" + name,
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
  async function rewrite(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) await rewrite(file);
      else if (/\.(html|js|css|json|template)$/.test(entry.name)) {
        const original = await readFile(file, "utf8");
        let text = original;
        for (const [url, local] of fontReplacements) text = text.replaceAll(url, local);
        if (text !== original) await writeFile(file, text);
      }
    }
  }
  await rewrite(target);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await bundleStudioFonts(path.resolve(process.argv[2]), process.argv[3]);
}
