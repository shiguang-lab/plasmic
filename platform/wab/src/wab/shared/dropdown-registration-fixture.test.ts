import {
  Bundler,
  checkBundleFields,
  checkExistingReferences,
  checkRefsInBundle,
} from "@/wab/shared/bundler";
import type { Bundle } from "@/wab/shared/bundles";
import { ensure } from "@/wab/shared/common";
import { ensureKnownSite, isKnownProjectDependency, isKnownRenderFuncType } from "@/wab/shared/model/classes";
import { assertSiteInvariants } from "@/wab/shared/site-invariants";
import { readFileSync } from "node:fs";

it("loads the dropdown library fixture with native prop names and render-function slots", () => {
  const bundles: [string, Bundle][] = JSON.parse(
    readFileSync("../loader-tests/data/plasmic-antd.json", "utf8"),
  );
  const bundler = new Bundler();
  const sites = bundles.map(([id, bundle]) => {
    checkBundleFields(bundle);
    checkExistingReferences(bundle);
    checkRefsInBundle(bundle);
    const root = bundler.unbundle(bundle, id);
    const site = isKnownProjectDependency(root) ? root.site : ensureKnownSite(root);
    assertSiteInvariants(site);
    return site;
  });
  const components = sites.flatMap((site) => site.components);
  for (const name of ["AntdDropdown", "AntdDropdownButton"]) {
      const component = ensure(components.find((candidate) => candidate.name === name), `Missing ${name} fixture`);
      const names = component.params.map((param) => param.variable.name);
      expect(names).toEqual(expect.arrayContaining(["popupRender", "open"]));
      expect(names).not.toContain("overlay");
      expect(names).not.toContain("visible");
      const slot = ensure(component.params.find((param) => param.variable.name === "popupRender"), `Missing ${name} popupRender slot`);
      expect(isKnownRenderFuncType(slot.type)).toBe(true);
      if (isKnownRenderFuncType(slot.type)) {
        expect(slot.type.params.map((arg) => arg.argName)).toEqual(["menus"]);
      }
  }
});
