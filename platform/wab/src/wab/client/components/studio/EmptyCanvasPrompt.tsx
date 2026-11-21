import styles from "./EmptyCanvasPrompt.module.less";
import { cx } from "@/wab/shared/common";
import { useI18n } from "@/wab/client/i18n";
import SparklesIcon from "@/wab/client/plasmic/plasmic_kit_data_binding/icons/PlasmicIcon__Sparkles3";
import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import {
  selectLeftPaneWidth,
  selectLeftTabKey,
  selectPanelsHidden,
} from "@/wab/client/studio-ctx/left-panel-state";
import { useStudioSaveState } from "@/wab/client/studio-ctx/save-state";
import {
  ArrowRightOutlined,
  LayoutOutlined,
  PlusOutlined,
} from "@ant-design/icons";
import { Scrollbar } from "@shiguang2/components/esm/scrollbar";
import * as React from "react";
import { useStore } from "zustand";

export const EmptyCanvasPrompt = React.memo(function EmptyCanvasPrompt({
  studioCtx,
  emptyProject,
}: {
  studioCtx: StudioCtx;
  emptyProject: boolean;
}) {
  const { t } = useI18n();

  const canCreate = useStudioSaveState(studioCtx, (state) => state.canSave);
  const canEditProject = useStore(studioCtx.uiEnvironment.store, (state) => state.canEditProject);
  const leftTabKey = useStore(
    studioCtx.leftPanelState.store,
    selectLeftTabKey,
  );
  const panelsHidden = useStore(
    studioCtx.leftPanelState.store,
    selectPanelsHidden,
  );
  const leftPaneWidth = useStore(
    studioCtx.leftPanelState.store,
    selectLeftPaneWidth,
  );
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
        void studioCtx.openCopilotChat();
      },
      disabled: !canEditProject || !studioCtx.appCtx.appConfig.enableLocalAiEditing,
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
        [styles.leftPanelOpen]: !!leftTabKey,
        [styles.panelsHidden]: panelsHidden,
      })}
      style={{
        left: panelsHidden
          ? 8
          : leftTabKey
            ? leftPaneWidth + 72
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
