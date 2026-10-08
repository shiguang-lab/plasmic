import { bundleModules } from "@/wab/server/loader/module-bundler";
import { writeCodeBundlesToDisk } from "@/wab/server/loader/module-writer";
import type { CachedCodegenOutputBundle } from "@/wab/server/workers/codegen";
import { promises as fs } from "fs";
import os from "os";
import path from "path";
import { expect, it } from "vitest";
import { buildLibraryArtifact, materializeLibraryArtifacts } from "@/wab/server/loader/library-artifacts";
import type { Site } from "@/wab/shared/model/classes";
import { assert } from "@/wab/shared/common";

it("bundles Overseas and React UI through the production Loader pipeline", async () => {
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
        skeletonModule: `export { AppShell } from "@shiguang-lab/plasmic-overseas/skinny/registerAppShell";
        export { ActionGroup } from "@shiguang-lab/plasmic-react-ui/skinny/registerActionGroup";`,
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
      ["overseas", "@shiguang-lab/plasmic-overseas", "registerAppShell"],
      ["react-ui", "@shiguang-lab/plasmic-react-ui", "registerActionGroup"],
    ];
    const artifacts = await Promise.all(artifactSpecs.map(([name, pkg, entry]) => buildLibraryArtifact({
      hostLessPackageInfo: { name, npmPkg: [pkg], registerCalls: [], cssImport: [], deps: [] },
      components: [{ codeComponentMeta: { importPath: `${pkg}/skinny/${entry}` } }],
      codeLibraries: [], customFunctions: [],
    } as unknown as Site, path.resolve(process.cwd(), "../canvas-packages"))));
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
    if (process.env.PREVIEW_TEST_LIBRARY_BUNDLE) {
      await fs.writeFile(
        process.env.PREVIEW_TEST_LIBRARY_BUNDLE,
        JSON.stringify(bundle),
      );
    }
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}, 60000);
