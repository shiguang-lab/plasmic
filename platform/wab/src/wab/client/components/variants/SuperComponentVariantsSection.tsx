import { useSuperComponentVariantInputs } from "@/wab/client/studio-ctx/variant-group-inputs";
import ListSectionHeader from "@/wab/client/components/ListSectionHeader";
import { makeReadOnlySection } from "@/wab/client/components/variants/VariantSection";
import { VariantsController } from "@/wab/client/components/variants/VariantsController";
import { Icon } from "@/wab/client/components/widgets/Icon";
import { UiText } from "@/wab/client/i18n/UiText";
import VariantGroupIcon from "@/wab/client/plasmic/plasmic_kit/PlasmicIcon__VariantGroup";
import { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { Component } from "@/wab/shared/model/classes";
import React from "react";

export function SuperComponentVariantsSection(props: {
    component: Component;
    vcontroller: VariantsController;
    studioCtx: StudioCtx;
    viewCtx?: ViewCtx;
  }) {
    const { component, vcontroller, studioCtx, viewCtx } = props;
    const { snapshot, resolve } = useSuperComponentVariantInputs(studioCtx, component, vcontroller);
    const [isExpanded, setExpanded] = React.useState(false);
    return (
      <div>
        <ListSectionHeader
          collapseState={isExpanded ? "expanded" : "collapsed"}
          onToggle={() => setExpanded(!isExpanded)}
        >
          {snapshot.name} <UiText message={"Variants"} />
        </ListSectionHeader>
        {isExpanded &&
          snapshot.groups.map((group) => {
            const inputs = group.variants.map((input) => ({ ...input, variant: resolve(input.ref) }));
            return makeReadOnlySection({
              studioCtx,
              viewCtx,
              vcontroller,
              icon: <Icon icon={VariantGroupIcon} />,
              title: group.name,
              variants: inputs.map((input) => input.variant),
              readInputs: { canChangeVariants: snapshot.canChangeVariants, variants: inputs },
              key: group.uuid,
            });
          })}
      </div>
    );
  }
