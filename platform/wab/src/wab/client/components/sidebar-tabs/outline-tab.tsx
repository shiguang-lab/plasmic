import { OutlineCtx } from "@/wab/client/components/sidebar-tabs/OutlineCtx";
import styles from "@/wab/client/components/sidebar-tabs/outline-tab.module.scss";
import {
  ArenaTree,
  ArenaTreeRef,
  TreeDndManager,
} from "@/wab/client/components/sidebar-tabs/tpl-tree";
import { IFrameAwareDropdownMenu } from "@/wab/client/components/widgets";
import { Icon } from "@/wab/client/components/widgets/Icon";
import { useToggleDisplayed } from "@/wab/client/dom-utils";
import { useI18n } from "@/wab/client/i18n";
import ChevronDownsvgIcon from "@/wab/client/plasmic/plasmic_kit_icons/icons/PlasmicIcon__ChevronDownSvg";
import PlasmicOutlineTab from "@/wab/client/plasmic/plasmic_kit_project_panel/PlasmicOutlineTab";
import PlasmicSearchInput from "@/wab/client/plasmic/plasmic_kit_project_panel/PlasmicSearchInput";
import { useStudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import {
  getArenaFrameDesc,
  getArenaFrames,
  getArenaName,
  isComponentArena,
  isMixedArena,
  isPageArena,
} from "@/wab/shared/Arenas";
import { getDisplayVariants } from "@/wab/shared/Variants";
import { ensure, switchType } from "@/wab/shared/common";
import { getComponentArenaRowLabel } from "@/wab/shared/component-arenas";
import { ArenaFrame, ComponentArena } from "@/wab/shared/model/classes";
import { Button, Menu } from "antd";
import { observer } from "mobx-react";
import * as React from "react";

export const OutlineTab = observer(OutlineTab_);

function OutlineTab_() {
  const { t: uiT } = useI18n();
  const studioCtx = useStudioCtx();
  const dndManager = React.useMemo(
    () => new TreeDndManager(studioCtx),
    [studioCtx],
  );

  const outlineCtx = React.useMemo(
    () => new OutlineCtx(studioCtx, ""),
    [studioCtx],
  );
  React.useEffect(() => {
    return () => {
      outlineCtx.dispose();
    };
  }, [outlineCtx]);

  const ref = React.useRef<HTMLDivElement>(null);
  const treeRef = React.useRef<ArenaTreeRef>(null);
  const onVisible = React.useCallback((visible: boolean) => {
    if (treeRef.current && visible) {
      // Recompute tree when outline tab is visible again, to fix issues
      // with occasional blank space when switching back to this tab.
      treeRef.current.forceUpdate();
    }
  }, []);
  useToggleDisplayed(ref, onVisible);
  const arena = studioCtx.currentArena;

  const currentArenaFrame = outlineCtx.viewCtx()?.arenaFrame();

  const arenaFrameGroups: {
    groupLabel?: string;
    frames: ArenaFrame[];
    alwaysShowGroupLabel?: boolean;
  }[] = switchType(arena)
    .when(ComponentArena, (it) => [
      ...it.matrix.rows.map((row) => ({
        groupLabel: getComponentArenaRowLabel(it.component, row),
        frames: row.cols.map((col) => col.frame),
      })),
      {
        alwaysShowGroupLabel: true,
        groupLabel: "Combinations",
        frames: it.customMatrix.rows[0]?.cols.map((col) => col.frame),
      },
    ])
    .elseUnsafe(() => [{ frames: getArenaFrames(arena) }]);

  const query = outlineCtx.query;
  const frameLabel = (frame: ArenaFrame) => {
    if (!isPageArena(arena)) {
      return getArenaFrameDesc(
        ensure(arena, "Expected current arena"),
        frame,
        studioCtx.site,
      );
    }
    const variants = getDisplayVariants({
      site: studioCtx.site,
      frame,
      isPageArena: true,
    })
      .map((variant) => variant.displayName)
      .join(" + ");
    return `${getArenaName(arena)} · ${frame.width} × ${frame.height}${variants ? ` · ${variants}` : ""}`;
  };

  return (
    <PlasmicOutlineTab
      headerFilter={{
        wrap: () =>
          arena ? (
            <IFrameAwareDropdownMenu
              menu={() => (
                <Menu
                  selectedKeys={
                    currentArenaFrame &&
                    (!isMixedArena(arena) || studioCtx.canvasFocusActive)
                      ? [currentArenaFrame.uuid]
                      : ["overview"]
                  }
                >
                  <Menu.Item
                    key="documents"
                    onClick={studioCtx.showProjectPanel}
                  >
                    {uiT("Documents")}
                  </Menu.Item>
                  <Menu.Item
                    key="overview"
                    disabled={
                      isMixedArena(arena)
                        ? studioCtx.currentArenaEmpty
                        : !studioCtx.canOpenPageOverview
                    }
                    onClick={() => {
                      if (isMixedArena(arena)) {
                        studioCtx.returnToCanvasOverview();
                        studioCtx.tryZoomToFitArena();
                      } else {
                        void studioCtx.openPageOverview();
                      }
                    }}
                  >
                    {uiT(
                      isMixedArena(arena)
                        ? "Return to overview"
                        : "Pages overview",
                    )}
                  </Menu.Item>
                  <Menu.Divider />
                  {arenaFrameGroups
                    .filter((it) => it.frames.length)
                    .map((group) => {
                      const items = group.frames.map((frame) => (
                        <Menu.Item
                          key={frame.uuid}
                          onClick={() =>
                            isMixedArena(arena)
                              ? studioCtx.focusCanvasFrame(frame)
                              : studioCtx.changeUnsafe(() =>
                                  studioCtx.setStudioFocusOnFrame({
                                    frame,
                                    autoZoom: true,
                                  }),
                                )
                          }
                        >
                          {frameLabel(frame)}
                        </Menu.Item>
                      ));

                      const shouldShowGroupLabel =
                        group.groupLabel &&
                        (group.frames.length > 1 || group.alwaysShowGroupLabel);

                      return shouldShowGroupLabel ? (
                        <Menu.ItemGroup
                          key={group.groupLabel}
                          title={
                            <span className={styles.framesMenuGroupLabel}>
                              {group.groupLabel}
                            </span>
                          }
                        >
                          {items}
                        </Menu.ItemGroup>
                      ) : (
                        <React.Fragment key={0}>{items}</React.Fragment>
                      );
                    })}
                </Menu>
              )}
            >
              <Button
                type="text"
                size="small"
                data-test-id="elements-panel--current-frame"
                className={styles.currentFrame}
              >
                {currentArenaFrame &&
                (!isMixedArena(arena) || studioCtx.canvasFocusActive) ? (
                  <strong>{frameLabel(currentArenaFrame)}</strong>
                ) : (
                  <div>{getArenaName(arena)}</div>
                )}
                {arenaFrameGroups.some((groups) => groups.frames.length) && (
                  <Icon monochromeExempt icon={ChevronDownsvgIcon} />
                )}
              </Button>
            </IFrameAwareDropdownMenu>
          ) : (
            <div style={{ height: 8 }} />
          ),
      }}
      searchInput={{
        wrap: () => (
          <PlasmicSearchInput
            overrides={{
              searchInput: {
                value: query,
                placeholder: uiT("Search…"),
                "aria-label": uiT("Search"),
                onChange: (e) => outlineCtx.setQuery(e.target.value),
                onKeyUp: (e) => {
                  if (e.key === "Escape") {
                    outlineCtx.clearQuery();
                  }
                },
              },
              clearFieldIcon: {
                style: { display: query ? "block" : "none" },
                onClick: () => outlineCtx.clearQuery(),
              },
            }}
          />
        ),
      }}
      expandAllButton={{
        "aria-label": uiT("Expand all"),
        title: uiT("Expand all"),
        onClick: () => outlineCtx.expandAll(),
      }}
      collapseAllButton={{
        "aria-label": uiT("Collapse all"),
        title: uiT("Collapse all"),
        onClick: () => outlineCtx.collapseAll(),
      }}
    >
      <div
        className="tpltree__root flex-fill rel fill-width fill-height flex-child-min"
        onDragOver={(e) => {
          // We must cancel the onDragOver event to be considered a drop target.
          e.preventDefault();
        }}
        onDrop={(e) => {
          // In case the user drops on the tree panel instead of a tree node,
          // we inform the TreeDndManager to execute the drop anyway.
          dndManager.onDrop(e);
        }}
      >
        {arena && (
          <ArenaTree
            // We reset the ArenaTree whenever we switch Arena to work around
            // an issue with FixedSizeTree, where whenever we pass in a new treeWalker,
            // we end up walking the tree twice for each update.
            key={arena?.uid}
            studioCtx={studioCtx}
            arena={arena}
            outlineCtx={outlineCtx}
            dndManager={dndManager}
            ref={treeRef}
          />
        )}
      </div>
    </PlasmicOutlineTab>
  );
}
