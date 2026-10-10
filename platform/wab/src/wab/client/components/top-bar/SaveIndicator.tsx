import { useI18n } from "@/wab/client/i18n";
import { useStudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import {
  ClockCircleOutlined,
  ExclamationCircleOutlined,
  EyeOutlined,
  LoadingOutlined,
} from "@ant-design/icons";
import { Button, Tooltip } from "antd";
import { createStyles } from "antd-style";
import { observer } from "mobx-react";
import * as React from "react";

export interface SaveIndicatorProps {
  className?: string;
}

const useStyles = createStyles(({ token }) => ({
  root: {
    display: "flex",
    alignItems: "center",
    flexShrink: 0,
    color: token.colorTextSecondary,
    fontSize: 12,
    "&[data-save-state='error'], &[data-save-state='blocked']": {
      color: token.colorError,
    },
    "&[data-save-state='pending'], &[data-save-state='unlogged']": {
      color: token.colorWarning,
    },
    "&[data-save-state='saved']": { color: token.colorSuccess },
    "& .save-indicator-dot": {
      width: 6,
      height: 6,
      flexShrink: 0,
      borderRadius: "50%",
      background: "currentColor",
    },
    "&[data-save-state='saving']": { color: token.colorPrimary },
    "& .save-indicator-content": {
      display: "inline-flex",
      alignItems: "center",
      gap: 6,
    },
    "& .save-indicator-label": {
      maxWidth: 140,
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
    },
    "& .ant-btn": { color: "inherit", paddingInline: 4, height: 28 },
    "@media (max-width: 1100px)": {
      "& .save-indicator-label": { display: "none" },
    },
  },
}));

const SaveIndicator = observer(
  React.forwardRef<HTMLDivElement, SaveIndicatorProps>(
    function SaveIndicator(props, ref) {
      const { t } = useI18n();
      const { styles, cx } = useStyles();
      const studioCtx = useStudioCtx();
      const status = studioCtx.canEditProject()
        ? studioCtx.saveStatus
        : "readonly";
      const labels = {
        saved: t("Saved"),
        pending: t("Pending changes"),
        saving: t("Saving…"),
        error: t("Save failed. Click to retry."),
        blocked: t("Saving blocked. Resolve the issue above."),
        unlogged: t("Unlogged changes"),
        readonly: t("Read-only"),
      };
      const icons = {
        saved: <span className="save-indicator-dot" aria-hidden="true" />,
        pending: <ClockCircleOutlined />,
        saving: <LoadingOutlined spin />,
        error: <ExclamationCircleOutlined />,
        blocked: <ExclamationCircleOutlined />,
        unlogged: <ClockCircleOutlined />,
        readonly: <EyeOutlined />,
      };
      const canRetry = status === "error" && studioCtx.canSave();
      const content = (
        <span className="save-indicator-content">
          {icons[status]}
          <span className="save-indicator-label">{labels[status]}</span>
        </span>
      );
      return (
        <Tooltip title={labels[status]}>
          <div
            ref={ref}
            className={cx(props.className, styles.root)}
            role="status"
            aria-label={labels[status]}
            aria-live="polite"
            data-save-state={status}
          >
            {canRetry ? (
              <Button
                type="text"
                size="small"
                aria-label={labels[status]}
                onClick={() => {
                  void studioCtx.save();
                }}
              >
                {content}
              </Button>
            ) : (
              content
            )}
          </div>
        </Tooltip>
      );
    },
  ),
);

export default SaveIndicator;
