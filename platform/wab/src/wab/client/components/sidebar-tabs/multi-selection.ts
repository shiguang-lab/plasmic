import { isTplCodeComponentStyleable } from "@/wab/client/code-components/code-components";
import {
  canEditSection,
  isCodeComponentMissingPositionClass,
  Section,
} from "@/wab/client/components/sidebar-tabs/Sections";
import { TplExpsProvider } from "@/wab/client/components/style-controls/StyleComponent";
import { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { PublicStyleSection } from "@/wab/shared/ApiSchema";
import { isSelectableLocked } from "@/wab/shared/core/selection";
import { isValidStylePropForTpl } from "@/wab/shared/core/style-props-tpl";
import {
  isTplCodeComponent,
  isTplVariantable,
  resolveTplRoot,
} from "@/wab/shared/core/tpls";
import { ValComponent } from "@/wab/shared/core/val-nodes";
import { getTargetBlockingCombo } from "@/wab/shared/defined-indicator";
import { standardCorners } from "@/wab/shared/geom";
import { uniq } from "lodash";

export const multiSelectionFields = {
  width: {
    label: "Width",
    section: Section.Size,
    publicSection: PublicStyleSection.Sizing,
  },
  height: {
    label: "Height",
    section: Section.Size,
    publicSection: PublicStyleSection.Sizing,
  },
  opacity: {
    label: "Opacity",
    section: Section.Visibility,
    publicSection: PublicStyleSection.Visibility,
  },
  "border-radius": {
    label: "Border radius",
    section: Section.Border,
    publicSection: PublicStyleSection.Border,
  },
  "font-size": {
    label: "Font size",
    section: Section.Typography,
    publicSection: PublicStyleSection.Typography,
  },
  color: {
    label: "Color",
    section: Section.Typography,
    publicSection: PublicStyleSection.Typography,
  },
} as const;
export type MultiSelectionProp = keyof typeof multiSelectionFields;

function styleProps(prop: string) {
  return prop === "border-radius"
    ? standardCorners.map((corner) => `border-${corner}-radius`)
    : [prop];
}

export function getMultiSelectionProviders(viewCtx: ViewCtx) {
  return uniq(viewCtx.focusedTpls()).flatMap((tpl) =>
    tpl && isTplVariantable(tpl) ? [new TplExpsProvider(viewCtx, tpl)] : [],
  );
}

export function getCommonStyleValue(
  providers: TplExpsProvider[],
  prop: string,
) {
  const values = providers.flatMap((provider) =>
    styleProps(prop).map((styleProp) => provider.mergedExp().get(styleProp)),
  );
  const mixed = values.some((value) => value !== values[0]);
  return { value: mixed ? undefined : values[0], mixed };
}

export function getMultiSelectionFieldState(
  viewCtx: ViewCtx,
  providers: TplExpsProvider[],
  prop: MultiSelectionProp,
) {
  const studioCtx = viewCtx.studioCtx;
  const field = multiSelectionFields[prop];
  const selectables = viewCtx.focusedSelectables();
  const supported =
    providers.length > 0 &&
    providers.length === uniq(viewCtx.focusedTpls()).length &&
    canEditSection(studioCtx, field.section) &&
    providers.every((provider) => {
      const root = resolveTplRoot(provider.tpl);
      if (isTplCodeComponent(root)) {
        const sections = viewCtx.getTplCodeComponentMeta(root)?.styleSections;
        if (
          !isTplCodeComponentStyleable(
            studioCtx.codeComponentsRegistry,
            root,
          ) ||
          (Array.isArray(sections) && !sections.includes(field.publicSection))
        ) {
          return false;
        }
      }
      return styleProps(prop).every((styleProp) =>
        isValidStylePropForTpl(
          styleProp,
          provider.tpl,
          provider.mergedExp(),
          studioCtx.codeComponentsRegistry,
        ),
      );
    });
  const disabled =
    !supported ||
    !studioCtx.canEditProject() ||
    !studioCtx.canEditBranch() ||
    selectables.some((sel) => {
      if (!sel || isSelectableLocked(sel, viewCtx.valState())) {
        return true;
      }
      if (
        sel instanceof ValComponent &&
        isCodeComponentMissingPositionClass(viewCtx, sel)
      ) {
        const root = resolveTplRoot(sel.tpl);
        return (
          !isTplCodeComponent(root) ||
          viewCtx.getTplCodeComponentMeta(root)?.styleSections !== true
        );
      }
      return false;
    }) ||
    !!getTargetBlockingCombo(
      providers.flatMap((provider) =>
        styleProps(prop).map((styleProp) =>
          provider.definedIndicator(styleProp),
        ),
      ),
    );
  return { ...getCommonStyleValue(providers, prop), supported, disabled };
}

/** Use each node's recording variant and one Studio transaction for the whole edit. */
export function setMultiSelectionStyle(
  viewCtx: ViewCtx,
  prop: MultiSelectionProp,
  value: string | undefined,
) {
  const providers = getMultiSelectionProviders(viewCtx);
  if (getMultiSelectionFieldState(viewCtx, providers, prop).disabled) {
    return Promise.resolve();
  }
  return viewCtx.change(() => {
    for (const provider of providers) {
      for (const styleProp of styleProps(prop)) {
        if (value === undefined) {
          provider.maybeTargetExp()?.clear(styleProp);
        } else {
          provider.targetExp().set(styleProp, value);
        }
      }
    }
  });
}
