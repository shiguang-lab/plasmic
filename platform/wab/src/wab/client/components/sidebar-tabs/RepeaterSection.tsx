import { useViewVariants } from "@/wab/client/studio-ctx/variant-state";
import { useShallow } from "zustand/react/shallow";
import { ComponentPropsSection } from "@/wab/client/components/sidebar-tabs/ComponentPropsSection";
import { TplExpsProvider } from "@/wab/client/components/style-controls/StyleComponent";
import { RepeaterPropsTooltip } from "@/wab/client/components/widgets/DetailedTooltips";
import { LabelWithDetailedTooltip } from "@/wab/client/components/widgets/LabelWithDetailedTooltip";
import { UiText } from "@/wab/client/i18n/UiText";
import { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { assert } from "@/wab/shared/common";
import { isKnownTplComponent, TplNode } from "@/wab/shared/model/classes";
import React from "react";
import { useStore } from "zustand";

export const RepeaterSection = function (props: {
  tpl: TplNode;
  viewCtx: ViewCtx;
}) {
  const { tpl, viewCtx } = props;
  useViewVariants(viewCtx, useShallow((variantState) => [variantState.frames, variantState.global]));
  const models = viewCtx.studioCtx.modelSnapshots;
  const parentRef = useStore(models.field(tpl, "parent"));

  assert(
    parentRef,
    "RepeaterSection should only be used in children of Repeater components",
  );
  const parent = models.resolve(parentRef);
  assert(
    isKnownTplComponent(parent),
    "RepeaterSection should only be used in children of Repeater components",
  );

  return (
    <ComponentPropsSection
      viewCtx={viewCtx}
      tpl={parent}
      customTitle={
        <LabelWithDetailedTooltip tooltip={<RepeaterPropsTooltip />}>
          <UiText message={"Repeater Props"} />
        </LabelWithDetailedTooltip>
      }
      expsProvider={new TplExpsProvider(viewCtx, parent)}
      tab="settings"
    />
  );
};
