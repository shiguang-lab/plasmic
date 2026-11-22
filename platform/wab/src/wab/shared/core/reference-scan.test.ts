import { mkStyleToken, mkTokenRef } from "@/wab/commons/StyleToken";
import {
  componentToUsedImageAssets,
  extractImageAssetRefsByAttrs,
  getComponentsUsingImageAsset,
} from "@/wab/shared/cached-selectors";
import { ComponentType, mkComponent } from "@/wab/shared/core/components";
import { ImageAssetType } from "@/wab/shared/core/image-asset-type";
import { mkImageAsset, mkImageAssetRef } from "@/wab/shared/core/image-assets";
import { ChangeRecorder } from "@/wab/shared/core/observable-model";
import * as projectDeps from "@/wab/shared/core/project-deps";
import { componentToUsedTokens } from "@/wab/shared/core/site-style-tokens";
import { createSite } from "@/wab/shared/core/sites";
import { TplTagType, mkTplTagX } from "@/wab/shared/core/tpls";
import { ImageAssetRef } from "@/wab/shared/model/classes";
import { instUtil } from "@/wab/shared/model/InstUtil";
import { genSiteErrors } from "@/wab/shared/site-invariants";

it.each([false, true])(
  "refreshes reference scans after editing tokens and backgrounds (observed=%s)",
  (observed) => {
    const site = createSite();
    const token = mkStyleToken({ name: "Color", type: "Color", value: "red" });
    const alias = mkStyleToken({
      name: "Alias",
      type: "Color",
      value: mkTokenRef(token),
    });
    const picture = mkImageAsset({
      name: "Picture",
      type: ImageAssetType.Picture,
    });
    site.styleTokens.push(token, alias);
    site.imageAssets.push(picture);
    const component = mkComponent({
      name: "Card",
      type: ComponentType.Plain,
      tplTree: (baseVariant) =>
        mkTplTagX("div", { baseVariant, styles: { color: "red" } }, [
          mkTplTagX("div", { baseVariant, styles: { background: "none" } }),
        ]),
    });
    site.components.push(component);
    const tracker = observed
      ? new ChangeRecorder({ inst: site, _instUtil: instUtil })
      : undefined;
    const walk = vi.spyOn(projectDeps, "walkDependencyTree");
    try {
      expect(componentToUsedTokens(site, component)).toEqual([]);
      expect(componentToUsedImageAssets(site, component)).toEqual([]);
      expect(
        walk.mock.calls.filter(([, scope]) => scope === "all"),
      ).toHaveLength(0);

      const setStyles = () => {
        component.tplTree.vsettings[0].rs.values = {
          color: mkTokenRef(alias),
          background: mkImageAssetRef(picture),
        };
      };
      if (tracker) {
        tracker.withRecording(setStyles);
      } else {
        setStyles();
      }
      expect(componentToUsedTokens(site, component)).toEqual([alias, token]);
      expect(componentToUsedImageAssets(site, component)).toEqual([picture]);
      expect(
        walk.mock.calls.filter(([, scope]) => scope === "all"),
      ).toHaveLength(2);
      expect([...extractImageAssetRefsByAttrs(site, component)]).toEqual([
        picture,
      ]);
      expect(getComponentsUsingImageAsset(site, picture)).toEqual([component]);
      const remove = () => {
        component.tplTree.vsettings[0].rs.values = {};
        site.styleTokens = [];
        site.imageAssets = [];
      };
      if (tracker) {
        tracker.withRecording(remove);
      } else {
        remove();
      }
      expect(componentToUsedTokens(site, component)).toEqual([]);
      expect(componentToUsedImageAssets(site, component)).toEqual([]);
      expect(getComponentsUsingImageAsset(site, picture)).toEqual([]);
    } finally {
      walk.mockRestore();
      tracker?.dispose();
    }
  },
);

it("still reports a missing direct image reference when the background dictionary is unused", () => {
  const site = createSite();
  const asset = mkImageAsset({ name: "Cover", type: ImageAssetType.Picture });
  site.imageAssets.push(asset);
  site.components.push(
    mkComponent({
      name: "Card",
      type: ComponentType.Plain,
      tplTree: (baseVariant) =>
        mkTplTagX("img", {
          type: TplTagType.Image,
          baseVariant,
          attrs: { src: new ImageAssetRef({ asset }) },
          styles: { display: "block" },
        }),
    }),
  );
  expect([...genSiteErrors(site)]).toEqual([]);
  site.imageAssets = [];
  expect([...genSiteErrors(site)].map((error) => error.message)).toEqual([
    "Cannot save project - Component Card references an invalid asset Cover",
  ]);
});
