import {
  buildLibraryArtifact,
  materializeLibraryArtifacts,
} from "@/wab/server/loader/library-artifacts";
import { bundleModules } from "@/wab/server/loader/module-bundler";
import { writeCodeBundlesToDisk } from "@/wab/server/loader/module-writer";
import type { CachedCodegenOutputBundle } from "@/wab/server/workers/codegen";
import { assert } from "@/wab/shared/common";
import type { Site } from "@/wab/shared/model/classes";
import { promises as fs } from "fs";
import os from "os";
import path from "path";
import { expect, it } from "vitest";

beforeEach(() =>
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () =>
        new Response(null, { headers: { "Content-Type": "image/svg+xml" } }),
    ),
  ),
);
afterEach(() => vi.unstubAllGlobals());

it("bundles Material UI components, theme and state helpers through the production Loader pipeline", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "preview-libraries-"));
  const output = {
    components: [
      {
        id: "libraries",
        displayName: "Libraries",
        plasmicName: "Libraries",
        skeletonModuleFileName: "libraries.tsx",
        renderModuleFileName: "render-libraries.tsx",
        cssFileName: "css__libraries.css",
        isPage: false,
        isCode: false,
        metadata: {},
        skeletonModule: `export { Button, TextField, Switch, SwitchHelpers, Dialog, DialogHelpers, MaterialThemeProvider } from "@shiguang-lab/plasmic-material-ui/components";`,
      },
    ],
    projectConfig: {
      projectId: "libraries-test",
      projectName: "Libraries test",
      version: "1.0.0",
      indirect: false,
      cssFileName: "project.css",
      cssRules: "",
      fontUsages: [],
    },
    defaultStyles: {
      defaultStyleCssFileName: "defaults.css",
      defaultStyleCssRules: "",
    },
    globalVariants: [],
    iconAssets: [],
    imageAssets: [],
    externalCssImports: [],
  } as unknown as CachedCodegenOutputBundle;
  try {
    await writeCodeBundlesToDisk(dir, [output]);
    const artifactSpecs = [
      ["material-ui", "@shiguang-lab/plasmic-material-ui", "components"],
    ];
    const artifacts = await Promise.all(
      artifactSpecs.map(([name, pkg, entry]) =>
        buildLibraryArtifact(
          {
            hostLessPackageInfo: {
              name,
              npmPkg: [pkg],
              registerCalls: [],
              cssImport: [],
              deps: [],
            },
            components: [
              { codeComponentMeta: { importPath: `${pkg}/${entry}` } },
            ],
            codeLibraries: [],
            customFunctions: [],
          } as unknown as Site,
          path.resolve(process.cwd(), "../canvas-packages"),
        ),
      ),
    );
    const libraryModules = await materializeLibraryArtifacts(dir, artifacts);
    const bundle = await bundleModules(dir, [output], { libraries: [] }, [], {
      platform: "nextjs",
      mode: "production",
      loaderVersion: 10,
      browserOnly: true,
      ...libraryModules,
    });
    assert(!Array.isArray(bundle.modules), "Expected Loader 10 modules");
    expect(bundle.modules.server).toEqual([]);
    expect(
      bundle.modules.browser.some(
        (module) => module.fileName === "libraries.js",
      ),
    ).toBe(true);
    expect(bundle.components[0]).toMatchObject({
      isCode: false,
      entry: "libraries.js",
    });
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}, 60000);

// Library publication uploads thumbnail assets before capturing the code graph.
vi.mock("@/wab/server/cdn/images", () => ({
  uploadDataUriToS3: async (data: string) => {
    const { createHash } = await import("crypto");
    const { ok } = await import("neverthrow");
    return ok(
      `https://assets.example/${createHash("md5").update(data).digest("hex")}.svg`,
    );
  },
}));
