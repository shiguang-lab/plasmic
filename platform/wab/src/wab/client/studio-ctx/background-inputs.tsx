import { resolvedBackgroundImageCss } from "@/wab/client/components/sidebar-tabs/background-utils";
import { useClientTokenValues } from "@/wab/client/components/widgets/ColorPicker/client-token-resolver";
import { useImageAssetList } from "@/wab/client/studio-ctx/image-asset-inputs";
import { useStyleTokenRefs } from "@/wab/client/studio-ctx/style-token-ref-inputs";
import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { extractAllReferencedTokenIds, isTokenRef, replaceAllTokenRefs } from "@/wab/commons/StyleToken";
import type { VariantedStylesHelper } from "@/wab/shared/VariantedStylesHelper";
import { switchType } from "@/wab/shared/common";
import { BackgroundLayer, ColorFill, ImageBackground, LinearGradient, NoneBackground, RadialGradient } from "@/wab/shared/core/bg-styles";
import { extractAllAssetRefs, resolveAllAssetRefs } from "@/wab/shared/core/image-assets";
import Chroma from "@/wab/shared/utils/color-utils";
import { findLast } from "lodash";
import { basename } from "path";

const tokenRef = (id: string) => `var(--token-${id})`;

/** A finite display projection composed from the existing asset and token
 * owners. The parsed CSS layers are local edit values, not model objects. */
export function useBackgroundInputs(studio: StudioCtx, layers: readonly BackgroundLayer[], vsh: VariantedStylesHelper) {
  const imageAssets = useImageAssetList(studio);
  const raw = layers.map((layer) => layer.image.showCss());
  const colorRequests = raw.flatMap((value) => extractAllReferencedTokenIds(value).map(tokenRef));
  for (const layer of layers) { if (layer.image instanceof ColorFill && isTokenRef(layer.image.color)) { colorRequests.push(layer.image.color); } }
  const colors = useStyleTokenRefs(studio, colorRequests, vsh, "Color", (state) => state);
  const clientValues = useClientTokenValues(colors.selected.rows.map((row) => row.resolved), colors.lifetime);
  const resolveColor = (id: string) => clientValues[colors.selected.rows.findIndex((row) => row.input === tokenRef(id))];
  const clientResolved = raw.map((value) => replaceAllTokenRefs(value, resolveColor));
  // CssVarResolver's asset dictionary keeps the last UUID occurrence. Demand
  // only IDs actually used by these thumbnails, rather than copying a catalog.
  const assets = new Map(extractAllAssetRefs(clientResolved.join(" ")).flatMap((id) => {
    const asset = findLast(imageAssets.rows, (candidate) => candidate.uuid === id);
    return asset ? [[id, asset] as const] : [];
  }));
  const assetResolved = clientResolved.map((value) => resolveAllAssetRefs(value, assets));
  const remainingRequests = assetResolved.flatMap((value) => extractAllReferencedTokenIds(value).map(tokenRef));
  const remaining = useStyleTokenRefs(studio, remainingRequests, vsh, "dictionary", (state) => state);
  const thumbnails = layers.map((layer) => resolvedBackgroundImageCss(layer.image, resolveColor, (value) => replaceAllTokenRefs(
    resolveAllAssetRefs(value, assets),
    (id) => remaining.selected.rows.find((row) => row.input === tokenRef(id))?.resolved?.value,
  )));
  const labels = layers.map((layer) => switchType(layer.image)
    .when(ImageBackground, (image) => {
      const id = extractAllAssetRefs(image.url)[0];
      const asset = id ? imageAssets.rows.find((candidate) => candidate.uuid === id) : undefined;
      return asset ? asset.name : image.url.startsWith("data:") ? "Uploaded file" : basename(image.url);
    })
    .when(ColorFill, (fill) => isTokenRef(fill.color)
      ? colors.selected.rows.find((row) => row.input === fill.color)?.applied?.name || "Color token"
      : Chroma.stringify(fill.color))
    .when(LinearGradient, () => "Linear gradient")
    .when(RadialGradient, () => "Radial gradient")
    .when(NoneBackground, () => "Invalid layer")
    .result());
  return { labels, thumbnails };
}
