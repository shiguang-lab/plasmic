import { useStudioCtx } from "@/wab/client/contexts/StudioContexts";
import { useVariantModelWorld } from "@/wab/client/components/variants/variant-model-world";
import { useModelSelector } from "@/wab/client/stores/model-revisions-react";
import { modelKeys } from "@/wab/shared/model-revisions";
import { SidebarSection } from "@/wab/client/components/sidebar/SidebarSection";
import { HoverableDisclosure } from "@/wab/client/components/widgets/HoverableDisclosure";
import { UiText } from "@/wab/client/i18n/UiText";
import { joinReactNodes } from "@/wab/commons/components/ReactUtil";
import { flattenComponent } from "@/wab/shared/cached-selectors";
import { withoutNils } from "@/wab/shared/common";
import { allComponentVariants } from "@/wab/shared/core/components";
import { isTplSlot } from "@/wab/shared/core/tpls";
import { Component } from "@/wab/shared/model/classes";
import {
  getPlumeEditorPlugin,
  getPlumeElementDef,
  getPlumeSlotDef,
  getPlumeVariantDef,
} from "@/wab/shared/plume/plume-registry";
import { Alert } from "antd";
import * as React from "react";

export const PlumeMissingIngredientsPanel = React.memo(function PlumeMissingIngredientsPanel(props: { component: Component }) {
  const studio = useStudioCtx();
  const world = useVariantModelWorld(studio, props.component);
  return world.alive ? <PlumeIngredientsContent {...props} world={world} /> : null;
});
function captureMissingIngredients(component: Component) {
    const plugin = getPlumeEditorPlugin(component);
    if (!plugin) {
      return undefined;
    }

    const meta = plugin.componentMeta;

    const foundVariantDefs = withoutNils(
      allComponentVariants(component).map((v) =>
        getPlumeVariantDef(component, v),
      ),
    );

    const elements = flattenComponent(component);
    const foundSlotDefs = withoutNils(
      elements
        .filter(isTplSlot)
        .map((e) => getPlumeSlotDef(component, e.param)),
    );
    const foundElementDefs = withoutNils(
      elements.map((e) => getPlumeElementDef(component, e)),
    );

    const missingVariantDefs = meta.variantDefs.filter(
      (d) => !foundVariantDefs.includes(d),
    );
    const missingSlotDefs = meta.slotDefs.filter(
      (d) => !foundSlotDefs.includes(d),
    );
    const missingElementDefs = meta.elementDefs.filter(
      (d) => !foundElementDefs.includes(d),
    );
    return Object.freeze({ missingVariantDefs: Object.freeze(missingVariantDefs), missingSlotDefs: Object.freeze(missingSlotDefs), missingElementDefs: Object.freeze(missingElementDefs) });
}

const PlumeIngredientsContent = React.memo(
  function PlumeIngredientsContent(props: { component: Component; world: ReturnType<typeof useVariantModelWorld> }) {
    const { component } = props;
    const studioCtx = useStudioCtx();
    const capture = React.useCallback(() => props.world.isCurrent() ? captureMissingIngredients(component) : undefined, [props.world, component]);
    const missing = useModelSelector(studioCtx.modelRevisions, [modelKeys.component(component.uuid)], capture);
    if (!missing) { return null; }
    const { missingVariantDefs, missingSlotDefs, missingElementDefs } = missing;

    if (
      missingVariantDefs.length === 0 &&
      missingSlotDefs.length === 0 &&
      missingElementDefs.length === 0
    ) {
      return null;
    }
    return (
      <SidebarSection>
        <Alert
          type="warning"
          message={
            <>
              {missingVariantDefs.length > 0 && (
                <div>
                  <strong>
                    <UiText message={"Missing variants:"} />{" "}
                  </strong>
                  {joinReactNodes(
                    missingVariantDefs.map((d) => (
                      <HoverableDisclosure title={d.info}>
                        {d.variant}
                      </HoverableDisclosure>
                    )),
                    ", ",
                  )}
                </div>
              )}
              {missingSlotDefs.length > 0 && (
                <div>
                  <strong>
                    <UiText message={"Missing slots:"} />{" "}
                  </strong>
                  {joinReactNodes(
                    missingSlotDefs.map((d) => (
                      <HoverableDisclosure title={d.info}>
                        {d.name}
                      </HoverableDisclosure>
                    )),
                    ", ",
                  )}
                </div>
              )}
              {missingElementDefs.length > 0 && (
                <div>
                  <strong>
                    <UiText message={"Missing elements:"} />{" "}
                  </strong>
                  {joinReactNodes(
                    missingElementDefs.map((d) => (
                      <HoverableDisclosure title={d.info}>
                        {d.name}
                      </HoverableDisclosure>
                    )),
                    ", ",
                  )}
                </div>
              )}
            </>
          }
        />
      </SidebarSection>
    );
  },
);
