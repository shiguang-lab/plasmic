import { replaceAllTokenRefs } from "@/wab/commons/StyleToken";
import type { BackgroundLayer } from "@/wab/shared/core/bg-styles";

/** Color tokens consult the client DOM before remaining asset/token references. */
export const resolvedBackgroundImageCss = (
  bgImg: BackgroundLayer["image"],
  resolveColorToken: (tokenId: string) => string | undefined,
  resolveRemainingRefs: (css: string) => string,
) => resolveRemainingRefs(replaceAllTokenRefs(bgImg.showCss(), resolveColorToken));
