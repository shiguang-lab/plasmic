import {
  ArrowLeftOutlined,
  CheckOutlined,
  DesktopOutlined,
  DownOutlined,
  EllipsisOutlined,
  MobileOutlined,
  TabletOutlined,
} from "@ant-design/icons";
import { Button, InputNumber, Popover, Segmented, Select, Tooltip } from "antd";
import { createStyles } from "antd-style";
import { observer } from "mobx-react";
import React, { useState } from "react";
import { MdScreenRotation } from "react-icons/md";

import {
  DEVICE_VIEWPORTS,
  isViewportDimension,
  PreviewViewportMode,
} from "@/wab/client/components/live/preview-viewport";
import { usePreviewCtx } from "@/wab/client/components/live/PreviewCtx";
import CodeButton from "@/wab/client/components/top-bar/CodeButton";
import VariantsComboSelect from "@/wab/client/components/top-bar/VariantsComboSelect";
import { Icon, SvgIcon } from "@/wab/client/components/widgets/Icon";
import { useI18n } from "@/wab/client/i18n";
import ComponentIcon from "@/wab/client/plasmic/plasmic_kit/PlasmicIcon__Component";
import PageIcon from "@/wab/client/plasmic/plasmic_kit_design_system/icons/PlasmicIcon__Page";
import { useStudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { spawn } from "@/wab/shared/common";
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
    gap: 24,
    minHeight: 64,
    flexShrink: 0,
    padding: "12px 24px",
    background: token.colorBgContainer,
    borderBottom: `1px solid ${token.colorBorderSecondary}`,
    color: token.colorText,
    position: "relative",
    zIndex: 100,
    "& .ant-btn": { height: 36, borderRadius: 8, fontSize: 13 },
    "& .ant-segmented": { padding: 3, borderRadius: 8 },
    "& .ant-segmented-item": { borderRadius: 6 },
    "& .ant-segmented-item-selected": {
      background: token.colorPrimary,
      color: token.colorTextLightSolid,
    },
    "@media (max-width: 1100px)": {
      gridTemplateColumns: "minmax(0, 1fr) auto",
      gap: 12,
    },
    "@media (max-width: 600px)": { padding: "12px", columnGap: 8 },
    "@media (max-width: 420px)": { gridTemplateColumns: "1fr" },
  },
  leftSection: {
    display: "flex",
    alignItems: "center",
    gap: 16,
    minWidth: 0,
    "@media (max-width: 600px)": { gap: 8 },
  },
  centerSection: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    "@media (max-width: 1100px)": { gridRow: 2, gridColumn: "1 / -1" },
    "@media (max-width: 600px)": { gap: 8, flexWrap: "wrap" },
    "@media (max-width: 420px)": { gridRow: 3 },
  },
  rightSection: {
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 12,
    gridColumn: -2,
    gridRow: 1,
    flexShrink: 0,
    "@media (max-width: 600px)": { gap: 8 },
    "@media (max-width: 420px)": { gridRow: 2, gridColumn: 1 },
  },
  logo: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    fontWeight: 600,
    fontSize: 18,
    flexShrink: 0,
    "& svg": { fill: token.colorPrimary, width: 28, height: 28 },
    "@media (max-width: 600px)": { "& span": { display: "none" } },
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
  pageSelect: {
    width: 196,
    flexShrink: 1,
    minWidth: 100,
  },
  pageLabel: {
    display: "flex",
    color: token.colorText,
    alignItems: "center",
    gap: 8,
    minWidth: 0,
    "& svg": { flexShrink: 0, color: token.colorTextSecondary },
    "& span": {
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
    },
  },
  pageMenu: {
    padding: 6,
    "& .ant-select-item-group": { padding: "8px 10px", fontSize: 12 },
    "& .ant-select-item-option": {
      padding: "8px 10px",
      borderRadius: 6,
      minHeight: 36,
    },
    "& .ant-select-item-option-selected": {
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
  const { styles } = useStyles();
  const { t } = useI18n();
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
      <Icon icon={icon} size={22} />
      <span>{name}</span>
    </span>
  );

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
      <div className={styles.leftSection}>
        <div className={styles.logo}>
          <svg viewBox="0 0 32 32" aria-hidden="true">
            <path d="M7 3h14a8 8 0 0 1 0 16h-7l4-5h3a3 3 0 0 0 0-6H11z M11 13h7l-4 5h-3a3 3 0 0 0 0 6h10l-4 5h-6a8 8 0 0 1 0-16z" />
          </svg>
          <span>Plasmic</span>
        </div>
        <Select
          variant="outlined"
          className={styles.pageSelect}
          classNames={{ popup: { root: styles.pageMenu } }}
          styles={{ content: { opacity: 1 } }}
          popupMatchSelectWidth={300}
          menuItemSelectedIcon={<CheckOutlined />}
          optionLabelProp="label"
          open={pageMenuOpen}
          onOpenChange={setPageMenuOpen}
          aria-label={t("Select component")}
          value={previewCtx.component?.uuid}
          labelRender={() =>
            previewCtx.component &&
            renderPageLabel(
              previewCtx.component.name,
              isPageComponent(previewCtx.component) ? PageIcon : ComponentIcon,
            )
          }
          onChange={(uuid) => {
            const component = previewCtx.studioCtx.site.components.find(
              (c) => c.uuid === uuid,
            );
            if (component) {
              void previewCtx.pushComponent(component);
            }
          }}
        >
          {previewPages.length > 0 && (
            <Select.OptGroup label={t("Pages")}>
              {naturalSort(previewPages, (c) => c.name).map((c) => (
                <Select.Option
                  key={c.uuid}
                  value={c.uuid}
                  label={c.name}
                  title={c.name}
                >
                  {renderPageLabel(c.name, PageIcon)}
                </Select.Option>
              ))}
            </Select.OptGroup>
          )}
          {previewComponents.length > 0 && (
            <Select.OptGroup label={t("Components")}>
              {naturalSort(previewComponents, (c) => c.name).map((c) => (
                <Select.Option
                  key={c.uuid}
                  value={c.uuid}
                  label={c.name}
                  title={c.name}
                >
                  {renderPageLabel(c.name, ComponentIcon)}
                </Select.Option>
              ))}
            </Select.OptGroup>
          )}
          {previewArtboards.length > 0 && (
            <Select.OptGroup label={t("Artboards")}>
              {previewArtboards.map((c) => (
                <Select.Option
                  key={c.uuid}
                  value={c.uuid}
                  label={c.name || t("Artboards")}
                  title={c.name}
                >
                  {renderPageLabel(c.name || t("Artboards"), ComponentIcon)}
                </Select.Option>
              ))}
            </Select.OptGroup>
          )}
        </Select>
      </div>

      <div className={styles.centerSection}>
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

      <div className={styles.rightSection}>
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
        <Tooltip title={`${t("Back to editor")} · Esc`}>
          <Button
            type="primary"
            aria-label={t("Back to editor")}
            icon={<ArrowLeftOutlined />}
            onClick={() => spawn(previewCtx.toggleLiveMode())}
          >
            {t("Back to editor")}
          </Button>
        </Tooltip>
      </div>
    </div>
  );
});
