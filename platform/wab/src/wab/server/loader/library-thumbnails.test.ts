import { uploadDataUriToS3 } from "@/wab/server/cdn/images";
import {
  buildLibraryArtifact,
  materializeLibraryArtifacts,
} from "@/wab/server/loader/library-artifacts";
import { externalizeComponentThumbnails } from "@/wab/server/loader/library-thumbnails";
import { md5 } from "@/wab/server/util/hash";
import { parseDataUrl } from "@/wab/shared/data-urls";
import type { Site } from "@/wab/shared/model/classes";
import { promises as fs } from "fs";
import { createRequire } from "module";
import { err, ok } from "neverthrow";
import os from "os";
import path from "path";
import { runInNewContext } from "vm";

vi.mock("@/wab/server/cdn/images", () => ({ uploadDataUriToS3: vi.fn() }));
const svg =
  "data:image/svg+xml;charset=utf-8," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg"><rect width="12" height="12"/></svg>',
  );
const url = (data: string) =>
  `https://studio.example/assets/${md5(parseDataUrl(data).toBuffer())}.svg`;
beforeEach(() => {
  vi.mocked(uploadDataUriToS3)
    .mockReset()
    .mockImplementation(async (data) => ok(url(data)));
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () =>
        new Response(null, { headers: { "Content-Type": "image/svg+xml" } }),
    ),
  );
});
afterEach(() => vi.unstubAllGlobals());

it("rejects an uploaded asset that cannot be read through its public URL", async () => {
  vi.mocked(fetch).mockResolvedValueOnce(new Response(null, { status: 404 }));
  await expect(
    externalizeComponentThumbnails([{ meta: { thumbnailUrl: svg } }]),
  ).rejects.toThrow("not publicly readable");
  expect(fetch).toHaveBeenCalledTimes(1);
});

it("retries transient public URL connection and gateway failures", async () => {
  vi.mocked(fetch)
    .mockRejectedValueOnce(new TypeError("fetch failed"))
    .mockResolvedValueOnce(new Response(null, { status: 502 }));
  const meta = { thumbnailUrl: svg };
  await externalizeComponentThumbnails([{ meta }]);
  expect(meta.thumbnailUrl).toBe(url(svg));
  expect(fetch).toHaveBeenCalledTimes(3);
  expect(vi.mocked(fetch).mock.calls[0][1]?.signal).toBeInstanceOf(AbortSignal);
});

it("still aborts publication after repeated connection failures", async () => {
  vi.mocked(fetch).mockRejectedValue(new TypeError("fetch failed"));
  const meta = { thumbnailUrl: svg };
  await expect(externalizeComponentThumbnails([{ meta }])).rejects.toThrow("fetch failed");
  expect(meta.thumbnailUrl).toBe(svg);
  expect(fetch).toHaveBeenCalledTimes(3);
});

it("uploads identical SVGs once while retaining explicit URLs and component contracts", async () => {
  const props = { value: "string" };
  const metas = [
    { meta: { name: "Button", props, thumbnailUrl: svg } },
    { meta: { thumbnailUrl: svg } },
    { meta: { thumbnailUrl: "https://custom.example/preview.png" } },
  ];
  await externalizeComponentThumbnails(metas);
  expect(uploadDataUriToS3).toHaveBeenCalledTimes(1);
  expect(metas[0].meta).toEqual({
    name: "Button",
    props,
    thumbnailUrl: url(svg),
  });
  expect(metas[1].meta.thumbnailUrl).toBe(url(svg));
  expect(metas[2].meta.thumbnailUrl).toBe("https://custom.example/preview.png");
});

it("publishes the same external preview in browser/server code and immutable export snapshots; changed content creates a new release", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "library-thumbnails-"));
  const pkg = "thumbnail-test";
  const source = path.join(root, "node_modules", pkg);
  const site = {
    hostLessPackageInfo: {
      name: pkg,
      npmPkg: [pkg],
      registerCalls: [],
      cssImport: [],
      deps: [],
    },
    components: [{ codeComponentMeta: { importPath: pkg } }],
    customFunctions: [],
    codeLibraries: [],
  } as unknown as Site;
  try {
    await fs.mkdir(source, { recursive: true });
    await fs.mkdir(path.join(root, "node_modules/@plasmicapp"), {
      recursive: true,
    });
    await fs.symlink(
      path.dirname(
        createRequire(import.meta.url).resolve("@plasmicapp/host/package.json"),
      ),
      path.join(root, "node_modules/@plasmicapp/host"),
    );
    await fs.writeFile(
      path.join(source, "package.json"),
      JSON.stringify({ name: pkg, version: "1.0.0", main: "index.js" }),
    );
    await fs.writeFile(
      path.join(source, "index.js"),
      'import {registerComponent} from "@plasmicapp/host";import thumbnails from "./thumbnails.plasmic.json";export const Panel=()=>null;export function registerAll(){registerComponent(Panel,{name:"Panel",props:{value:"string"},thumbnailUrl:thumbnails.Panel})}',
    );
    const manifest = path.join(source, "thumbnails.plasmic.json");
    await fs.writeFile(
      manifest,
      JSON.stringify({ Panel: svg, Duplicate: svg }),
    );
    const artifact = await buildLibraryArtifact(site, root);
    expect(uploadDataUriToS3).toHaveBeenCalledTimes(1);
    expect(artifact.canvas).not.toContain("data:image/svg");
    expect(artifact.server).not.toContain("data:image/svg");
    const frame = { window: { __Sub: {} } } as any;
    runInNewContext(artifact.canvas, frame);
    expect(frame.__PlasmicComponentRegistry[0].meta).toMatchObject({
      name: "Panel",
      props: { value: "string" },
      thumbnailUrl: url(svg),
    });
    const module = { exports: {} as any };
    const registrations: any[] = [];
    runInNewContext(artifact.server, {
      module,
      exports: module.exports,
      require: () => ({
        registerComponent: (_impl: unknown, meta: unknown) =>
          registrations.push(meta),
      }),
    });
    module.exports.register();
    expect(registrations[0].thumbnailUrl).toBe(url(svg));
    const exported = Object.values(artifact.files)
      .map((file) => Buffer.from(file, "base64").toString())
      .join("\n");
    expect(exported).toContain(url(svg));
    expect(exported).not.toContain("data:image/svg");
    await materializeLibraryArtifacts(path.join(root, "export"), [artifact]);
    await fs.writeFile(manifest, JSON.stringify({ Panel: svg + "%20" }));
    const next = await buildLibraryArtifact(site, root);
    expect(next.digest).not.toBe(artifact.digest);
    expect(next.canvas).toContain(url(svg + "%20"));
    expect(artifact.canvas).toContain(url(svg));
    vi.mocked(uploadDataUriToS3).mockResolvedValue(
      err(new Error("storage unavailable")),
    );
    await expect(buildLibraryArtifact(site, root)).rejects.toThrow(
      "storage unavailable",
    );
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
