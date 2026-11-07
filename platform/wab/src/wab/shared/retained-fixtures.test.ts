import {
  Bundler,
  checkBundleFields,
  checkExistingReferences,
  checkRefsInBundle,
} from "@/wab/shared/bundler";
import { Bundle } from "@/wab/shared/bundles";
import { codegen } from "@/wab/shared/codegen/__testonly__/codegen-tests-util";
import { ObjInst, ensureKnownSite } from "@/wab/shared/model/classes";
import { assertSiteInvariants } from "@/wab/shared/site-invariants";
import { mkdtempSync, readFileSync, readdirSync, rmSync } from "fs";
import { tmpdir } from "os";
import path from "path";

for (const file of [
  "../loader-tests/data/auth-e2e.json",
  "../loader-tests/data/data-source-basic.json",
  "playwright/bundles/forms.json",
]) {
  it(`validates references, model invariants and generated types for ${file}`, async () => {
    const bundles: [string, Bundle][] = JSON.parse(readFileSync(file, "utf8"));
    const bundler = new Bundler();
    let root: ObjInst | undefined;
    for (const [id, bundle] of bundles) {
      checkBundleFields(bundle);
      checkExistingReferences(bundle);
      checkRefsInBundle(bundle);
      root = bundler.unbundle(bundle, id);
    }
    const site = ensureKnownSite(root);
    assertSiteInvariants(site);
    const dir = mkdtempSync(path.join(tmpdir(), "plasmic-retained-fixtures-"));
    try {
      await codegen(dir, site);
      const files = readdirSync(dir).filter((name) => name.endsWith(".tsx"));
      expect(files.length).toBeGreaterThan(0);
      const output = files
        .map((name) => readFileSync(path.join(dir, name), "utf8"))
        .join("\n");
      expect(output).not.toContain("@plasmicpkgs/plasmic-rich-components");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
}
