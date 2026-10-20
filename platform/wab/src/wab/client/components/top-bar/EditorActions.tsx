import { useI18n } from "@/wab/client/i18n";
import type { MessageKey } from "@/wab/client/i18n/locales";
import { HistoryOutlined } from "@ant-design/icons";
import { Button, type ButtonProps } from "antd";
import * as React from "react";

const actionPaths = {
  Undo: "M9 5L4 10l5 5 M4 10h10a6 6 0 0 1 0 12",
  Redo: "M15 5l5 5-5 5 M20 10H10a6 6 0 0 0 0 12",
  Comments: "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z",
  Preview: "M8 21h8 M12 17v4",
  Present: "M6 4.5a1.5 1.5 0 0 1 2.25-1.3l12 7.5a1.5 1.5 0 0 1 0 2.6l-12 7.5A1.5 1.5 0 0 1 6 19.5z",
  Code: "M8 6l-6 6 6 6 M16 6l6 6-6 6 M14 3l-4 18",
} satisfies Partial<Record<MessageKey, string>>;

export const EditorIconAction = React.forwardRef<
  HTMLButtonElement,
  ButtonProps & { action: keyof typeof actionPaths | "Published versions" }
>(function EditorIconAction({ action, ...props }, ref) {
  const { t } = useI18n();
  return (
    <Button
      ref={ref}
      type="text"
      className="editor-icon-action"
      aria-label={t(action)}
      icon={
        action === "Published versions" ? (
          <HistoryOutlined aria-hidden />
        ) : (
          <svg viewBox="0 0 24 24" aria-hidden="true">
            {action === "Preview" && (
              <rect x="2" y="3" width="20" height="14" rx="2" />
            )}
            <path d={actionPaths[action]} />
          </svg>
        )
      }
      {...props}
    />
  );
});

export const EditorViewButton = React.forwardRef<
  HTMLButtonElement,
  ButtonProps
>(function EditorViewButton(props, ref) {
  const { t } = useI18n();
  return (
    <Button
      ref={ref}
      type="text"
      aria-label={t("View")}
      id="view-menu"
      {...props}
    >
      {t("View")}
      <svg
        viewBox="0 0 24 24"
        aria-hidden="true"
        className="editor-view-chevron"
      >
        <path d="M6 9l6 6 6-6" />
      </svg>
    </Button>
  );
});
