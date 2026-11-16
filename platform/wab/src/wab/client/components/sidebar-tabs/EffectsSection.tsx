import { FilterEffectsPanelSection } from "@/wab/client/components/sidebar-tabs/FilterEffectSection";
import { InteractionStylesPanelSection } from "@/wab/client/components/sidebar-tabs/InteractionStylesPanelSection";
import { ExpsProvider } from "@/wab/client/components/style-controls/StyleComponent";
import React from "react";

export function EffectsPanelSection({ expsProvider, animatableOnly }: {
  expsProvider: ExpsProvider;
  animatableOnly?: boolean;
}) {
  return <>
    <FilterEffectsPanelSection expsProvider={expsProvider} />
    {!animatableOnly && <InteractionStylesPanelSection expsProvider={expsProvider} />}
  </>;
}
