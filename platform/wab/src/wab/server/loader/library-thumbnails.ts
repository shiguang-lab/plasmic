import { uploadDataUriToS3 } from "@/wab/server/cdn/images";
import { assert, delay } from "@/wab/shared/common";
import type { Site } from "@/wab/shared/model/classes";
import type { Plugin } from "esbuild";
import { promises as fs } from "fs";

async function uploadThumbnail(value: string) {
  const result = await uploadDataUriToS3(value, { imageOnly: true });
  if (result.isErr()) {
    throw result.error;
  }
  assert(
    /^https?:\/\//.test(result.value),
    "Thumbnail upload must return an absolute resource URL",
  );
  let response: Response | undefined;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      response = await fetch(result.value, {
        method: "HEAD",
        signal: AbortSignal.timeout(15_000),
      });
      if (response.status < 500) {
        break;
      }
    } catch (error) {
      if (attempt === 2) {
        throw error;
      }
    }
    if (attempt < 2) {
      await delay(250);
    }
  }
  assert(
    response?.ok &&
      response.headers.get("content-type")?.includes("image/svg+xml"),
    "Uploaded thumbnail is not publicly readable",
  );
  return result.value;
}

export async function externalizeComponentThumbnails(
  registrations: { meta: { thumbnailUrl?: string | null } }[],
) {
  const uploaded = new Map<string, string>();
  for (const { meta } of registrations) {
    const value = meta.thumbnailUrl;
    if (!value?.startsWith("data:image/svg+xml")) {
      continue;
    }
    const url = uploaded.get(value) ?? (await uploadThumbnail(value));
    uploaded.set(value, url);
    meta.thumbnailUrl = url;
  }
}

export async function externalizeSiteThumbnails(
  site: Pick<Site, "components">,
) {
  await externalizeComponentThumbnails(
    site.components.flatMap((component) =>
      component.codeComponentMeta
        ? [{ meta: component.codeComponentMeta }]
        : [],
    ),
  );
}

/** Transform the dedicated package manifest before code/model publication. */
export function libraryThumbnails() {
  const files = new Map<string, string>();
  const uploads = new Map<string, Promise<string>>();
  const plugin: Plugin = {
    name: "library-thumbnails",
    setup(build) {
      build.onLoad(
        { filter: /[/\\]thumbnails\.plasmic\.json$/ },
        async ({ path }) => {
          if (!files.has(path)) {
            const input: Record<string, string> = JSON.parse(
              await fs.readFile(path, "utf8"),
            );
            const output: Record<string, string> = {};
            for (const [name, value] of Object.entries(input)) {
              assert(
                typeof value === "string",
                `Invalid thumbnail for ${name}`,
              );
              if (!value.startsWith("data:")) {
                output[name] = value;
                continue;
              }
              assert(
                value.startsWith("data:image/svg+xml"),
                `Expected an SVG thumbnail for ${name}`,
              );
              let upload = uploads.get(value);
              if (!upload) {
                upload = uploadThumbnail(value);
                uploads.set(value, upload);
              }
              output[name] = await upload;
            }
            files.set(path, JSON.stringify(output));
          }
          return { contents: files.get(path), loader: "json" };
        },
      );
    },
  };
  return { plugin, files };
}
