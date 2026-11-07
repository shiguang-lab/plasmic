import { useStudioRenderPolicy } from "@/wab/client/studio-ctx/studio-render-policy";
import { useStudioArena } from "@/wab/client/studio-ctx/arena-state";
import { useStudioSelection, useViewSelection } from "@/wab/client/studio-ctx/selection-state";
import { useShallow } from "zustand/react/shallow";
import { useInspectorPending } from "@/wab/client/studio-ctx/inspector-state";
import CommentsTab from "@/wab/client/components/comments/CommentsTab";
import { DevContainer } from "@/wab/client/components/dev";
import { FrameSelectionPanel } from "@/wab/client/components/sidebar-tabs/FrameSelectionPanel";
import { MultiSelectionPanel } from "@/wab/client/components/sidebar-tabs/MultiSelectionPanel";
import {
  ComponentOrPageTab,
  StyleTab,
  StyleTabContext,
} from "@/wab/client/components/sidebar-tabs/style-tab";
import { SidePanelShell } from "@/wab/client/components/studio/SidePanelShell";
import { providesSidebarPopupSetting } from "@/wab/client/components/style-controls/StyleComponent";
import * as widgets from "@/wab/client/components/widgets";
import { UiText } from "@/wab/client/i18n/UiText";
import { RightTabKey, StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { selectPanelsHidden } from "@/wab/client/studio-ctx/left-panel-state";
import { isTplComponent, summarizeTpl } from "@/wab/shared/core/tpls";
import { isKnownTplTag } from "@/wab/shared/model/classes";
import { Tabs } from "antd";
import cx from "classnames";
import { observer } from "mobx-react";
import React from "react";
import { useStore } from "zustand";

export const RightPane = observer(function RightPane({
  studioCtx,
  canvasLoading,
}: {
  studioCtx: StudioCtx;
  canvasLoading: boolean;
}) {
  useStudioSelection(studioCtx, useShallow((state) => [state.frames, state.view]));
  const [hover, setHover] = React.useState(false);
  const pending = useInspectorPending(studioCtx);
  const devMode = useStudioRenderPolicy(studioCtx, (state) => state.devMode);
  const panelsHidden = useStore(
    studioCtx.leftPanelState.store,
    selectPanelsHidden,
  );

  const focusedViewCtx = studioCtx.focusedViewCtx();
  useStudioArena(studioCtx, useShallow((state) => [state.current, state.frames[0]] as const));
  useViewSelection(focusedViewCtx, useShallow((state) => [state.doms, state.part, state.targets, state.tpls]));
  const isFrameSelection = studioCtx.focusedFrames().length > 1;
  const selectionCount = isFrameSelection
    ? studioCtx.focusedFrames().length
    : (focusedViewCtx?.focusedSelectables().length ?? 0);
  const isMultiSelection = selectionCount > 1;
  const focusedOrFirstViewCtx = studioCtx.focusedOrFirstViewCtx();
  const selectedTpl = focusedViewCtx?.focusedTpl();
  const selectionTitle = selectedTpl
    ? ((isTplComponent(selectedTpl) || isKnownTplTag(selectedTpl)) &&
        selectedTpl.name) ||
      summarizeTpl(selectedTpl)
    : focusedOrFirstViewCtx?.component.name;
  const partTitle = focusedViewCtx?.focusedComponentPart?.displayName;

  const inspectorTitle =
    studioCtx.rightTabKey === RightTabKey.component
      ? focusedOrFirstViewCtx?.component.name
      : partTitle ? `${selectionTitle} › ${partTitle}` : selectionTitle;

  const tabs: widgets.Tab[] = [];

  // Element tabs are shown if an artboard is focused
  // and element is selected (not frame)
  if (focusedViewCtx && !studioCtx.focusedFrame()) {
    tabs.push(
      new widgets.Tab({
        name: <UiText message={"Design"} />,
        key: RightTabKey.style,
        contents: () => (
          <StyleTabContext.Provider value="design">
            <StyleTab studioCtx={studioCtx} viewCtx={focusedViewCtx} />
          </StyleTabContext.Provider>
        ),
      }),
      new widgets.Tab({
        name: <UiText message={"Interactions"} />,
        key: RightTabKey.interactions,
        contents: () => (
          <StyleTabContext.Provider value="interactions">
            <StyleTab studioCtx={studioCtx} viewCtx={focusedViewCtx} />
          </StyleTabContext.Provider>
        ),
      }),
    );
  }

  // Page/component tab is shown if an artboard is focused
  // or defaults to the first artboard for dedicated arenas.
  if (focusedOrFirstViewCtx) {
    tabs.push(
      new widgets.Tab({
        name: <UiText message={"Data"} />,
        key: RightTabKey.component,
        contents: () => (
          !pending && <ComponentOrPageTab
            studioCtx={studioCtx}
            viewCtx={focusedOrFirstViewCtx}
          />
        ),
      }),
    );
  }

  React.useEffect(() => {
    if (tabs.length === 1 && !isMultiSelection) {
      studioCtx.switchRightTab(tabs[0].key as RightTabKey);
    }
  }, [tabs.length, isMultiSelection]);

  const showCommentsPanel =
    studioCtx.showComments() && studioCtx.showCommentsPanel;
  const open =
    !canvasLoading &&
    devMode &&
    !panelsHidden &&
    (tabs.length > 0 || showCommentsPanel || isFrameSelection);

  return providesSidebarPopupSetting({ left: false })(
    <SidePanelShell open={open} side="right">
      <DevContainer
        className={cx({
          "flex-col": true,
          "flex-fill": true,
          "overflow-hidden": true,
          dimfg: true,
          monochrome: !hover,
        })}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
      >
        {showCommentsPanel ? (
          <CommentsTab />
        ) : (
          <>
            <div className="editor-panel-header">
              <strong
                className="editor-panel-title"
                title={isMultiSelection ? undefined : inspectorTitle}
              >
                {isMultiSelection ? (
                  <UiText
                    message={
                      isFrameSelection
                        ? "{count} artboards selected"
                        : "{count} layers selected"
                    }
                    values={{ count: selectionCount }}
                  />
                ) : (
                  inspectorTitle
                )}
              </strong>
            </div>
            {isFrameSelection ? (
              !pending && <FrameSelectionPanel studioCtx={studioCtx} />
            ) : isMultiSelection && focusedViewCtx ? (
              !pending && <MultiSelectionPanel viewCtx={focusedViewCtx} />
            ) : (
              <Tabs
                className="editor-inspector-tabs"
                activeKey={studioCtx.rightTabKey}
                // Selection can change the tab order without changing the active key.
                // Reset only the header so its indicator cannot reuse the old layout.
                renderTabBar={(tabBarProps, DefaultTabBar) => (
                  <DefaultTabBar
                    {...tabBarProps}
                    key={tabs.map((tab) => tab.key).join(",")}
                  />
                )}
                onChange={(tabKey) =>
                  studioCtx.switchRightTab(tabKey as RightTabKey)
                }
                destroyOnHidden
                items={tabs.map((tab) => ({
                  key: tab.key,
                  label: tab.name,
                  children: (
                    <div className="vlist-scrollable-descendant">
                      {tab.contents()}
                    </div>
                  ),
                }))}
              />
            )}
          </>
        )}
      </DevContainer>
    </SidePanelShell>,
  );
});
