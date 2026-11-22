import { mkStyleToken, mkTokenRef } from "@/wab/commons/StyleToken";
import { generateSiteFromBundle } from "@/wab/shared/__testonly__/site-tests-utils";
import type { Bundle } from "@/wab/shared/bundles";
import { componentToUsedImageAssets } from "@/wab/shared/cached-selectors";
import { ComponentType, mkComponent } from "@/wab/shared/core/components";
import { ImageAssetType } from "@/wab/shared/core/image-asset-type";
import { mkImageAsset, mkImageAssetRef } from "@/wab/shared/core/image-assets";
import { ChangeRecorder } from "@/wab/shared/core/observable-model";
import { componentToUsedTokens } from "@/wab/shared/core/site-style-tokens";
import { createSite } from "@/wab/shared/core/sites";
import { mkTplTagX } from "@/wab/shared/core/tpls";
import { instUtil } from "@/wab/shared/model/InstUtil";
import { assertSiteInvariants } from "@/wab/shared/site-invariants";
import starter from "@/wab/shared/web-exporter/bundles/starter-project-desktop-first.json";

function measure(
  name: string,
  validate: () => void,
  beforeEachRun?: (iteration: number) => void,
) {
  const milliseconds: number[] = [];
  for (let i = 0; i < 9; i++) {
    beforeEachRun?.(i);
    const start = performance.now();
    validate();
    milliseconds.push(Math.round((performance.now() - start) * 10) / 10);
  }
  const measured = milliseconds.slice(2).sort((a, b) => a - b);
  console.log(name, { milliseconds, median: measured[3] });
}

it("measures full validation on raw and observed large models", () => {
  const site = createSite();
  for (let i = 0; i < 300; i++) {
    site.styleTokens.push(
      mkStyleToken({ name: "Color" + i, type: "Color", value: "#fff" }),
    );
    site.imageAssets.push(
      mkImageAsset({ name: "Picture" + i, type: ImageAssetType.Picture }),
    );
  }
  for (let i = 0; i < 24; i++) {
    site.components.push(
      mkComponent({
        name: "Card" + i,
        type: ComponentType.Plain,
        tplTree: (baseVariant) =>
          mkTplTagX(
            "div",
            { baseVariant, styles: { display: "block" } },
            Array.from({ length: 64 }, (_, index) =>
              mkTplTagX("div", {
                baseVariant,
                styles:
                  index % 8 === 0
                    ? {
                        color: mkTokenRef(site.styleTokens[index]),
                        background: mkImageAssetRef(site.imageAssets[index]),
                      }
                    : { color: "red", background: "none" },
              }),
            ),
          ),
      }),
    );
  }
  for (const observed of [false, true]) {
    const recorder = observed
      ? new ChangeRecorder({ inst: site, _instUtil: instUtil })
      : undefined;
    try {
      measure(
        observed ? "Observed model after an edit" : "Raw model",
        () => assertSiteInvariants(site),
        (i) => {
          const rename = () => {
            site.components[0].name = "CardEdited" + i;
          };
          if (recorder) {
            recorder.withRecording(rename);
          } else {
            rename();
          }
        },
      );
      expect(componentToUsedTokens(site, site.components[0])).toHaveLength(8);
      expect(componentToUsedImageAssets(site, site.components[0])).toHaveLength(
        8,
      );
    } finally {
      recorder?.dispose();
    }
  }
}, 120000);

it("measures full validation on the bundled desktop starter project", () => {
  const site = generateSiteFromBundle(starter as [string, Bundle][]);
  measure("Desktop starter project", () => assertSiteInvariants(site));
}, 120000);
