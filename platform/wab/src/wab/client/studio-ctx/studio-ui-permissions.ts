import { PublicStyleSection, type StyleSectionVisibilities } from "@/wab/shared/ApiSchema";
import type { LeftTabUiKey, UiAccess } from "@/wab/shared/ui-config-utils";

/** Exhaustive DTO shape; each value uses the caller's existing permission policy. */
export function captureLeftTabPermissions(read: (key: LeftTabUiKey) => UiAccess): Readonly<Record<LeftTabUiKey, UiAccess>> {
  return Object.freeze({
    outline: read("outline"),
    components: read("components"),
    tokens: read("tokens"),
    dataTokens: read("dataTokens"),
    animationSequences: read("animationSequences"),
    mixins: read("mixins"),
    fonts: read("fonts"),
    themes: read("themes"),
    images: read("images"),
    responsiveness: read("responsiveness"),
    libraries: read("libraries"),
    versions: read("versions"),
    settings: read("settings"),
    splits: read("splits"),
    lint: read("lint"),
    expressions: read("expressions"),
    imports: read("imports"),
    imagesSection: read("imagesSection"),
    iconsSection: read("iconsSection"),
    figma: read("figma"),
    pen: read("pen"),
  });
}


export type ComponentSectionPermissions = Readonly<Pick<StyleSectionVisibilities,
  PublicStyleSection.ComponentProps | PublicStyleSection.ComponentVariants |
  PublicStyleSection.DataQueries | PublicStyleSection.States | PublicStyleSection.PageMeta>>;

/** The five component-level sections use the existing content-editor policy. */
export function captureComponentSectionPermissions(read: (key: PublicStyleSection) => boolean): ComponentSectionPermissions {
  return Object.freeze({
    [PublicStyleSection.ComponentProps]: read(PublicStyleSection.ComponentProps),
    [PublicStyleSection.ComponentVariants]: read(PublicStyleSection.ComponentVariants),
    [PublicStyleSection.DataQueries]: read(PublicStyleSection.DataQueries),
    [PublicStyleSection.States]: read(PublicStyleSection.States),
    [PublicStyleSection.PageMeta]: read(PublicStyleSection.PageMeta),
  });
}
