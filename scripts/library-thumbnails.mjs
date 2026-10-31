import { buildSync } from "esbuild";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { runInNewContext } from "node:vm";

// Keep thumbnail generators out of registration bundles. The platform publisher
// replaces this dedicated JSON module with uploaded, content-addressed URLs.
export async function libraryThumbnails(root, packageName) {
  const source = path.join(root, "src/componentThumbnails.ts");
  const result = buildSync({
    entryPoints: [source],
    bundle: true,
    write: false,
    platform: "node",
    format: "cjs",
  });
  const module = { exports: {} };
  runInNewContext(result.outputFiles[0].text, {
    module,
    exports: module.exports,
  });
  const { componentThumbnailNames, getComponentThumbnail } = module.exports;
  const thumbnails = Object.fromEntries(
    componentThumbnailNames.flatMap((name) => {
      const url = getComponentThumbnail(name);
      return url ? [[name, url]] : [];
    }),
  );
  await mkdir(path.join(root, "skinny"), { recursive: true });
  await writeFile(
    path.join(root, "skinny/thumbnails.plasmic.json"),
    JSON.stringify(thumbnails, null, 2) + "\n",
  );
  await writeFile(
    path.join(root, "skinny/thumbnails.cjs"),
    'const thumbnails = require("./thumbnails.plasmic.json");\nexports.getComponentThumbnail = (name) => thumbnails[name];\n',
  );
  return {
    name: "library-thumbnails",
    resolveId(id, importer) {
      if (
        id === "./componentThumbnails" &&
        importer?.startsWith(path.join(root, "src") + path.sep)
      ) {
        return { id: `${packageName}/thumbnails`, external: true };
      }
    },
  };
}
