import { ExpsProvider } from "@/wab/client/components/style-controls/StyleComponent";
import { makeVariantsController } from "@/wab/client/components/variants/VariantsController";
import { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { VariantedStylesHelper } from "@/wab/shared/VariantedStylesHelper";
import { isGlobalVariant } from "@/wab/shared/Variants";

export const isStylePropSet =
  (expsProvider: ExpsProvider) =>
  (...properties: string[]) =>
    properties.some(
      (prop) => expsProvider.definedIndicator(prop).source !== "none",
    );

export const readGlobalStyleContext = (
  studioCtx: StudioCtx,
) => {
  const vc = makeVariantsController(studioCtx);
  return {
    active: vc?.getActiveNonBaseVariants().filter((v) => isGlobalVariant(v)),
    target: vc?.getTargetedVariants().filter((v) => isGlobalVariant(v)),
    sources: vc?.readSources(),
  };
};

export const makeVariantedStylesHelperFromCurrentCtx = (studioCtx: StudioCtx) => {
  const context = readGlobalStyleContext(studioCtx);
  return new VariantedStylesHelper(studioCtx.site, context.active, context.target);
};
