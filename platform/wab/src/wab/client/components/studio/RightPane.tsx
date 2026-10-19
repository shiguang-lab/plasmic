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
import { isTplComponent, summarizeTpl } from "@/wab/shared/core/tpls";
import { isKnownTplTag } from "@/wab/shared/model/classes";
import { Tabs } from "antd";
import cx from "classnames";
import { observer } from "mobx-react";
import React from "react";

export const RightPane = observer(function RightPane({
  studioCtx,
  canvasLoading,
}: {
  studioCtx: StudioCtx;
  canvasLoading: boolean;
}) {
  const [hover, setHover] = React.useState(false);

  const focusedViewCtx = studioCtx.focusedViewCtx();
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

  const inspectorTitle =
    studioCtx.rightTabKey === RightTabKey.component
      ? focusedOrFirstViewCtx?.component.name
      : selectionTitle;

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
          !studioCtx.isSelectionPending && <ComponentOrPageTab
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
    studioCtx.showDevControls &&
    !studioCtx.panelsHidden &&
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
              !studioCtx.isSelectionPending && <FrameSelectionPanel studioCtx={studioCtx} />
            ) : isMultiSelection && focusedViewCtx ? (
              !studioCtx.isSelectionPending && <MultiSelectionPanel viewCtx={focusedViewCtx} />
            ) : (
              <Tabs
                className="editor-inspector-tabs"
                activeKey={studioCtx.rightTabKey}
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
