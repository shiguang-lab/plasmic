import { useI18n } from "@/wab/client/i18n";
import { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { summarizeTpl } from "@/wab/shared/core/tpls";
import { isKnownTplComponent, isKnownTplTag } from "@/wab/shared/model/classes";
import { Button, Input, Tooltip } from "antd";
import { createStyles } from "antd-style";
import { observer } from "mobx-react";
import * as React from "react";

const useStyles = createStyles(({ token }) => ({
  root: {
    position: "absolute",
    bottom: 20,
    left: "50%",
    transform: "translateX(-50%)",
    width: 530,
    maxWidth: "calc(100% - 32px)",
    boxSizing: "border-box",
    padding: 12,
    display: "flex",
    alignItems: "center",
    gap: 12,
    zIndex: 30,
    background: token.colorBgContainer,
    color: token.colorText,
    border: `1px solid ${token.colorBorder}`,
    borderRadius: token.borderRadiusLG,
    boxShadow: token.boxShadowSecondary,
    "& svg": {
      width: 18,
      height: 18,
      fill: "none",
      stroke: "currentColor",
      strokeWidth: 1.6,
      strokeLinecap: "round",
      strokeLinejoin: "round",
    },
    "&:focus-within": {
      borderColor: token.colorPrimary,
      boxShadow: `0 0 0 2px ${token.colorPrimaryBg}`,
    },
    "& .ant-input": {
      flex: 1,
      minWidth: 0,
      height: 36,
      padding: 0,
      fontSize: 13,
      background: "transparent",
    },
    "& .ant-input:focus, & .ant-input:focus-visible": {
      outline: "none",
      boxShadow: "none",
    },
    "@media (max-width: 1100px)": { bottom: 84 },
  },
  scope: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "4px 8px",
    borderRadius: 6,
    background: token.colorPrimaryBg,
    color: token.colorPrimaryText,
    fontSize: 12,
    maxWidth: 170,
    flexShrink: 0,
    "& span": {
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
    },
    "& svg": { flexShrink: 0 },
  },
  action: {
    display: "inline-flex",
    flexShrink: 0,
    "& .ant-btn": { width: 36, height: 36, padding: 0, boxShadow: "none" },
    "& .ant-btn:disabled": {
      background: token.colorPrimary,
      color: "#fff",
      borderColor: "transparent",
      opacity: 0.4,
    },
  },
  availability: {
    position: "absolute",
    width: 1,
    height: 1,
    padding: 0,
    margin: -1,
    overflow: "hidden",
    clipPath: "inset(50%)",
    whiteSpace: "nowrap",
    border: 0,
  },
}));

function icon(path: string) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d={path} />
    </svg>
  );
}

export const CanvasAiComposer = observer(function CanvasAiComposer({
  studioCtx,
}: {
  studioCtx: StudioCtx;
}) {
  const { t } = useI18n();
  const { styles } = useStyles();
  const [draft, setDraft] = React.useState("");
  if (!studioCtx.canEditProject()) {
    return null;
  }
  const selected = studioCtx.focusedViewCtx()?.focusedTpl();
  const scope = selected
    ? ((isKnownTplComponent(selected) || isKnownTplTag(selected)) &&
        selected.name) ||
      summarizeTpl(selected)
    : t("Current canvas");
  // CopilotChatDialog is a public stub. Do not send prompts to a dialog that
  // cannot render a response, even when a project enables its copilot flag.
  const unavailable = t("AI editing is not available in this build.");
  return (
    <div
      className={styles.root}
      role="group"
      aria-label={t("AI canvas editing")}
      data-test-id="canvas-ai-composer"
    >
      <Tooltip title={scope}>
        <div className={styles.scope}>
          {icon("M12 2l3 7 7 3-7 3-3 7-3-7-7-3 7-3z")}
          <span>{scope}</span>
        </div>
      </Tooltip>
      <Input
        variant="borderless"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        aria-label={t("Describe what you want to change…")}
        placeholder={t("Describe what you want to change…")}
        aria-describedby="canvas-ai-availability"
      />
      <Tooltip title={unavailable}>
        <span className={styles.action}>
          <Button
            type="primary"
            disabled
            aria-label={t("Add AI context")}
            icon={icon("M12 4v16 M4 12h16")}
          />
        </span>
      </Tooltip>
      <Tooltip title={unavailable}>
        <span className={styles.action}>
          <Button
            type="primary"
            disabled
            aria-label={t("Send AI request")}
            icon={icon("M3 3l18 9-18 9 4-9z M7 12h14")}
          />
        </span>
      </Tooltip>
      <span id="canvas-ai-availability" className={styles.availability}>
        {unavailable}
      </span>
    </div>
  );
});
