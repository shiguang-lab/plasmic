/** @format */

import S from "@/wab/client/components/sidebar-tabs/ComponentTab/ComponentTab.module.scss";
import PageMetaPanel from "@/wab/client/components/sidebar-tabs/PageMetaPanel";
import { ModelNameHeader } from "@/wab/client/components/sidebar-tabs/ModelNameHeader";
import { PageMinRoleSection } from "@/wab/client/components/sidebar-tabs/PageMinRoleSection";
import { PageURLParametersSection } from "@/wab/client/components/sidebar-tabs/PageURLParametersSection";
import VariablesSection from "@/wab/client/components/sidebar-tabs/StateManagement/VariablesSection";
import { ComponentDataQueriesSection } from "@/wab/client/components/sidebar-tabs/component-data-queries-section";
import { ServerQueriesSection } from "@/wab/client/components/sidebar-tabs/server-queries-section";
import { SidebarSection } from "@/wab/client/components/sidebar/SidebarSection";
import { VariantsPanel } from "@/wab/client/components/variants/VariantsPanel";
import { Icon } from "@/wab/client/components/widgets/Icon";
import { useI18n } from "@/wab/client/i18n";
import GearIcon from "@/wab/client/plasmic/plasmic_kit/PlasmicIcon__Gear";
import PageIcon from "@/wab/client/plasmic/plasmic_kit_design_system/icons/PlasmicIcon__Page";
import { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { useFocusedViewSelection } from "@/wab/client/studio-ctx/selection-state";
import { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { PublicStyleSection } from "@/wab/shared/ApiSchema";
import { PageComponent } from "@/wab/shared/core/components";
import { useStore } from "zustand";
import { Button, Tooltip } from "antd";
     
import React from "react";
import { useLocalStorage } from "react-use";

export const PageTab = function PageTab(props: {
  viewCtx: ViewCtx;
  studioCtx: StudioCtx;
  page: PageComponent;
  isHalf?: boolean;
}) {
  const { t: uiT } = useI18n();
  const { studioCtx, page, viewCtx, isHalf = false } = props;
  const hasFocusedTpl = useFocusedViewSelection(studioCtx, (state) => state.tpls[0] != null);

  const permissions = useStore(studioCtx.uiEnvironment.store, (state) => state.componentSectionPermissions);
  const enableDataQueries = useStore(studioCtx.uiEnvironment.store, (state) => state.enableDataQueries);
  const [isExpanded, setExpanded] = useLocalStorage(
    "PageTab.isExpanded",
    false,
  );



  const headerTitle = React.useMemo(
    () => (
      <ModelNameHeader
        icon={<Icon icon={PageIcon} className="component-fg" />}
        nameStore={studioCtx.modelSnapshots.field(page, "name")}
        onChange={(name) =>
          studioCtx.changeUnsafe(() =>
            studioCtx.siteOps().tryRenameComponent(page, name),
          )
        }
        placeholder={uiT("(unnamed page)")}
      />
    ),
    [page, studioCtx, uiT],
  );

  const canEditPageMeta = permissions[PublicStyleSection.PageMeta];
  const headerControls = React.useMemo(
    () =>
      canEditPageMeta && (
        <Tooltip title={uiT("Page settings")}>
          <Button
            type="text"
            size="small"
            icon={<Icon icon={GearIcon} />}
            aria-label={uiT("Page settings")}
            data-test-id="page-settings-button"
            onClick={() =>
              studioCtx.changeUnsafe(() => {
                studioCtx.pageSettingsPage = page;
                studioCtx.pageSettingsOpen = true;
              })
            }
          />
        </Tooltip>
      ),
    [uiT, studioCtx, page, canEditPageMeta],
  );

  return (
    <>
      <SidebarSection
        style={{ paddingTop: 0 }}
        zeroBodyPadding
        scrollable
        defaultExtraContentExpanded={isExpanded}
        onExtraContentCollapsed={() => setExpanded(false)}
        onExtraContentExpanded={() => setExpanded(true)}
        title={undefined}
        controls={undefined}
      >
        {(renderMaybeCollapsibleRows) => {
          return (
            <>
              {renderMaybeCollapsibleRows([
                {
                  collapsible:
                    isHalf && hasFocusedTpl,
                  content: (
                    <>
                      <SidebarSection>
                        <div className={S.componentTabHeaderContainer}>
                          {headerTitle}
                          {headerControls}
                        </div>
                      </SidebarSection>
                      {canEditPageMeta && (
                        <>
                          <PageMetaPanel page={page} viewCtx={viewCtx} />
                          <PageURLParametersSection page={page} />
                          <PageMinRoleSection page={page} />
                        </>
                      )}
                      {permissions[PublicStyleSection.DataQueries] && (
                        <>
                          <ServerQueriesSection
                            component={page}
                            viewCtx={viewCtx}
                          />
                          {enableDataQueries && (
                            <ComponentDataQueriesSection
                              component={page}
                              viewCtx={viewCtx}
                              isDeprecated
                            />
                          )}
                        </>
                      )}

                      {permissions[PublicStyleSection.States] && (
                        <VariablesSection component={page} viewCtx={viewCtx} />
                      )}
                      {permissions[PublicStyleSection.ComponentVariants] && (
                        <VariantsPanel
                          component={page}
                          studioCtx={studioCtx}
                          viewCtx={viewCtx}
                        />
                      )}
                    </>
                  ),
                },
              ])}
            </>
          );
        }}
      </SidebarSection>
    </>
  );
};
