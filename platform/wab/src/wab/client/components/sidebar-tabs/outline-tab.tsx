import { useStudioSelection } from "@/wab/client/studio-ctx/selection-state";
import { useStudioArena, useViewRegistry } from "@/wab/client/studio-ctx/arena-state";
import { useCanvasOverviewArena } from "@/wab/client/studio-ctx/canvas-overview-state";
import { OutlineCtx } from "@/wab/client/components/sidebar-tabs/OutlineCtx";
import styles from "@/wab/client/components/sidebar-tabs/outline-tab.module.scss";
import {
  ArenaTree,
  ArenaTreeRef,
  TreeDndManager,
} from "@/wab/client/components/sidebar-tabs/tpl-tree";
import { useStructurePanelStyles } from "@/wab/client/components/studio/StructurePanel.styles";
import { IFrameAwareDropdownMenu } from "@/wab/client/components/widgets";
import { Icon } from "@/wab/client/components/widgets/Icon";
import { ListStack } from "@/wab/client/components/widgets/ListStack";
import { useToggleDisplayed } from "@/wab/client/dom-utils";
import { useI18n } from "@/wab/client/i18n";
import ComponentIcon from "@/wab/client/plasmic/plasmic_kit/PlasmicIcon__Component";
import MixedArenaIcon from "@/wab/client/plasmic/plasmic_kit_design_system/icons/PlasmicIcon__MixedArena";
import PageIcon from "@/wab/client/plasmic/plasmic_kit_design_system/icons/PlasmicIcon__Page";
import ChevronDownsvgIcon from "@/wab/client/plasmic/plasmic_kit_icons/icons/PlasmicIcon__ChevronDownSvg";
import { useStudioCtx } from "@/wab/client/contexts/StudioContexts";
import { useStudioSaveState } from "@/wab/client/studio-ctx/save-state";
import {
  getArenaFrames,
  isMixedArena,
  isPageArena,
} from "@/wab/shared/Arenas";
import { ensure } from "@/wab/shared/common";
import { ArenaFrame } from "@/wab/shared/model/classes";
import { Button, Menu } from "antd";
import { useStore } from "zustand";
import { useCanvasComponentValue, type CanvasViewFieldRecipe } from "@/wab/client/components/canvas/canvas-view-inputs";
import { outlineTabFields, outlineTabPresentation } from "@/wab/client/components/sidebar-tabs/outline-tab-inputs";
import * as React from "react";
import {
  FiArrowUpLeft,
  FiChevronDown,
  FiChevronRight,
  FiHash,
  FiLayers,
} from "react-icons/fi";

export const OutlineTab = React.memo(OutlineTab_);

function OutlineTab_() {
  const { t: uiT, label: uiLabel } = useI18n();
  const studioCtx = useStudioCtx();
  useStore(studioCtx.uiEnvironment.store, (state) => state.contentEditorMode);
  const world = studioCtx.arenaState.lifetime();
  // Subscribe precisely to save permission so the overview menu re-evaluates
  // when it changes; the unique overview policy stays in StudioCtx.
  const canOpenPageOverview = useStudioSaveState(studioCtx, () => studioCtx.canOpenPageOverview);
  const { styles: panelStyles } = useStructurePanelStyles();
  const dndManager = React.useMemo(
    () => new TreeDndManager(studioCtx),
    [studioCtx, world],
  );

  const outlineCtx = React.useMemo(
    () => new OutlineCtx(studioCtx, ""),
    [studioCtx, world],
  );
  const expandedFrames = useStore(outlineCtx.stateStore, (state) => state.expandedFrames);
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
  const arena = useStudioArena(studioCtx, (state) => state.current ? studioCtx.modelSnapshots.resolve(state.current) : null);
  // The outline tree uses the current ViewCtx command owner; a roster change
  // must rebuild the rows without converting the whole outline state to UI data.
  const selectedFrame = useStudioSelection(studioCtx, (state) => {
    const frame = state.view?.arenaFrame() ?? (state.frames[0] ? studioCtx.modelSnapshots.resolve(state.frames[0]) : undefined);
    return frame && getArenaFrames(arena).includes(frame) ? frame : undefined;
  });
  const fallbackFrame = useViewRegistry(studioCtx, () => outlineCtx.viewCtx()?.arenaFrame());
  const overviewArena = useCanvasOverviewArena(studioCtx);
  const metadataRecipe = React.useCallback<CanvasViewFieldRecipe>((field) => outlineTabFields(studioCtx.site, arena, field), [studioCtx, arena]);
  const readMetadata = React.useCallback(() => outlineTabPresentation(studioCtx.site, arena), [studioCtx, arena]);
  const metadata = useCanvasComponentValue(studioCtx, arena ?? studioCtx.site, metadataRecipe, readMetadata);
  if (!metadata) { return null; }
  const currentArenaFrame = selectedFrame ?? fallbackFrame;
  const arenaFrameGroups = metadata.groups;
  const frameLabel = (frame: ArenaFrame) => metadata.groups.flatMap((group) => group.frames).find((row) => row.frame === frame)?.label ?? "";

  const mixed = isMixedArena(arena);
  const page = isPageArena(arena);
  const focused = overviewArena === arena;
  const kind = mixed
    ? uiT("Arena")
    : isPageArena(arena)
      ? uiT("Page")
      : uiT("Component");
  const ArenaIcon = mixed
    ? MixedArenaIcon
    : isPageArena(arena)
      ? PageIcon
      : ComponentIcon;
  const frames = arenaFrameGroups.flatMap((group) => group.frames.map((row) => row.frame));
  const frameSelected = (frame: ArenaFrame) => frame === currentArenaFrame;
  const selectFrame = (frame: ArenaFrame) => {
    if (!studioCtx.arenaState.isCurrentLifetime(world)) { return; }
    if (page) {
      outlineCtx.setFrameExpanded(frame, true);
    }
    void studioCtx.changeUnsafe(() => {
      if (studioCtx.arenaState.isCurrentLifetime(world)) { studioCtx.setStudioFocusOnFrame({ frame, autoZoom: !mixed }); }
    });
  };
  const frameChoices =
    frames.length > 4 &&
    currentArenaFrame &&
    !frames.slice(0, 4).includes(currentArenaFrame)
      ? [...frames.slice(0, 3), currentArenaFrame]
      : frames.slice(0, 4);
  const frameDevice = (frame: ArenaFrame) => metadata.groups.flatMap((group) => group.frames).find((row) => row.frame === frame)?.device;
  const device = currentArenaFrame ? frameDevice(currentArenaFrame) : undefined;
  const pageExpanded =
    !page ||
    !currentArenaFrame ||
    (expandedFrames.get(currentArenaFrame) ?? true);
  const footerText =
    focused && arena && currentArenaFrame
      ? uiT("Focused in arena · {name}", {
          name: mixed ? frameLabel(currentArenaFrame) : metadata.arenaName,
        })
      : mixed
        ? uiT("Arena · {count} artboards", { count: frames.length })
        : currentArenaFrame
          ? uiT(
              isPageArena(arena)
                ? "Page editing · {device}"
                : "Component editing · {device}",
              { device: uiLabel(ensure(device, "Current frame device")) },
            )
          : kind;
  const tree = (
    <div
      className="tpltree__root flex-fill rel fill-width fill-height flex-child-min"
      onDragOver={(e) => {
        // We must cancel the onDragOver event to be considered a drop target.
        e.preventDefault();
      }}
      onDrop={(e) => {
        // In case the user drops on the tree panel instead of a tree node,
        // we inform the TreeDndManager to execute the drop anyway.
        if (studioCtx.arenaState.isCurrentLifetime(world)) { dndManager.onDrop(e); }
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
  );

  return (
    <div className={panelStyles.section} ref={ref}>
      <div className={panelStyles.sectionHeader}>
        <strong>{uiT("Layers")}</strong>
        <div className={panelStyles.actions}>
          <Button
            type="text"
            className={panelStyles.iconButton}
            aria-label={uiT("Collapse all")}
            title={uiT("Collapse all")}
            icon={<FiLayers size={14} />}
            disabled={mixed ? frames.length === 0 : !currentArenaFrame}
            onClick={() => {
              outlineCtx.collapseAll();
              if (page && currentArenaFrame) {
                outlineCtx.setFrameExpanded(currentArenaFrame, false);
              }
            }}
          />
        </div>
      </div>
      {arena && (
        <div className={panelStyles.layerContext}>
          <div className={panelStyles.scopeCard}>
            <Icon icon={ArenaIcon} />
            <span className={panelStyles.scopeName} title={metadata.arenaName}>
              {metadata.arenaName}
            </span>
            <span className={panelStyles.scopeKind}>{kind}</span>
          </div>
          {!mixed && !page && (
            <div className={panelStyles.contextLine}>
              <IFrameAwareDropdownMenu
                menu={() => (
                  <Menu
                    selectedKeys={
                      currentArenaFrame
                        ? [currentArenaFrame.uuid]
                        : ["overview"]
                    }
                  >
                    <Menu.Item
                      key="overview"
                      disabled={!canOpenPageOverview}
                      onClick={() => {
                        void studioCtx.openPageOverview();
                      }}
                    >
                      {uiT("Pages overview")}
                    </Menu.Item>
                    <Menu.Divider />
                    {arenaFrameGroups
                      .filter((it) => it.frames.length)
                      .map((group) => {
                        const items = group.frames.map(({ frame, label }) => (
                          <Menu.Item
                            key={frame.uuid}
                            onClick={() => selectFrame(frame)}
                          >
                            {label}
                          </Menu.Item>
                        ));

                        const shouldShowGroupLabel =
                          group.groupLabel &&
                          (group.frames.length > 1 ||
                            group.alwaysShowGroupLabel);

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
                  <Icon monochromeExempt icon={ChevronDownsvgIcon} />
                  <FiHash size={14} />
                  <span className={panelStyles.scopeName}>
                    {currentArenaFrame
                      ? frameLabel(currentArenaFrame)
                      : uiT("Artboard")}
                  </span>
                </Button>
              </IFrameAwareDropdownMenu>
            </div>
          )}
          {focused && (
            <Button
              type="link"
              className={panelStyles.back}
              onClick={studioCtx.returnToCanvasOverview}
            >
              <FiArrowUpLeft size={12} />
              {uiT("Return to overview")}
            </Button>
          )}
        </div>
      )}
      {!mixed && (page || frames.length > 1) && (
        <div className={panelStyles.frames}>
          {(page ? frames : frameChoices).map((frame) => (
            <Button
              key={frame.uuid}
              className={panelStyles.frame}
              aria-pressed={frameSelected(frame)}
              title={frameLabel(frame)}
              onClick={() => selectFrame(frame)}
            >
              {page ? uiLabel(ensure(frameDevice(frame), "Frame device")) : frameLabel(frame)}
            </Button>
          ))}
        </div>
      )}
      {page && arena && currentArenaFrame && (
        <div className={panelStyles.frames}>
          <Button
            type="text"
            size="small"
            className={styles.currentFrame}
            data-test-id="elements-panel--page-frame"
            aria-expanded={pageExpanded}
            onClick={() =>
              outlineCtx.setFrameExpanded(currentArenaFrame, !pageExpanded)
            }
          >
            {pageExpanded ? (
              <FiChevronDown size={14} />
            ) : (
              <FiChevronRight size={14} />
            )}
            <FiHash size={14} />
            <span className={panelStyles.scopeName}>
              {metadata.arenaName} ·{" "}
              {uiLabel(ensure(device, "Current page device"))}
            </span>
          </Button>
        </div>
      )}
      <ListStack className={panelStyles.tree}>
        {!page || pageExpanded ? tree : null}
      </ListStack>
      {arena && (
        <div className={panelStyles.footer}>
          <span className={panelStyles.statusDot} />
          <span className={panelStyles.scopeName}>{footerText}</span>
        </div>
      )}
    </div>
  );
}
