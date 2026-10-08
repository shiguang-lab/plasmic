// Seed the first static release image with the currently published installers.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import YAML from "yaml";
import { releaseTargets } from "./build-distribution.mjs";
import { manifestNames, validateRelease } from "./release-artifacts.mjs";
const config = JSON.parse(
  await readFile(new URL("../desktop.config.json", import.meta.url), "utf8"),
);
const base = config.updateUrl.replace(/\/?$/, "/");
for (const target of releaseTargets) {
  const partition = `${target.platform}/${target.arch}`;
  const directory = path.resolve("desktop/public/desktop-updates", partition);
  await mkdir(directory, { recursive: true });
  const name = manifestNames[target.platform];
  const response = await fetch(`${base}${partition}/${name}`, {
    cache: "no-store",
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok)
    throw new Error(
      `Current ${target.id} feed unavailable: ${response.status}`,
    );
  const text = await response.text();
  const manifest = YAML.parse(text);
  for (const file of manifest.files) {
    if (!/^[a-zA-Z0-9._-]+$/.test(file.url))
      throw new Error("Unsafe installer filename");
    const url = `${base}${partition}/${file.url}`;
    const artifact = await fetch(url, { signal: AbortSignal.timeout(300000) });
    if (!artifact.ok)
      throw new Error(`Current installer unavailable: ${artifact.status}`);
    await writeFile(
      path.join(directory, file.url),
      Buffer.from(await artifact.arrayBuffer()),
    );
    const blockmap = await fetch(url + ".blockmap", {
      signal: AbortSignal.timeout(30000),
    });
    if (blockmap.ok)
      await writeFile(
        path.join(directory, file.url + ".blockmap"),
        Buffer.from(await blockmap.arrayBuffer()),
      );
    else if (blockmap.status !== 404)
      throw new Error("Current blockmap unavailable");
  }
  await writeFile(path.join(directory, name), text);
  await validateRelease(
    directory,
    target.platform,
    manifest.version,
    target.arch,
  );
  console.log(`Retained current ${target.id} ${manifest.version}`);
}
