import { useEditorPopupStyles } from "@/wab/client/components/ui/layout-styles";
import { useTopFrameApi } from "@/wab/client/contexts/AppContexts";
import { useI18n } from "@/wab/client/i18n";
// eslint-disable-next-line no-restricted-imports
import { showTemporaryInfo } from "@/wab/client/components/quick-modals";
import { FigmaModalContent } from "@/wab/client/components/studio/FigmaModalContent";
import LeftTabButton from "@/wab/client/components/studio/LeftTabButton";
import { useOnIFrameMouseDown } from "@/wab/client/components/widgets";
import { DataTokenIcon } from "@/wab/client/icons";
import GearIcon from "@/wab/client/plasmic/plasmic_kit/PlasmicIcon__Gear";
import MixinIcon from "@/wab/client/plasmic/plasmic_kit/PlasmicIcon__Mixin";
import TreeIcon from "@/wab/client/plasmic/plasmic_kit/PlasmicIcon__Tree";
import ClocksvgIcon from "@/wab/client/plasmic/plasmic_kit_icons/icons/PlasmicIcon__ClockSvg";
import ComponentsvgIcon from "@/wab/client/plasmic/plasmic_kit_icons/icons/PlasmicIcon__ComponentSvg";
import ComponentssvgIcon from "@/wab/client/plasmic/plasmic_kit_icons/icons/PlasmicIcon__ComponentsSvg";
import DevicessvgIcon from "@/wab/client/plasmic/plasmic_kit_icons/icons/PlasmicIcon__DevicesSvg";
import DotsHorizontalCirclesvgIcon from "@/wab/client/plasmic/plasmic_kit_icons/icons/PlasmicIcon__DotsHorizontalCircleSvg";
import DownloadsvgIcon from "@/wab/client/plasmic/plasmic_kit_icons/icons/PlasmicIcon__DownloadSvg";
import FigmasvgIcon from "@/wab/client/plasmic/plasmic_kit_icons/icons/PlasmicIcon__FigmaSvg";
import FontFamily2SvgIcon from "@/wab/client/plasmic/plasmic_kit_icons/icons/PlasmicIcon__FontFamily2Svg";
import KeyframesIcon from "@/wab/client/plasmic/plasmic_kit_icons/icons/PlasmicIcon__Keyframes";
import Paintbrush2SvgIcon from "@/wab/client/plasmic/plasmic_kit_icons/icons/PlasmicIcon__Paintbrush2Svg";
import PhotosvgIcon from "@/wab/client/plasmic/plasmic_kit_icons/icons/PlasmicIcon__PhotoSvg";
import SearchSvgIcon from "@/wab/client/plasmic/plasmic_kit_icons/icons/PlasmicIcon__SearchSvg";
import SplitSvgIcon from "@/wab/client/plasmic/plasmic_kit_icons/icons/PlasmicIcon__SplitSvg";
import WarningTrianglesvgIcon from "@/wab/client/plasmic/plasmic_kit_icons/icons/PlasmicIcon__WarningTriangleSvg";
import {
  DefaultLeftTabStripProps,
  PlasmicLeftTabStrip,
} from "@/wab/client/plasmic/plasmic_kit_left_pane/PlasmicLeftTabStrip";
import DiamondsIcon from "@/wab/client/plasmic/plasmic_kit_merge_flow/icons/PlasmicIcon__Diamonds";
import { useStudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { TutorialEventsType } from "@/wab/client/tours/tutorials/tutorials-events";
import { spawn, unexpected } from "@/wab/shared/common";
import {
  LeftTabKey,
  LeftTabUiKey,
  getLeftTabPermission,
} from "@/wab/shared/ui-config-utils";
import { Popover } from "antd";
import { observer } from "mobx-react";
import * as React from "react";
import { ReactNode } from "react";

const toolIcon = (path: string) => (
  <svg
    width={20}
    height={20}
    viewBox="0 0 24 24"
    aria-hidden="true"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.6}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d={path} />
  </svg>
);

interface LeftTabStripProps extends DefaultLeftTabStripProps {
  useVersionsCTA: boolean;
  managementOnly?: boolean;
  onNavigate?: () => void;
}

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
}

export interface NavMenuGroup {
  type: "group";
  icon: ReactNode;
  title: string;
  items: Record<string, NavMenuItem>;
}

const LeftTabStrip = observer(function LeftTabStrip(props: LeftTabStripProps) {
  const { t } = useI18n();
  const { styles: popupStyles } = useEditorPopupStyles();
  const [openGroup, setOpenGroup] = React.useState<string>();
  useOnIFrameMouseDown(React.useCallback(() => setOpenGroup(undefined), []));
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
  const topFrameApi = useTopFrameApi();
  const studioCtx = useStudioCtx();
  const isLoggedIn = studioCtx.appCtx.selfInfo != null;
  const contentEditorMode = studioCtx.contentEditorMode;
  const hasGlobalContexts = studioCtx.site.globalContexts.length > 0;
  const missingUsedFonts = studioCtx.fontManager.missingUsedFonts();

  const uiConfig = studioCtx.getCurrentUiConfig();

  const canViewTab = (tab: LeftTabUiKey) => {
    return (
      getLeftTabPermission(uiConfig, tab, {
        isContentCreator: contentEditorMode,
      }) !== "hidden"
    );
  };

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
  Imported Projects
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
        imports: {
          type: "item",
          tabKey: "imports",
          icon: <DownloadsvgIcon />,
          label: t("Imported projects"),
          cond: isLoggedIn && canViewTab("imports"),
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
            spawn(
              showTemporaryInfo({
                title: t("Import from Figma"),
                content: <FigmaModalContent />,
                width: 640,
              }),
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
      icon: <WarningTrianglesvgIcon />,
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
                  studioCtx.leftTabKey === item.tabKey &&
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
              props.onNavigate?.();
            })
          }
          expanded={
            !props.managementOnly && item.tabKey
              ? studioCtx.leftTabKey === item.tabKey &&
                !studioCtx.showAddDrawer() &&
                !studioCtx.panelsHidden
              : undefined
          }
          data-test-tabkey={key}
          showAlert={item.showAlert}
          href={item.href}
          className={item.className}
          isSelected={
            props.managementOnly &&
            item.tabKey &&
            item.tabKey === studioCtx.leftTabKey
          }
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
                open={openGroup === key}
                onOpenChange={(open) => {
                  setOpenGroup((current) =>
                    open ? key : current === key ? undefined : current,
                  );
                  if (open && !props.managementOnly) {
                    spawn(
                      studioCtx.changeUnsafe(() => {
                        studioCtx.setShowAddDrawer(false);
                        studioCtx.switchLeftTab(undefined);
                      }),
                    );
                  }
                }}
                content={
                  <div
                    className={popupStyles.root}
                    style={{
                      minWidth: 200,
                      maxHeight: "calc(100vh - 120px)",
                      overflowY: "auto",
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
                  </div>
                }
              >
                <span style={{ display: "inline-flex" }}>
                  <LeftTabButton
                    icon={item.icon}
                    label={item.title}
                    hasLabel
                    tooltip={item.title}
                    data-test-tabkey={key}
                    onClick={() => {}}
                    expanded={openGroup === key}
                    isSelected={
                      openGroup === key ||
                      (!studioCtx.showAddDrawer() &&
                        !studioCtx.panelsHidden &&
                        Object.keys(item.items).some(
                          (i) => i === studioCtx.leftTabKey,
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
    imports: mainGroups.more.items.imports,
  };
  if (props.managementOnly) {
    if (mainGroups.settingsGroup.items.settings.cond === false) {
      return null;
    }
    return (
      <div className="editor-management-menu">
        {renderButtonGroup({
          settingsGroup: {
            ...mainGroups.settingsGroup,
            items: { settings: mainGroups.settingsGroup.items.settings },
          },
        })}
      </div>
    );
  }

  return (
    <PlasmicLeftTabStrip
      showAvatar={false}
      insert={{ render: () => null }}
      root={{ className: props.className, id: "left-tab-strip" }}
      buttons={
        <>
          <LeftTabButton
            hasLabel
            label={t("Select")}
            tooltip={t("Select")}
            icon={toolIcon("M5 3l14 10-7 1-3 7z")}
            isSelected={studioCtx.canvasTool === "select"}
            onClick={() => {
              studioCtx.setCanvasTool("select");
              spawn(
                studioCtx.changeUnsafe(() => studioCtx.setShowAddDrawer(false)),
              );
            }}
          />
          <LeftTabButton
            hasLabel
            label={t("Pan")}
            tooltip={t("Pan")}
            icon={toolIcon(
              "M7 12V6a2 2 0 0 1 4 0v5 M11 11V4a2 2 0 0 1 4 0v7 M15 11V6a2 2 0 0 1 4 0v9c0 5-3 7-6 7-4 0-6-3-9-8a2 2 0 0 1 3-2l2 2",
            )}
            isSelected={studioCtx.canvasTool === "pan"}
            onClick={() => {
              studioCtx.setCanvasTool("pan");
              spawn(
                studioCtx.changeUnsafe(() => studioCtx.setShowAddDrawer(false)),
              );
            }}
          />
          <div className="editor-rail-divider" role="separator" />
          <LeftTabButton
            dataTestId="add-button"
            expanded={studioCtx.showAddDrawer()}
            isSelected={studioCtx.showAddDrawer()}
            hasLabel
            label={t("Insert")}
            tooltip={t("Insert")}
            icon={toolIcon("M12 4v16 M4 12h16")}
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
              studioCtx.leftTabKey === "outline" && !studioCtx.showAddDrawer()
            }
            hasLabel
            label={t("Layers")}
            tooltip={t("Layers")}
            icon={toolIcon(
              "M2 7l10-5 10 5-10 5z M2 12l10 5 10-5 M2 17l10 5 10-5",
            )}
            onClick={() => {
              studioCtx.showLayersPanel();
            }}
          />
          {renderButtonGroup({
            assets: {
              ...mainGroups.assets,
              icon: toolIcon("M3 3h18v18H3z M3 16l6-6 7 7 3-3 2 2 M15 7h.01"),
              items: resourceItems,
            },
          })}
          <LeftTabButton
            hasLabel
            label={t("AI")}
            tooltip={t("AI assistant")}
            icon={toolIcon("M12 2l3 7 7 3-7 3-3 7-3-7-7-3 7-3z")}
            disabled={!studioCtx.chatCopilotEnabled()}
            isSelected={studioCtx.isCopilotChatOpen}
            onClick={() => {
              if (studioCtx.chatCopilotEnabled()) {
                spawn(topFrameApi.toggleCopilotChat());
              }
            }}
          />
          <div className="editor-rail-divider" role="separator" />
          {topMenu.lint.type === "item" &&
            renderButton("lint", topMenu.lint, true, undefined)}
          {renderButtonGroup({
            more: {
              ...mainGroups.more,
              icon: toolIcon("M4 12h.01 M12 12h.01 M20 12h.01"),
              items: {
                splits: mainGroups.more.items.splits,
                expressions: mainGroups.more.items.expressions,
                figma: mainGroups.more.items.figma,
              },
            },
          })}
        </>
      }
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
