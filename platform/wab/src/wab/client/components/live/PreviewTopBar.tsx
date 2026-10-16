import {
  ArrowLeftOutlined,
  CheckOutlined,
  DesktopOutlined,
  DownOutlined,
  EllipsisOutlined,
  MobileOutlined,
  TabletOutlined,
} from "@ant-design/icons";
import { Scrollbar } from "@shiguang2/components/esm/scrollbar";
import {
  Button,
  Dropdown,
  InputNumber,
  MenuProps,
  Popover,
  Segmented,
  Tooltip,
} from "antd";
import { createStyles } from "antd-style";
import { observer } from "mobx-react";
import React, { useState } from "react";
import { MdScreenRotation } from "react-icons/md";

import { BrandLink } from "@/wab/client/components/BrandLink";
import { applicationHeaderLayout } from "@/wab/client/components/ui/layout-styles";
import {
  DEVICE_VIEWPORTS,
  isViewportDimension,
  PreviewViewportMode,
} from "@/wab/client/components/live/preview-viewport";
import { usePreviewCtx } from "@/wab/client/components/live/PreviewCtx";
import BranchSwitcher from "@/wab/client/components/top-bar/BranchSwitcher";
import CodeButton from "@/wab/client/components/top-bar/CodeButton";
import VariantsComboSelect from "@/wab/client/components/top-bar/VariantsComboSelect";
import { Icon, SvgIcon } from "@/wab/client/components/widgets/Icon";
import { useTopFrameApi } from "@/wab/client/contexts/AppContexts";
import { useI18n } from "@/wab/client/i18n";
import ComponentIcon from "@/wab/client/plasmic/plasmic_kit/PlasmicIcon__Component";
import PageIcon from "@/wab/client/plasmic/plasmic_kit_design_system/icons/PlasmicIcon__Page";
import { useStudioCtx } from "@/wab/client/contexts/StudioContexts";
import { ensure, spawn } from "@/wab/shared/common";
import {
  isCodeComponent,
  isFrameComponent,
  isPageComponent,
  isReusableComponent,
} from "@/wab/shared/core/components";
import { naturalSort } from "@/wab/shared/sort";
import {
  getAllVariantsForTpl,
  isBaseVariant,
  isPrivateStyleVariant,
  isScreenVariant,
  isStyleOrCodeComponentVariant,
} from "@/wab/shared/Variants";

const useStyles = createStyles(({ token }) => ({
  topBar: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) auto minmax(0, 1fr)",
    alignItems: "center",
    gap: 12,
    minHeight: applicationHeaderLayout.height,
    flexShrink: 0,
    margin: 8,
    color: token.colorText,
    position: "relative",
    zIndex: 100,
    "& .ant-btn": {
      height: applicationHeaderLayout.controlHeight,
      borderRadius: 8,
      fontSize: 13,
    },
    "& .ant-segmented": { padding: 2, borderRadius: 8 },
    "& .ant-segmented-item-label": { minHeight: 24, lineHeight: "24px" },
    "& .ant-segmented-item": { borderRadius: 6 },
    "& .ant-segmented-item-selected": {
      background: token.colorPrimary,
      color: token.colorTextLightSolid,
    },
    "@media (max-width: 1280px)": {
      gridTemplateColumns: "minmax(0, 1fr) auto",
      gap: 12,
    },
    "@media (max-width: 600px)": { columnGap: 8 },
    "@media (max-width: 420px)": { gridTemplateColumns: "1fr" },
  },
  section: {
    display: "flex",
    alignItems: "center",
    minHeight: applicationHeaderLayout.height,
    minWidth: 0,
    maxWidth: "100%",
    boxSizing: "border-box",
    padding: "6px 8px",
    background: token.colorBgContainer,
    border: `1px solid ${token.colorBorder}`,
    borderRadius: token.borderRadiusLG,
    boxShadow: token.boxShadowSecondary,
  },
  rightGroup: {
    display: "flex",
    alignItems: "center",
    justifySelf: "end",
    minWidth: 0,
    maxWidth: "100%",
    gap: 12,
    gridColumn: -2,
    gridRow: 1,
    "@media (max-width: 420px)": { gridRow: 2, gridColumn: 1 },
  },
  leftSection: {
    gap: 4,
    justifySelf: "start",
    paddingInline: 12,
    borderRadius: applicationHeaderLayout.height / 2,
    "@media (max-width: 600px)": { flexWrap: "wrap" },
  },
  navigationTrigger: {
    minWidth: 0,
    flexShrink: 1,
    gap: 6,
    "&&": {
      height: applicationHeaderLayout.controlHeight,
      padding: "0 8px",
      border: 0,
      "--ant-btn-border-width": "0px",
      borderRadius: 7,
      background: "transparent",
      boxShadow: "none",
      transitionProperty: "background-color, color",
      "&:hover, &[aria-expanded=true]": {
        background: token.colorFillTertiary,
        color: token.colorText,
      },
      "&:focus-visible": {
        outline: `2px solid ${token.colorPrimary}`,
        outlineOffset: 2,
      },
    },
  },
  desktopLeftSection: {
    "&&": {
      paddingLeft: 96,
    },
  },
  centerSection: {
    justifySelf: "center",
    justifyContent: "center",
    gap: 12,
    "@media (max-width: 1280px)": { gridRow: 2, gridColumn: "1 / -1" },
    "@media (max-width: 600px)": { gap: 8, flexWrap: "wrap" },
    "@media (max-width: 420px)": { gridRow: 3 },
  },
  rightSection: {
    justifySelf: "end",
    justifyContent: "flex-end",
    gap: 4,
    borderRadius: applicationHeaderLayout.height / 2,
    flexShrink: 0,
  },
  codeControls: {
    display: "flex",
    alignItems: "center",
    "& .editor-code-controls": {
      display: "flex",
      alignItems: "center",
      gap: 2,
    },
    "& .editor-code-controls svg": {
      width: 18,
      height: 18,
      fill: "none",
      stroke: "currentColor",
      strokeWidth: 1.6,
      strokeLinecap: "round",
      strokeLinejoin: "round",
    },
  },
  pageLabel: {
    display: "flex",
    color: token.colorText,
    alignItems: "center",
    gap: 6,
    minWidth: 0,
    "& svg": { flexShrink: 0, color: token.colorTextSecondary },
    "& span": {
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
    },
  },
  pageMenu: {
    width: 300,
    maxWidth: "calc(100vw - 32px)",
    maxHeight: "calc(100vh - 120px)",
    minHeight: 0,
    padding: 6,
    borderRadius: token.borderRadiusLG,
    background: token.colorBgElevated,
    boxShadow: token.boxShadowSecondary,
    "& .ant-dropdown-menu": {
      padding: 0,
      maxHeight: "none",
      overflow: "visible",
      background: "transparent",
      boxShadow: "none",
    },
    "& .ant-dropdown-menu-item-group-title": {
      padding: "8px 10px",
      fontSize: 12,
    },
    "& .ant-dropdown-menu-item": {
      padding: "8px 10px",
      borderRadius: 6,
      minHeight: 36,
    },
    "& .ant-dropdown-menu-item-selected": {
      background: token.colorPrimaryBg,
      color: token.colorPrimaryText,
      fontWeight: 500,
    },
  },
  moreMenuContent: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
    minWidth: 200,
    padding: 4,
  },
  sizeMenu: { width: 280, display: "flex", flexDirection: "column", gap: 4 },
  sizeOption: {
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-start",
    gap: 8,
    height: 36,
    textAlign: "left",
    padding: "0 12px",
  },
  selectedSize: {
    background: token.colorPrimaryBg,
    color: token.colorPrimaryText,
  },
  check: { width: 14, flexShrink: 0 },
  divider: {
    borderTop: `1px solid ${token.colorBorderSecondary}`,
    margin: "8px 0",
  },
  customLabel: {
    fontSize: 12,
    color: token.colorTextSecondary,
    margin: "0 8px 8px",
  },
  customSizeInputs: {
    display: "flex",
    alignItems: "flex-end",
    gap: 8,
    padding: "0 8px 8px",
    "& label": {
      display: "flex",
      flexDirection: "column",
      gap: 6,
      fontSize: 12,
      color: token.colorTextSecondary,
    },
    "& .ant-input-number": { width: 76, height: 36 },
    "& .ant-input-number-input": { height: 34 },
  },
}));

export const PreviewTopBar = observer(function PreviewTopBar({
  dimensions,
}: {
  dimensions?: { width: number; height: number };
}) {
  const { styles, cx } = useStyles();
  const { t } = useI18n();
  const topFrameApi = useTopFrameApi();
  const isMacDesktop = navigator.userAgent.includes("PlasmicDesktop/darwin");
  const leftSectionRef = React.useRef<HTMLDivElement>(null);
  React.useLayoutEffect(() => {
    if (!isMacDesktop) {
      return;
    }
    const root = ensure(
      leftSectionRef.current,
      "Preview navigation is mounted",
    );
    const update = () => {
      const bounds = root.getBoundingClientRect();
      spawn(
        topFrameApi.setDesktopTitleBarDragRegion({
          left: bounds.left,
          top: bounds.top,
          width: 80,
          height: applicationHeaderLayout.height,
        }),
      );
    };
    const resizeObserver = new ResizeObserver(update);
    resizeObserver.observe(root);
    update();
    return () => {
      resizeObserver.disconnect();
      spawn(topFrameApi.setDesktopTitleBarDragRegion(null));
    };
  }, [isMacDesktop, topFrameApi]);
  const previewCtx = usePreviewCtx();
  const studioCtx = useStudioCtx();

  const previewPages = previewCtx.studioCtx.site.components.filter((c) =>
    isPageComponent(c),
  );
  const previewComponents = previewCtx.studioCtx.site.components.filter(
    (c) => isReusableComponent(c) && !isCodeComponent(c),
  );
  const previewArtboards = previewCtx.studioCtx.site.components.filter((c) =>
    isFrameComponent(c),
  );

  const [moreOpen, setMoreOpen] = useState(false);
  const [pageMenuOpen, setPageMenuOpen] = useState(false);
  const [sizeMenuOpen, setSizeMenuOpen] = useState(false);
  const renderPageLabel = (name: string, icon: SvgIcon) => (
    <span className={styles.pageLabel} title={name}>
      <Icon icon={icon} size={18} />
      <span>{name}</span>
    </span>
  );
  const pageMenuItems: MenuProps["items"] = [
    {
      key: "pages",
      type: "group" as const,
      label: t("Pages"),
      children: naturalSort(previewPages, (c) => c.name).map((c) => ({
        key: c.uuid,
        label: renderPageLabel(c.name, PageIcon),
      })),
    },
    {
      key: "components",
      type: "group" as const,
      label: t("Components"),
      children: naturalSort(previewComponents, (c) => c.name).map((c) => ({
        key: c.uuid,
        label: renderPageLabel(c.name, ComponentIcon),
      })),
    },
    {
      key: "artboards",
      type: "group" as const,
      label: t("Artboards"),
      children: previewArtboards.map((c) => ({
        key: c.uuid,
        label: renderPageLabel(c.name || t("Artboards"), ComponentIcon),
      })),
    },
  ].filter((group) => group.children.length > 0);

  const [customWidth, setCustomWidth] = useState(previewCtx.width);
  const [customHeight, setCustomHeight] = useState(previewCtx.height);

  const hasVariants =
    !!previewCtx.component &&
    getAllVariantsForTpl({
      component: previewCtx.component,
      tpl: null,
      site: studioCtx.site,
    }).some(
      (v) =>
        !isStyleOrCodeComponentVariant(v) &&
        !isScreenVariant(v) &&
        !isPrivateStyleVariant(v) &&
        !isBaseVariant(v),
    );
  const validSize =
    isViewportDimension(customWidth) && isViewportDimension(customHeight);
  const openSizeMenu = (open: boolean) => {
    if (open) {
      setCustomWidth(dimensions?.width || previewCtx.width);
      setCustomHeight(dimensions?.height || previewCtx.height);
    }
    setSizeMenuOpen(open);
  };

  const handleViewportChange = (val: PreviewViewportMode) => {
    let newWidth = previewCtx.width;
    let newHeight = previewCtx.height;
    if (val === "phone" || val === "tablet") {
      newWidth = DEVICE_VIEWPORTS[val].width;
      newHeight = DEVICE_VIEWPORTS[val].height;
    }
    spawn(
      previewCtx.pushViewport({
        viewport: val,
        width: newWidth,
        height: newHeight,
      }),
    );
  };

  const handleCustomSizeApply = () => {
    if (validSize) {
      spawn(
        previewCtx.pushViewport({
          viewport: "custom",
          width: customWidth,
          height: customHeight,
        }),
      );
      setSizeMenuOpen(false);
    }
  };

  const currentDevice =
    previewCtx.viewport === "custom" ? "desktop" : previewCtx.viewport;

  return (
    <div
      className={styles.topBar}
      data-desktop-titlebar={isMacDesktop ? "mac" : undefined}
      onKeyDownCapture={(event) => {
        if (
          event.key === "Escape" &&
          (sizeMenuOpen || moreOpen || pageMenuOpen)
        ) {
          event.stopPropagation();
          setSizeMenuOpen(false);
          setMoreOpen(false);
          setPageMenuOpen(false);
        }
      }}
    >
      <div
        ref={leftSectionRef}
        className={cx(
          styles.section,
          styles.leftSection,
          isMacDesktop && styles.desktopLeftSection,
        )}
      >
        <BrandLink
          brand={
            studioCtx.getCurrentUiConfig().brand ??
            studioCtx.appCtx.appConfig.brands?.[
              studioCtx.siteInfo.teamId ?? ""
            ] ??
            studioCtx.appCtx.appConfig.brands?.[""]
          }
        />
        {studioCtx.showBranching() && (
          <BranchSwitcher className={styles.navigationTrigger} />
        )}
        <Dropdown
          trigger={["click"]}
          placement="bottomLeft"
          open={pageMenuOpen}
          onOpenChange={setPageMenuOpen}
          autoFocus
          menu={{
            items: pageMenuItems,
            selectable: true,
            selectedKeys: previewCtx.component
              ? [previewCtx.component.uuid]
              : [],
            onClick: ({ key }) => {
              setPageMenuOpen(false);
              const component = previewCtx.studioCtx.site.components.find(
                (c) => c.uuid === key,
              );
              if (component) {
                void previewCtx.pushComponent(component);
              }
            },
          }}
          popupRender={(menu) => (
            <Scrollbar
              scrollX={false}
              defer={false}
              className={styles.pageMenu}
              onKeyDownCapture={(event) => {
                if (event.key === "Escape") {
                  event.stopPropagation();
                  setPageMenuOpen(false);
                }
              }}
            >
              {menu}
            </Scrollbar>
          )}
        >
          <Button
            type="text"
            className={styles.navigationTrigger}
            aria-label={t("Select component")}
            aria-haspopup="menu"
            aria-expanded={pageMenuOpen}
          >
            {previewCtx.component &&
              renderPageLabel(
                previewCtx.component.name || t("Artboards"),
                isPageComponent(previewCtx.component)
                  ? PageIcon
                  : ComponentIcon,
              )}
            <DownOutlined style={{ fontSize: 10 }} />
          </Button>
        </Dropdown>
      </div>

      <div className={cx(styles.section, styles.centerSection)}>
        <Segmented
          aria-label={t("Preview device")}
          options={[
            {
              value: "desktop",
              icon: <DesktopOutlined />,
              label: t("Desktop"),
            },
            { value: "tablet", icon: <TabletOutlined />, label: t("Tablet") },
            { value: "phone", icon: <MobileOutlined />, label: t("Phone") },
          ]}
          value={currentDevice}
          onChange={(val) => {
            if (val === "desktop" || val === "tablet" || val === "phone") {
              handleViewportChange(val);
            }
          }}
        />
        <Popover
          open={sizeMenuOpen}
          onOpenChange={openSizeMenu}
          trigger="click"
          placement="bottomLeft"
          content={
            <div className={styles.sizeMenu}>
              <Button
                type="text"
                block
                className={`${styles.sizeOption} ${previewCtx.viewport === "desktop" ? styles.selectedSize : ""}`}
                onClick={() => {
                  handleViewportChange("desktop");
                  setSizeMenuOpen(false);
                }}
              >
                <span className={styles.check}>
                  {previewCtx.viewport === "desktop" && <CheckOutlined />}
                </span>
                {t("Auto (Fit to window)")}
              </Button>
              <div className={styles.divider} />
              {[
                [1280, 720],
                [1440, 900],
                [1920, 1080],
              ].map(([width, height]) => {
                const selected =
                  previewCtx.viewport === "custom" &&
                  previewCtx.width === width &&
                  previewCtx.height === height;
                return (
                  <Button
                    key={`${width}-${height}`}
                    type="text"
                    block
                    className={`${styles.sizeOption} ${selected ? styles.selectedSize : ""}`}
                    onClick={() => {
                      spawn(
                        previewCtx.pushViewport({
                          viewport: "custom",
                          width,
                          height,
                        }),
                      );
                      setSizeMenuOpen(false);
                    }}
                  >
                    <span className={styles.check}>
                      {selected && <CheckOutlined />}
                    </span>
                    {width} × {height}
                  </Button>
                );
              })}
              <div className={styles.divider} />
              <div className={styles.customLabel}>{t("Custom")}</div>
              <form
                className={styles.customSizeInputs}
                onSubmit={(event) => {
                  event.preventDefault();
                  handleCustomSizeApply();
                }}
              >
                <label>
                  {t("Width")}
                  <InputNumber
                    aria-label={t("Preview width")}
                    value={customWidth}
                    onChange={(v) => setCustomWidth(v ?? 0)}
                    min={240}
                    max={7680}
                    step={1}
                  />
                </label>
                <label>
                  {t("Height")}
                  <InputNumber
                    aria-label={t("Preview height")}
                    value={customHeight}
                    onChange={(v) => setCustomHeight(v ?? 0)}
                    min={240}
                    max={7680}
                    step={1}
                  />
                </label>
                <Button
                  type="primary"
                  htmlType="submit"
                  disabled={!validSize}
                  autoInsertSpace={false}
                >
                  {t("Apply")}
                </Button>
              </form>
            </div>
          }
        >
          <Button
            aria-label={t("Preview viewport")}
            aria-expanded={sizeMenuOpen}
          >
            {previewCtx.viewport === "desktop"
              ? t("Auto")
              : `${previewCtx.width} × ${previewCtx.height}`}
            <DownOutlined />
          </Button>
        </Popover>
        {currentDevice !== "desktop" && (
          <Tooltip
            title={t(
              previewCtx.width > previewCtx.height
                ? "Switch to portrait"
                : "Switch to landscape",
            )}
          >
            <Button
              aria-label={t(
                previewCtx.width > previewCtx.height
                  ? "Switch to portrait"
                  : "Switch to landscape",
              )}
              type="text"
              icon={<MdScreenRotation size={18} />}
              onClick={() => {
                spawn(
                  previewCtx.pushViewport({
                    viewport: currentDevice,
                    width: previewCtx.height,
                    height: previewCtx.width,
                  }),
                );
              }}
            />
          </Tooltip>
        )}
      </div>

      <div className={styles.rightGroup}>
        {navigator.userAgent.includes("PlasmicDesktop/") && (
          <span
            data-desktop-update-slot="header"
            data-desktop-update-compact="true"
          />
        )}
        <div className={cx(styles.section, styles.rightSection)}>
          {hasVariants && (
            <Popover
              open={moreOpen}
              onOpenChange={setMoreOpen}
              trigger="click"
              placement="bottomRight"
              content={
                <div className={styles.moreMenuContent}>
                  <>
                    <span>{t("Variants")}</span>
                    <VariantsComboSelect />
                  </>
                </div>
              }
            >
              <Tooltip title={t("More")}>
                <Button aria-label={t("More")} icon={<EllipsisOutlined />} />
              </Tooltip>
            </Popover>
          )}
          {!studioCtx.contentEditorMode && (
            <div className={styles.codeControls}>
              <CodeButton showOptions={false} />
            </div>
          )}
          <Tooltip
            title={t("{part1} · Esc", {
              part1: String(t("Back to editor")),
            })}
          >
            <Button
              type="text"
              aria-label={t("Back to editor")}
              icon={<ArrowLeftOutlined />}
              onClick={() => spawn(previewCtx.toggleLiveMode())}
            />
          </Tooltip>
        </div>
      </div>
    </div>
  );
});
