import { ProjectId } from "@/wab/shared/ApiSchema";
import { generateSiteFromBundle } from "@/wab/shared/__testonly__/site-tests-utils";
import { Bundle } from "@/wab/shared/bundler";
import dataTokensPageMetaBundle from "@/wab/shared/codegen/__testonly__/bundles/data-tokens-page-meta.json";
import dataTokensBundle from "@/wab/shared/codegen/__testonly__/bundles/data-tokens.json";
import {
  codegen,
  collectSnapshotForDir,
} from "@/wab/shared/codegen/__testonly__/codegen-tests-util";
import "core-js";
import tmp from "tmp";

describe("data tokens: codegen", () => {
  let dir: tmp.DirResult;

  beforeEach(() => {
    dir = tmp.dirSync({ unsafeCleanup: true });
  });
  afterEach(() => {
    dir.removeCallback();
  });

  it("should codegen correct contents with data tokens", async () => {
    const site = generateSiteFromBundle(dataTokensBundle as [string, Bundle][]);
    await codegen(dir.name, site, {
      platform: "react",
      codegenScheme: "blackbox",
      stylesScheme: "css",
    });

    const expectedSnapshot = collectSnapshotForDir(dir.name);
    expect(expectedSnapshot).toMatchSnapshot();
  });

  it("strictly compiles App Router token metadata with the navigation boundary confined to clients", async () => {
    const site = generateSiteFromBundle(dataTokensPageMetaBundle as [string, Bundle][]);
    const { readFromProject } = await codegen(dir.name, site, {
      platform: "nextjs", codegenScheme: "blackbox", stylesScheme: "css",
      platformOptions: { nextjs: { appDir: true } },
      projectId: "3UYiEMfU3twU4iYSx86cub" as ProjectId,
    });
    const client = readFromProject("PlasmicSeo.tsx"), server = readFromProject("PlasmicSeoServer.tsx");
    expect(client).toContain("__WithNextRouter");
    expect(server).toContain("generateDynamicMetadata");
    expect(server).toContain("$dataTokens_");
    expect(server).not.toContain("next/navigation");
    expect(server).not.toContain("usePlasmicPrepass");
  });

  it("should codegen correct app dir contents with data tokens in metadata", async () => {
    const site = generateSiteFromBundle(
      dataTokensPageMetaBundle as [string, Bundle][],
    );
    await codegen(dir.name, site, {
      platform: "nextjs",
      codegenScheme: "blackbox",
      stylesScheme: "css",
      platformOptions: { nextjs: { appDir: true } },
      projectId: "3UYiEMfU3twU4iYSx86cub" as ProjectId,
    });

    const expectedSnapshot = collectSnapshotForDir(dir.name);
    expect(expectedSnapshot).toMatchSnapshot();
  });
});
