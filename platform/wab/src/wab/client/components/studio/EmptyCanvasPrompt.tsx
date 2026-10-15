import { useI18n } from "@/wab/client/i18n";
import SparklesIcon from "@/wab/client/plasmic/plasmic_kit_data_binding/icons/PlasmicIcon__Sparkles3";
import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import {
  ArrowRightOutlined,
  LayoutOutlined,
  PlusOutlined,
} from "@ant-design/icons";
import { Scrollbar } from "@shiguang2/components/esm/scrollbar";
import { createStyles } from "antd-style";
import { observer } from "mobx-react";
import * as React from "react";

const useStyles = createStyles(({ token }) => ({
  root: {
    position: "absolute",
    top: 72,
    bottom: 74,
    right: 336,
    minWidth: 0,
    containerType: "inline-size",
    pointerEvents: "none",
    color: token.colorText,
    fontFamily: token.fontFamily,
  },
  leftPanelOpen: {
    "@media (max-width: 1100px)": { right: 8 },
  },
  panelsHidden: { right: 8 },
  scroll: { height: "100%", width: "100%", pointerEvents: "auto" },
  content: {
    boxSizing: "border-box",
    minHeight: "100%",
    padding: "24px 8px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    textAlign: "center",
    maxWidth: 720,
    marginInline: "auto",
  },
  badge: {
    padding: "4px 10px",
    borderRadius: token.borderRadiusSM,
    background: token.colorPrimaryBg,
    color: token.colorPrimaryText,
    fontSize: 12,
    lineHeight: "20px",
  },
  title: {
    margin: "16px 0 8px",
    fontSize: "clamp(22px, 2vw, 28px)",
    fontWeight: 600,
    lineHeight: 1.4,
    color: token.colorText,
  },
  description: {
    margin: 0,
    color: token.colorTextSecondary,
    fontSize: 14,
    lineHeight: 1.6,
  },
  cards: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: 12,
    width: "100%",
    marginTop: 28,
    "@container (max-width: 600px)": { gridTemplateColumns: "1fr" },
  },
  card: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    gap: 12,
    minWidth: 0,
    padding: 20,
    border: `1px solid ${token.colorBorder}`,
    borderRadius: token.borderRadiusLG,
    background: token.colorBgContainer,
    color: token.colorText,
    fontFamily: "inherit",
    textAlign: "left",
    cursor: "pointer",
    "&:hover:not(:disabled)": {
      borderColor: token.colorPrimary,
      background: token.colorPrimaryBg,
    },
    "&:focus-visible": {
      outline: `2px solid ${token.colorPrimary}`,
      outlineOffset: 2,
    },
    "&:disabled": { opacity: 0.5, cursor: "default" },
    "@container (max-width: 600px)": {
      display: "grid",
      gridTemplateColumns: "32px minmax(0, 1fr)",
      columnGap: 16,
      rowGap: 6,
      padding: 16,
    },
  },
  icon: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: 32,
    height: 32,
    color: token.colorPrimaryText,
    fontSize: 22,
    "& svg": { width: 22, height: 22 },
    "@container (max-width: 600px)": { gridRow: "1 / 4" },
  },
  cardTitle: { fontSize: 15, fontWeight: 600, lineHeight: 1.5 },
  cardDescription: {
    flex: 1,
    fontSize: 13,
    lineHeight: 1.6,
    color: token.colorTextSecondary,
  },
  action: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    fontSize: 12,
    lineHeight: 1.5,
    color: token.colorPrimaryText,
  },
  component: {
    marginTop: 20,
    padding: "4px 8px",
    border: 0,
    borderRadius: token.borderRadiusSM,
    background: "transparent",
    color: token.colorTextSecondary,
    fontFamily: "inherit",
    fontSize: 12,
    cursor: "pointer",
    "&:hover:not(:disabled)": { color: token.colorPrimaryText },
    "&:focus-visible": {
      outline: `2px solid ${token.colorPrimary}`,
      outlineOffset: 2,
    },
    "&:disabled": { opacity: 0.5, cursor: "default" },
  },
}));

export const EmptyCanvasPrompt = observer(function EmptyCanvasPrompt({
  studioCtx,
  emptyProject,
}: {
  studioCtx: StudioCtx;
  emptyProject: boolean;
}) {
  const { t } = useI18n();
  const { styles, cx } = useStyles();
  const canCreate = studioCtx.canSave();
  const cards = [
    {
      key: "template",
      icon: <LayoutOutlined />,
      title: t("Start from a template"),
      description: t(
        "Choose a page template to start with a ready-made layout.",
      ),
      action: t("Open Pages panel"),
      onClick: () => studioCtx.showProjectPanel(),
      disabled: !canCreate,
    },
    {
      key: "ai",
      icon: <SparklesIcon />,
      title: t("Describe your idea"),
      description: t(
        "Describe your page and requirements in the AI assistant.",
      ),
      action: t("Open AI assistant"),
      onClick: () => {
        void studioCtx.openCopilotChat({
          prompt: "",
          mode: undefined,
        });
      },
      disabled: !studioCtx.chatCopilotEnabled(),
    },
    {
      key: "blank",
      icon: <PlusOutlined />,
      title: t("Add a blank page"),
      description: t("Build your own layout and add components from scratch."),
      action: t("New page"),
      onClick: () => {
        void studioCtx.siteOps().createFrameForNewPage();
      },
      disabled: !canCreate,
    },
  ];

  return (
    <div
      className={cx(styles.root, {
        [styles.leftPanelOpen]: !!studioCtx.leftTabKey,
        [styles.panelsHidden]: studioCtx.panelsHidden,
      })}
      style={{
        left: studioCtx.panelsHidden
          ? 8
          : studioCtx.leftTabKey
            ? studioCtx.leftPaneWidth + 72
            : 72,
      }}
      onMouseDown={(event) => event.stopPropagation()}
    >
      <Scrollbar className={styles.scroll} scrollX={false}>
        <section
          className={styles.content}
          aria-label={t("Start designing on the canvas")}
        >
          <span className={styles.badge}>
            {t(emptyProject ? "Blank project" : "Empty canvas")}
          </span>
          <h1 className={styles.title}>{t("Start designing on the canvas")}</h1>
          <p className={styles.description}>
            {t(
              emptyProject
                ? "Choose a starting point to create your first page."
                : "Choose a starting point to add a page to this canvas.",
            )}
          </p>
          <div className={styles.cards}>
            {cards.map((card) => (
              <button
                key={card.key}
                aria-label={card.title}
                className={styles.card}
                type="button"
                onClick={card.onClick}
                disabled={card.disabled}
              >
                <span className={styles.icon} aria-hidden="true">
                  {card.icon}
                </span>
                <span className={styles.cardTitle}>{card.title}</span>
                <span className={styles.cardDescription}>
                  {card.description}
                </span>
                <span className={styles.action}>
                  {card.action}
                  <ArrowRightOutlined aria-hidden="true" />
                </span>
              </button>
            ))}
          </div>
          <button
            className={styles.component}
            type="button"
            disabled={!canCreate}
            onClick={() => {
              void studioCtx.siteOps().createFrameForNewComponent();
            }}
          >
            {t("Or create a reusable component")}
          </button>
        </section>
      </Scrollbar>
    </div>
  );
});
