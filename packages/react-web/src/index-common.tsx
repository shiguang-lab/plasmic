// Utilities used by generated code
import _classNames from "classnames";
export { PlasmicTranslator } from "@plasmicapp/host";
export {
  PlasmicPageGuard,
  withPlasmicPageGuard,
} from "./auth/PlasmicPageGuard";
export { omit, pick } from "./common";
export { HTMLElementRefOf, StrictProps, mergeRefs } from "./react-utils";
export { PlasmicHead, plasmicHeadMeta } from "./render/PlasmicHead";
export { PlasmicIcon } from "./render/PlasmicIcon";
export { PlasmicImg } from "./render/PlasmicImg";
export { PlasmicLink } from "./render/PlasmicLink";
export { PlasmicSlot, renderPlasmicSlot } from "./render/PlasmicSlot";
export { Stack } from "./render/Stack";
export { usePlasmicRefs } from "./render/refs";
export {
  Flex,
  MultiChoiceArg,
  SingleBooleanChoiceArg,
  SingleChoiceArg,
  createPlasmicElementProxy,
  deriveRenderOpts,
  hasVariant,
  makeFragment,
  mergeVariantsWithStates,
  wrapWithClassName,
} from "./render/elements";
export {
  ensureGlobalVariants,
} from "./render/global-variants";
export { createScreenVariantStore, useScreenVariants } from "./render/screen-variants";
export {
  PlasmicDataSourceContextProvider,
  PlasmicRootProvider,
  useCurrentUser,
  useIsSSR,
} from "./render/ssr";
export {
  StyleTokensProvider,
  useStyleTokens,
} from "./render/style-tokens";
export {
  Trans,
  genTranslatableString,
  usePlasmicTranslator,
} from "./render/translation";
export { useHover, usePressed, useFocused, useFocusVisible, useFocusedWithin, useFocusVisibleWithin } from "./render/triggers";
export { getDefaultPlasmicProps } from "./plume/props-utils";
export { PLUME_STRICT_MODE } from "./plume/plume-utils";
export type { PlasmicClassMetadata } from "./plume/plume-utils";
export * from "./states";
// Using any while classnames package is not updated to have the correct types exported
export const classNames: any = _classNames;

/**
 * Props for generated page components.
 * @internal
 */
export type ParamsRecord = Record<string, string | string[] | undefined>;
/** @internal */
export interface PlasmicPageProps {
  params?: Promise<ParamsRecord> | ParamsRecord;
  searchParams?: Promise<ParamsRecord> | ParamsRecord;
}
