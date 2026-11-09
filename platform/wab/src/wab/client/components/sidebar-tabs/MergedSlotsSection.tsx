import { useViewVariants } from "@/wab/client/studio-ctx/variant-state";
import { useShallow } from "zustand/react/shallow";
import { useInspectorComponentEvalContext } from "@/wab/client/studio-ctx/inspector-state";
import { ComponentPropsSection } from "@/wab/client/components/sidebar-tabs/ComponentPropsSection";
import {
  TextOnlySection,
  TypographySection,
} from "@/wab/client/components/sidebar-tabs/TypographySection";
import {
  TplExpsProvider,
  createStyleTarget,
  providesStyleTarget,
} from "@/wab/client/components/style-controls/StyleComponent";
import { useI18n } from "@/wab/client/i18n";
import { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import {
  getAncestorTplSlot,
  getSingleTextBlockFromArg,
  getSingleTplComponentFromArg,
  getSlotParams,
} from "@/wab/shared/SlotUtils";
import { $$$ } from "@/wab/shared/TplQuery";
import { isPlainObjectPropType } from "@/wab/shared/code-components/code-components";
import { ensure, hackyCast } from "@/wab/shared/common";
import { getComponentPropTypes } from "@/wab/shared/component-props";
import { getContextDependentValue } from "@/wab/shared/context-dependent-value";
import { getComponentDisplayName } from "@/wab/shared/core/components";
import { TplComponent } from "@/wab/shared/model/classes";
import { smartHumanize } from "@/wab/shared/strs";
import { useMergedSlotInputs } from "@/wab/client/studio-ctx/merged-slot-inputs";
import React from "react";

export const MergedSlotsTextSection = React.memo(function MergedSlotsTextSection(props: {
  tpl: TplComponent;
  viewCtx: ViewCtx;
  tab: "settings" | "style";
}) {
  const { t: studioUiT } = useI18n();
  const { viewCtx, tpl, tab } = props;
  const inputs = useMergedSlotInputs(viewCtx, tpl);
  if (!inputs.active) { return null; }
  const items = inputs.rows.filter((row) => row.text !== undefined);

  if (items.length === 0) {
    return null;
  }

  return (
    <>
      {items.map(({ key, label, text }) => {
        const { provider: textExpsProvider, ancestorSlot: textStyleAncestorSlot } = ensure(text, "A text slot row requires its provider");
        const childSc = createStyleTarget({ expsProvider: textExpsProvider });
        return providesStyleTarget(childSc)(
          tab === "settings" ? (
            <TextOnlySection
              key={`${key}-text-only`}
              expsProvider={textExpsProvider}
              viewCtx={viewCtx}
              title={studioUiT("{part1}: Text", {
                part1: label,
              })}
            />
          ) : (
            <TypographySection
              key={`${key}-text`}
              title={studioUiT("{part1}: Text", {
                part1: label,
              })}
              expsProvider={textExpsProvider as TplExpsProvider}
              ancestorSlot={textStyleAncestorSlot}
              inheritableOnly={false}
              viewCtx={viewCtx}
            />
          ),
        );
      })}
    </>
  );
});

export const MergedSlotsPropsSection = React.memo(
  function MergedSlotsSection(props: {
    tpl: TplComponent;
    viewCtx: ViewCtx;
    tab: "settings" | "style";
  }) {
    const { viewCtx, tpl, tab } = props;

    const inputs = useMergedSlotInputs(viewCtx, tpl);
    const { componentPropValues, ccContextData } = useInspectorComponentEvalContext(viewCtx, tpl);
    if (!inputs.active) { return null; }
    const slotParams = inputs.rows.filter((row) => {
      const propType = row.propType;
      if (propType === undefined) { return false; }
      if (isPlainObjectPropType(propType) && "hiddenMergedProps" in propType) {
        return !getContextDependentValue(hackyCast(propType).hiddenMergedProps, componentPropValues, ccContextData, { path: [] });
      }
      return true;
    });

    if (slotParams.length === 0) {
      return null;
    }

    return (
      <>
        {slotParams.map(({ key, label, component }) => {
          if (component) {
            const childExpsProvider = component.provider;
            const childSc = createStyleTarget({ expsProvider: childExpsProvider });
            return providesStyleTarget(childSc)(
              <ComponentPropsSection
                key={`${key}-props`}
                viewCtx={viewCtx}
                tpl={component.tpl}
                customTitle={`${label}: ${component.name} Props`}
                expsProvider={childExpsProvider}
                tab={tab}
                includeVariants
              />,
            );
          }
          return null;
        })}
      </>
    );
  },
);
