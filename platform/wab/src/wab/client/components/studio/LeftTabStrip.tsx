import {
  EditorToolIcon,
  EditorToolRail,
} from "@/wab/client/components/studio/EditorToolRail";
import LeftTabButton from "@/wab/client/components/studio/LeftTabButton";
import { useEditorPopupStyles } from "@/wab/client/components/ui/layout-styles";
import { useTopFrameApi } from "@/wab/client/contexts/AppContexts";
import { useStudioCtx } from "@/wab/client/contexts/StudioContexts";
import { useI18n } from "@/wab/client/i18n";
import { DataTokenIcon } from "@/wab/client/icons";
import GearIcon from "@/wab/client/plasmic/plasmic_kit/PlasmicIcon__Gear";
import MixinIcon from "@/wab/client/plasmic/plasmic_kit/PlasmicIcon__Mixin";
import TreeIcon from "@/wab/client/plasmic/plasmic_kit/PlasmicIcon__Tree";
import ClocksvgIcon from "@/wab/client/plasmic/plasmic_kit_icons/icons/PlasmicIcon__ClockSvg";
import ComponentsvgIcon from "@/wab/client/plasmic/plasmic_kit_icons/icons/PlasmicIcon__ComponentSvg";
import ComponentssvgIcon from "@/wab/client/plasmic/plasmic_kit_icons/icons/PlasmicIcon__ComponentsSvg";
import DevicessvgIcon from "@/wab/client/plasmic/plasmic_kit_icons/icons/PlasmicIcon__DevicesSvg";
import DotsHorizontalCirclesvgIcon from "@/wab/client/plasmic/plasmic_kit_icons/icons/PlasmicIcon__DotsHorizontalCircleSvg";
import FigmasvgIcon from "@/wab/client/plasmic/plasmic_kit_icons/icons/PlasmicIcon__FigmaSvg";
import FontFamily2SvgIcon from "@/wab/client/plasmic/plasmic_kit_icons/icons/PlasmicIcon__FontFamily2Svg";
import KeyframesIcon from "@/wab/client/plasmic/plasmic_kit_icons/icons/PlasmicIcon__Keyframes";
import Paintbrush2SvgIcon from "@/wab/client/plasmic/plasmic_kit_icons/icons/PlasmicIcon__Paintbrush2Svg";
import PencilSvgIcon from "@/wab/client/plasmic/plasmic_kit_icons/icons/PlasmicIcon__PencilSvg";
import PhotosvgIcon from "@/wab/client/plasmic/plasmic_kit_icons/icons/PlasmicIcon__PhotoSvg";
import SearchSvgIcon from "@/wab/client/plasmic/plasmic_kit_icons/icons/PlasmicIcon__SearchSvg";
import SplitSvgIcon from "@/wab/client/plasmic/plasmic_kit_icons/icons/PlasmicIcon__SplitSvg";
import { DefaultLeftTabStripProps } from "@/wab/client/plasmic/plasmic_kit_left_pane/PlasmicLeftTabStrip";
import {
  selectIsCopilotChatOpen,
  selectLeftTabGroup,
  selectLeftTabKey,
  selectPanelsHidden,
  selectShowAddDrawer,
} from "@/wab/client/studio-ctx/left-panel-state";
import DiamondsIcon from "@/wab/client/plasmic/plasmic_kit_merge_flow/icons/PlasmicIcon__Diamonds";
import { TutorialEventsType } from "@/wab/client/tours/tutorials/tutorials-events";
import { spawn, unexpected } from "@/wab/shared/common";
import {
  LeftTabKey,
  LeftTabUiKey,
} from "@/wab/shared/ui-config-utils";
import { Scrollbar } from "@shiguang2/components/esm/scrollbar";
import { Popover } from "antd";
import * as React from "react";
import { ReactNode } from "react";
import { useStore } from "zustand";

interface LeftTabStripProps extends DefaultLeftTabStripProps {
  useVersionsCTA: boolean;
}

function loadPenImporter() { return import("@/wab/client/pen-importer/import-file"); }
function loadFigmaImporter() { return import("@/wab/client/figma-importer/import-file"); }

export interface NavMenuItem {
  type: "item";
  icon: ReactNode;
  label: string;
  tooltip?: string;
  tabKey?: LeftTabKey;
  cond?: boolean;
  href?: string;
  className?: string;
  onClick?: () => void;
  showAlert?: "showAlert" | "showYellowCircle" | undefined;
  isSelected?: boolean;
}

export interface NavMenuGroup {
  type: "group";
  icon: ReactNode;
  title: string;
  items: Record<string, NavMenuItem>;
}

// Tool selection updates these buttons independently of the library/menu rail.
const CanvasTools = React.memo(function CanvasTools() {
  const studioCtx = useStudioCtx();
  const { t } = useI18n();
  const tool = useStore(studioCtx.canvasToolStore, (state) => state);
  return (
    <>
      <LeftTabButton
        label={t("Select")}
        tooltip={t("Select")}
        icon={<EditorToolIcon tool="Select" />}
        isSelected={tool === "select"}
        onClick={() => {
          studioCtx.setCanvasTool("select");
          spawn(
            studioCtx.changeUnsafe(() => studioCtx.setShowAddDrawer(false)),
          );
        }}
      />
      <LeftTabButton
        label={t("Pan")}
        tooltip={t("Pan")}
        icon={<EditorToolIcon tool="Pan" />}
        isSelected={tool === "pan"}
        onClick={() => {
          studioCtx.setCanvasTool("pan");
          spawn(
            studioCtx.changeUnsafe(() => studioCtx.setShowAddDrawer(false)),
          );
        }}
      />
    </>
  );
});

const LeftTabStrip = React.memo(function LeftTabStrip(props: LeftTabStripProps) {
  const { t } = useI18n();
  const topFrameApi = useTopFrameApi();
  const { styles: popupStyles } = useEditorPopupStyles();
  const studioCtx = useStudioCtx();
  const libraryTab = useStore(studioCtx.libraryTabStore);
  const isLoggedIn = useStore(studioCtx.uiEnvironment.store, (state) => state.hasUserInfo);
  const contentEditorMode = useStore(studioCtx.uiEnvironment.store, (state) => state.contentEditorMode);
  const leftTabPermissions = useStore(studioCtx.uiEnvironment.store, (state) => state.leftTabPermissions);
  const canEditProject = useStore(studioCtx.uiEnvironment.store, (state) => state.canEditProject);
  const canViewLibraryImports = isLoggedIn && leftTabPermissions.imports !== "hidden";
  const globalContexts = React.useMemo(() => studioCtx.modelSnapshots.field(studioCtx.site, "globalContexts"), [studioCtx, studioCtx.modelSnapshots, studioCtx.site]);
  const hasGlobalContexts = useStore(globalContexts, (contexts) => contexts.length > 0);
  const subscribeChatConfig = React.useCallback((listener: () => void) => studioCtx.appCtx.subscribeUiEnvironmentInputs(listener), [studioCtx]);
  const getChatEnabled = React.useCallback(() => studioCtx.chatCopilotEnabled(), [studioCtx, canEditProject]);
  const chatEnabled = React.useSyncExternalStore(subscribeChatConfig, getChatEnabled, getChatEnabled);
  const figmaFileInputId = React.useId();
  const [importingFigma, setImportingFigma] = React.useState(false);
  const [importingPen, setImportingPen] = React.useState(false);
  const leftTabKey = useStore(
    studioCtx.leftPanelState.store,
    selectLeftTabKey,
  );
  const leftTabGroup = useStore(
    studioCtx.leftPanelState.store,
    selectLeftTabGroup,
  );
  const showAddDrawer = useStore(
    studioCtx.leftPanelState.store,
    selectShowAddDrawer,
  );
  const isCopilotChatOpen = useStore(
    studioCtx.leftPanelState.store,
    selectIsCopilotChatOpen,
  );
  const panelsHidden = useStore(
    studioCtx.leftPanelState.store,
    selectPanelsHidden,
  );
  const openGroup = leftTabGroup;
  const setOpenGroup = (group: string | undefined) =>
    studioCtx.setLeftTabGroup(group);
  React.useEffect(() => {
    if (!openGroup) {
      return;
    }
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        setOpenGroup(undefined);
        document
          .querySelector<HTMLButtonElement>(
            `button[data-test-tabkey="${openGroup}"]`,
          )
          ?.focus();
      }
    };
    document.addEventListener("keydown", close, true);
    return () => document.removeEventListener("keydown", close, true);
  }, [openGroup]);
  const missingUsedFonts = useStore(
    studioCtx.fontManager.store,
    (state) => state.missingUsedFonts,
  );

  const canViewTab = (tab: LeftTabUiKey) => leftTabPermissions[tab] !== "hidden";

  /*
  Outline

Issues

Assets
  Tokens
  Data Tokens
  Mixins
  Components
  Images

Settings
  Project Settings
  Custom Fonts
  Responsive Breakpoints
  Published Versions

More
  Splits
  Figma import

   */
  const mainGroups: Record<string, NavMenuGroup> = {
    assets: {
      type: "group",
      icon: <ComponentssvgIcon />,
      title: t("Assets"),
      items: {
        tokens: {
          type: "item",
          tabKey: "tokens",
          icon: <DiamondsIcon />,
          label: t("Style tokens"),
          cond: canViewTab("tokens"),
        },
        dataTokens: {
          type: "item",
          tabKey: "dataTokens",
          icon: <DataTokenIcon />,
          label: t("Data tokens"),
          cond: canViewTab("dataTokens"),
        },
        mixins: {
          type: "item",
          tabKey: "mixins",
          icon: <MixinIcon />,
          label: t("Style presets"),
          cond: canViewTab("mixins"),
        },
        animationSequences: {
          type: "item",
          tabKey: "animationSequences",
          icon: <KeyframesIcon />,
          label: t("Animations"),
          cond: canViewTab("animationSequences"),
        },
        components: {
          type: "item",
          tabKey: "components",
          icon: <ComponentsvgIcon />,
          label: t("Components"),
          cond: canViewTab("components"),
        },
        images: {
          type: "item",
          tabKey: "images",
          icon: <PhotosvgIcon />,
          label: t("Images and icons"),
          cond: canViewTab("images"),
        },
      },
    },
    settingsGroup: {
      type: "group",
      icon: <GearIcon />,
      title: t("Settings"),
      items: {
        settings: {
          type: "item",
          tabKey: "settings",
          icon: <GearIcon />,
          label: t("Project settings"),
          cond: hasGlobalContexts && canViewTab("settings"),
        },
        fonts: {
          type: "item",
          tabKey: "fonts",
          icon: <FontFamily2SvgIcon />,
          label: t("Custom fonts"),
          cond: canViewTab("fonts"),
          showAlert: missingUsedFonts.length > 0 ? "showAlert" : undefined,
        },
        responsiveness: {
          type: "item",
          tabKey: "responsiveness",
          icon: <DevicessvgIcon />,
          label: t("Responsive breakpoints"),
          cond: canViewTab("responsiveness"),
        },
        themes: {
          type: "item",
          tabKey: "themes",
          icon: <Paintbrush2SvgIcon />,
          label: t("Default styles theme"),
          cond: canViewTab("themes"),
        },
      },
    },
    more: {
      type: "group",
      icon: <DotsHorizontalCirclesvgIcon />,
      title: t("More"),
      items: {
        splits: {
          type: "item",
          tabKey: "splits",
          icon: <SplitSvgIcon />,
          label: t("Split content"),
          cond: isLoggedIn && canViewTab("splits"),
        },
        versions: {
          type: "item",
          tabKey: "versions",
          icon: <ClocksvgIcon />,
          label: t("Published versions"),
          cond: isLoggedIn && canViewTab("versions"),
          showAlert: props.useVersionsCTA ? "showYellowCircle" : undefined,
        },
        expressions: {
          type: "item",
          tabKey: "expressions",
          icon: <SearchSvgIcon />,
          label: t("Expressions"),
          cond: canViewTab("expressions"),
        },
        figma: {
          type: "item",
          icon: <FigmasvgIcon />,
          label: t("Import from Figma"),
          cond: canViewTab("figma"),
          onClick: () => {
            if (!importingFigma && !importingPen) {
              document.getElementById(figmaFileInputId)?.click();
            }
          },
        },
        pen: {
          type: "item",
          icon: <PencilSvgIcon />,
          label: t("Import from Pen"),
          cond: canViewTab("pen"),
          onClick: () => {
            if (importingFigma || importingPen) {
              return;
            }
            setImportingPen(true);
            spawn(
              (async () => {
                return await (async () => {
                  const { importPenFile } =
                    await loadPenImporter();
                  await importPenFile(studioCtx);
                })().finally(() => {
                  setImportingPen(false);
                });
              })(),
            );
          },
        },
      },
    },
  };
  const topMenu: Record<string, NavMenuItem | NavMenuGroup> = {
    outline: {
      type: "item",
      tabKey: "outline",
      icon: <TreeIcon />,
      label: t("Outline"),
    },
    lint: {
      type: "item",
      tabKey: "lint",
      icon: <EditorToolIcon tool="Issues" />,
      label: t("Issues"),
      tooltip: t("Issues detected"),
      cond: canViewTab("lint"),
    },
    ...(contentEditorMode
      ? {
          more: {
            ...mainGroups.more,
            items: Object.fromEntries(
              Object.entries(mainGroups).flatMap(([_groupKey, group]) =>
                Object.entries(group.items),
              ),
            ),
          },
        }
      : mainGroups),
  };
  function renderButton(
    key: string,
    item: NavMenuItem,
    hasLabel: boolean,
    onClick: (() => void) | undefined,
  ) {
    const isSelected =
      item.isSelected ??
      (item.tabKey &&
        item.tabKey === leftTabKey &&
        !showAddDrawer &&
        !panelsHidden);
    const isSubmenuItem = onClick != null;
    return (
      (item.cond ?? true) && (
        <LeftTabButton
          key={key}
          icon={item.icon}
          label={item.label}
          hasLabel={hasLabel}
          tooltip={item.tooltip ?? item.label}
          onClick={() =>
            studioCtx.changeUnsafe(() => {
              item.onClick?.();
              if (item.tabKey) {
                if (
                  !isSubmenuItem &&
                  isSelected &&
                  !studioCtx.showAddDrawer() &&
                  !studioCtx.panelsHidden
                ) {
                  studioCtx.switchLeftTab(undefined);
                } else {
                  studioCtx.switchLeftTab(item.tabKey);
                }
                if (studioCtx.panelsHidden) {
                  studioCtx.togglePanels();
                }
              }
              studioCtx.setShowAddDrawer(false);
              onClick?.();
            })
          }
          expanded={item.tabKey ? isSelected : undefined}
          data-test-tabkey={key}
          showAlert={item.showAlert}
          href={item.href}
          className={item.className}
          isSelected={isSelected}
        />
      )
    );
  }

  const renderButtonGroup = (buttons: typeof topMenu) => {
    return Object.entries(buttons).map(([key, item]) =>
      item.type === "item"
        ? renderButton(key, item, true, undefined)
        : item.type === "group"
          ? Object.values(item.items).some((i) => i.cond ?? true) && (
              <Popover
                arrow={false}
                key={key}
                trigger="click"
                placement={"right"}
                align={{ offset: [8, 0] }}
                overlayClassName={"sidebar-popover"}
                zIndex={1100}
                open={openGroup === key}
                onOpenChange={(open) => {
                  if (open) {
                    setOpenGroup(key);
                  } else if (studioCtx.leftTabGroup === key) {
                    setOpenGroup(undefined);
                  }
                }}
                content={
                  <Scrollbar
                    scrollX={false}
                    className={popupStyles.root}
                    style={{
                      minWidth: 200,
                      maxHeight: "calc(100vh - 120px)",
                    }}
                  >
                    <div
                      className="editor-management-menu"
                      style={{ borderTop: 0, paddingTop: 0 }}
                    >
                      {Object.entries(item.items).map(([subkey, subitem]) =>
                        renderButton(subkey, subitem, true, () =>
                          setOpenGroup(undefined),
                        ),
                      )}
                    </div>
                  </Scrollbar>
                }
              >
                <span style={{ display: "inline-flex" }}>
                  <LeftTabButton
                    icon={item.icon}
                    label={item.title}
                    tooltip={item.title}
                    data-test-tabkey={key}
                    expanded={openGroup === key}
                    isSelected={
                      openGroup === key ||
                      (!showAddDrawer &&
                        !panelsHidden &&
                        Object.values(item.items).some(
                          (i) =>
                            i.isSelected ??
                            (!!i.tabKey && i.tabKey === leftTabKey),
                        ))
                    }
                  />
                </span>
              </Popover>
            )
          : unexpected(),
    );
  };

  const resourceItems = {
    ...mainGroups.assets.items,
    fonts: mainGroups.settingsGroup.items.fonts,
    responsiveness: mainGroups.settingsGroup.items.responsiveness,
    themes: mainGroups.settingsGroup.items.themes,
  };
  return (
    <EditorToolRail
      onOpenWebBrowser={() => spawn(topFrameApi.openDesktopBrowser())}
      showAvatar={false}
      insert={{ render: () => null }}
      root={{ className: props.className, id: "left-tab-strip" }}
      buttons={
        <>
          <input
            id={figmaFileInputId}
            type="file"
            accept=".fig"
            hidden
            aria-label={t("Import from Figma")}
            onChange={(event) => {
              const file = event.currentTarget.files?.[0];
              event.currentTarget.value = "";
              if (!file || importingFigma || importingPen) {
                return;
              }
              setImportingFigma(true);
              spawn(
                (async () => {
                  return await (async () => {
                    const { importFigmaFile } =
                      await loadFigmaImporter();
                    await importFigmaFile(studioCtx, file);
                  })().finally(() => {
                    setImportingFigma(false);
                  });
                })(),
              );
            }}
          />

          <CanvasTools />
          <div className="editor-rail-divider" role="separator" />
          <LeftTabButton
            dataTestId="add-button"
            expanded={showAddDrawer}
            isSelected={showAddDrawer}
            label={t("Insert")}
            tooltip={t("Insert")}
            icon={<EditorToolIcon tool="Insert" />}
            onClick={() => {
              studioCtx.setCanvasTool("select");
              studioCtx.tourActionEvents.dispatch({
                type: TutorialEventsType.AddButtonClicked,
              });
              spawn(
                studioCtx.changeUnsafe(() =>
                  studioCtx.setShowAddDrawer(!studioCtx.showAddDrawer()),
                ),
              );
            }}
          />
          <LeftTabButton
            isSelected={
              leftTabKey === "outline" && !showAddDrawer
            }
            label={t("Layers")}
            tooltip={t("Layers")}
            icon={<EditorToolIcon tool="Layers" />}
            onClick={() => {
              studioCtx.showLayersPanel();
            }}
          />
          {renderButtonGroup({
            assets: {
              ...mainGroups.assets,
              icon: <EditorToolIcon tool="Assets" />,
              items: resourceItems,
            },
          })}
          {canViewTab("libraries") &&
            (() => {
              const canViewImports = canViewLibraryImports;
              const isLibrariesOpen =
                leftTabKey === "libraries" &&
                !showAddDrawer &&
                !panelsHidden;
              const isImportsActive =
                isLibrariesOpen &&
                canViewImports &&
                libraryTab === "imports";
              const isStoreActive = isLibrariesOpen && !isImportsActive;
              return renderButtonGroup({
                libraries: {
                  type: "group",
                  icon: <EditorToolIcon tool="Libraries" />,
                  title: t("Libraries"),
                  items: {
                    store: {
                      type: "item",
                      tabKey: "libraries",
                      icon: <ComponentsvgIcon />,
                      label: t("Component store"),
                      isSelected: isStoreActive,
                      onClick: () => studioCtx.setLibraryTab("store"),
                    },
                    imports: {
                      type: "item",
                      tabKey: "libraries",
                      icon: <ComponentssvgIcon />,
                      label: t("Imported projects"),
                      cond: canViewImports,
                      isSelected: isImportsActive,
                      onClick: () => studioCtx.setLibraryTab("imports"),
                    },
                  },
                },
              });
            })()}
          <LeftTabButton
            label={t("AI")}
            tooltip={t("AI assistant")}
            icon={<EditorToolIcon tool="AI" />}
            disabled={!chatEnabled}
            isSelected={isCopilotChatOpen}
            onClick={() => {
              if (studioCtx.chatCopilotEnabled()) {
                setOpenGroup(undefined);
                studioCtx.toggleCopilotChat();
              }
            }}
          />
          <div className="editor-rail-divider" role="separator" />
          {topMenu.lint.type === "item" &&
            renderButton("lint", topMenu.lint, false, undefined)}
        </>
      }
      moreButton={renderButtonGroup({
        more: {
          ...mainGroups.more,
          icon: <EditorToolIcon tool="More" />,
          items: {
            settings: mainGroups.settingsGroup.items.settings,
            splits: mainGroups.more.items.splits,
            expressions: mainGroups.more.items.expressions,
            figma: mainGroups.more.items.figma,
            pen: mainGroups.more.items.pen,
          },
        },
      })}
      bottomButtons={null}
      players={{ render: () => null }}
      avatar={{ render: () => null }}
      divider={{ render: () => null }}
      figma={{ render: () => null }}
      keyboard={{ render: () => null }}
    />
  );
});

export default LeftTabStrip;
