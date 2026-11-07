import { useFocusedViewSelection } from "@/wab/client/studio-ctx/selection-state";
import { PlumeMissingIngredientsPanel } from "@/wab/client/components/plume/PlumeComponentPanel";
import { ComponentPropsDefinitionSection } from "@/wab/client/components/sidebar-tabs/ComponentPropsDefinitionSection";
import S from "@/wab/client/components/sidebar-tabs/ComponentTab/ComponentTab.module.scss";
import VariablesSection from "@/wab/client/components/sidebar-tabs/StateManagement/VariablesSection";
import { ComponentDataQueriesSection } from "@/wab/client/components/sidebar-tabs/component-data-queries-section";
import { LegacyComponentParamsSection } from "@/wab/client/components/sidebar-tabs/legacy-component-params-section";
import { ServerQueriesSection } from "@/wab/client/components/sidebar-tabs/server-queries-section";
import { SidebarModal } from "@/wab/client/components/sidebar/SidebarModal";
import { SidebarSection } from "@/wab/client/components/sidebar/SidebarSection";
import { NamedPanelHeader } from "@/wab/client/components/sidebar/sidebar-helpers";
import {
  VariantsPanel,
  VariantsPanelHandle,
} from "@/wab/client/components/variants/VariantsPanel";
import { HoverableDisclosure } from "@/wab/client/components/widgets/HoverableDisclosure";
import { Icon } from "@/wab/client/components/widgets/Icon";
import IconButton from "@/wab/client/components/widgets/IconButton";
import { useI18n } from "@/wab/client/i18n";
import { UiText } from "@/wab/client/i18n/UiText";
import ComponentIcon from "@/wab/client/plasmic/plasmic_kit/PlasmicIcon__Component";
import GearIcon from "@/wab/client/plasmic/plasmic_kit/PlasmicIcon__Gear";
import PlumeMarkIcon from "@/wab/client/plasmic/plasmic_kit_design_system/icons/PlasmicIcon__PlumeMark";
import { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { PublicStyleSection } from "@/wab/shared/ApiSchema";
import { Component } from "@/wab/shared/model/classes";
import { getPlumeEditorPluginByType } from "@/wab/shared/plume/plume-registry";
import { useStore } from "zustand";
     
import React from "react";
import { useLocalStorage } from "react-use";

export const ComponentTab = function ComponentTab(props: {
  component: Component;
  studioCtx: StudioCtx;
  viewCtx: ViewCtx;
  isHalf?: boolean;
}) {
  const { t: uiT } = useI18n();
  const { component, studioCtx, viewCtx, isHalf = false } = props;
  const hasFocusedTpl = useFocusedViewSelection(studioCtx, (state) => state.tpls[0] != null);
  const permissions = useStore(studioCtx.uiEnvironment.store, (state) => state.componentSectionPermissions);
  const enableDataQueries = useStore(studioCtx.uiEnvironment.store, (state) => state.enableDataQueries);

  const models = studioCtx.modelSnapshots;
  const nameStore = React.useMemo(() => models.field(component, "name"), [models, component]);
  const name = useStore(nameStore);
  const plumeStore = React.useMemo(() => models.field(component, "plumeInfo"), [models, component]);
  const plumeRef = useStore(plumeStore);
  const plumeTypeStore = React.useMemo(() => plumeRef ? models.field(models.resolve(plumeRef), "type") : undefined, [models, plumeRef]);
  const subscribePlumeType = React.useCallback((listener: () => void) => plumeTypeStore ? plumeTypeStore.subscribe(listener) : () => undefined, [plumeTypeStore]);
  const readPlumeType = React.useCallback(() => plumeTypeStore?.getState(), [plumeTypeStore]);
  const plumeType = React.useSyncExternalStore(subscribePlumeType, readPlumeType, readPlumeType);
  const plugin = plumeType ? getPlumeEditorPluginByType(plumeType) : undefined;
  const contentEditorMode = useStore(studioCtx.uiEnvironment.store, (state) => state.contentEditorMode);
  const variantsPanelRef = React.useRef<VariantsPanelHandle>(null);
  const [isExpanded, setExpanded] = useLocalStorage(
    "ComponentTab.isExpanded",
    false,
  );
  const [showSettings, setShowSettings] = React.useState(false);



  return (
    <>
      {showSettings && (
        <SidebarModal
          show
          title={uiT("{part1} Settings", {
            part1: String(name),
          })}
          onClose={() => setShowSettings(false)}
          persistOnInteractOutside
          data-test-id="comp-settings"
        >
          <LegacyComponentParamsSection
            studioCtx={studioCtx}
            component={component}
            metaDataOnly
          />
        </SidebarModal>
      )}
      <SidebarSection
        scrollable
        zeroBodyPadding
        defaultExtraContentExpanded={isExpanded}
        onExtraContentCollapsed={() => setExpanded(false)}
        onExtraContentExpanded={() => setExpanded(true)}
        data-test-id="component-panel"
      >
        {!contentEditorMode &&
          ((renderMaybeCollapsibleRows) => (
            <>
              <SidebarSection>
                <div className={S.componentTabHeaderContainer}>
                  <NamedPanelHeader
                    icon={
                      <Icon icon={ComponentIcon} className="component-fg" />
                    }
                    value={name}
                    onChange={async (nextName) =>
                      studioCtx.changeUnsafe(() =>
                        studioCtx.siteOps().tryRenameComponent(component, nextName),
                      )
                    }
                    placeholder={uiT("(unnamed component)")}
                    subtitle={
                      plugin ? (
                        <HoverableDisclosure
                          title={plugin.componentMeta.description}
                        >
                          <span>
                            <Icon icon={PlumeMarkIcon} />{" "}
                            <code>{plugin.componentMeta.name}</code>{" "}
                            <UiText message={"Component"} />
                          </span>
                        </HoverableDisclosure>
                      ) : undefined
                    }
                  />
                  {permissions[PublicStyleSection.ComponentProps] && (
                    <IconButton
                      tooltip={uiT("Component settings")}
                      onClick={() => setShowSettings(true)}
                      data-test-id="btn-show-settings"
                    >
                      <Icon icon={GearIcon} />
                    </IconButton>
                  )}
                </div>
              </SidebarSection>
              {renderMaybeCollapsibleRows([
                {
                  collapsible:
                    isHalf && hasFocusedTpl,
                  content: (
                    <>
                      <PlumeMissingIngredientsPanel component={component} />
                      {permissions[PublicStyleSection.ComponentProps] && (
                        <ComponentPropsDefinitionSection
                          studioCtx={studioCtx}
                          component={component}
                          viewCtx={viewCtx}
                        />
                      )}
                      {permissions[PublicStyleSection.DataQueries] && (
                        <>
                          <ServerQueriesSection
                            component={component}
                            viewCtx={viewCtx}
                          />
                          {enableDataQueries && (
                            <ComponentDataQueriesSection
                              component={component}
                              viewCtx={viewCtx}
                              isDeprecated
                            />
                          )}
                        </>
                      )}
                      {permissions[PublicStyleSection.States] && (
                        <VariablesSection
                          component={component}
                          viewCtx={viewCtx}
                        />
                      )}
                      {permissions[PublicStyleSection.ComponentVariants] && (
                        <VariantsPanel
                          studioCtx={studioCtx}
                          viewCtx={viewCtx}
                          component={component}
                          ref={variantsPanelRef}
                        />
                      )}
                    </>
                  ),
                },
              ])}
            </>
          ))}
      </SidebarSection>
    </>
  );
};
