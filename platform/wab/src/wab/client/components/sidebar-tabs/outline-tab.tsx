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
import { useStudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import {
  getArenaFrameDesc,
  getArenaFrames,
  getArenaName,
  isMixedArena,
  isPageArena,
} from "@/wab/shared/Arenas";
import { getDisplayVariants } from "@/wab/shared/Variants";
import { ensure, switchType } from "@/wab/shared/common";
import { getComponentArenaRowLabel } from "@/wab/shared/component-arenas";
import { ArenaFrame, ComponentArena } from "@/wab/shared/model/classes";
import { frameSizeGroups } from "@/wab/shared/responsiveness";
import { Button, Menu } from "antd";
import { observer } from "mobx-react";
import * as React from "react";
import {
  FiArrowUpLeft,
  FiChevronDown,
  FiChevronRight,
  FiHash,
  FiLayers,
} from "react-icons/fi";

export const OutlineTab = observer(OutlineTab_);

function OutlineTab_() {
  const { t: uiT, label: uiLabel } = useI18n();
  const studioCtx = useStudioCtx();
  const { styles: panelStyles } = useStructurePanelStyles();
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

  const mixed = isMixedArena(arena);
  const page = isPageArena(arena);
  const focused = studioCtx.canvasFocusActive;
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
  const frames = arenaFrameGroups.flatMap((group) => group.frames ?? []);
  const frameSelected = (frame: ArenaFrame) => frame === currentArenaFrame;
  const selectFrame = (frame: ArenaFrame) => {
    if (page) {
      outlineCtx.setFrameExpanded(frame, true);
    }
    void studioCtx.changeUnsafe(() =>
      studioCtx.setStudioFocusOnFrame({ frame, autoZoom: !mixed }),
    );
  };
  const frameChoices =
    frames.length > 4 &&
    currentArenaFrame &&
    !frames.slice(0, 4).includes(currentArenaFrame)
      ? [...frames.slice(0, 3), currentArenaFrame]
      : frames.slice(0, 4);
  const frameDevice = (frame: ArenaFrame) => {
    const preset = frameSizeGroups.find((group) =>
      group.sizes.some(
        ({ width, height }) =>
          (width === frame.width && height === frame.height) ||
          (height === frame.width && width === frame.height),
      ),
    )?.groupName;
    return preset === "Phone"
      ? "Mobile"
      : (preset ??
          (frame.width <= 640
            ? "Mobile"
            : frame.width < 1024
              ? "Tablet"
              : "Desktop"));
  };
  const device = currentArenaFrame ? frameDevice(currentArenaFrame) : undefined;
  const pageExpanded =
    !page ||
    !currentArenaFrame ||
    outlineCtx.isFrameExpanded(currentArenaFrame, true);
  const footerText =
    focused && arena && currentArenaFrame
      ? uiT("Focused in arena · {name}", {
          name: mixed ? frameLabel(currentArenaFrame) : getArenaName(arena),
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
            <span className={panelStyles.scopeName} title={getArenaName(arena)}>
              {getArenaName(arena)}
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
                      disabled={!studioCtx.canOpenPageOverview}
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
                        const items = group.frames.map((frame) => (
                          <Menu.Item
                            key={frame.uuid}
                            onClick={() => selectFrame(frame)}
                          >
                            {frameLabel(frame)}
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
              {page ? uiLabel(frameDevice(frame)) : frameLabel(frame)}
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
              {getArenaName(arena)} ·{" "}
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
