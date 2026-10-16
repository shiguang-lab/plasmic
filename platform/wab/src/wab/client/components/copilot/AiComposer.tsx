import {
  AiAttachmentList,
  AiAttachmentPicker,
  useAiAttachments,
} from "@/wab/client/components/copilot/AiAttachments";
import { AiModelSelect } from "@/wab/client/components/copilot/AiModelSelect";
import { useI18n } from "@/wab/client/i18n";
import { StopOutlined } from "@ant-design/icons";
import { Scrollbar } from "@shiguang2/components/esm/scrollbar";
import { Button, Tooltip } from "antd";
import { createStyles } from "antd-style";
import * as React from "react";

interface AiComposerProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  attachmentState: ReturnType<typeof useAiAttachments>;
  scope: string;
  models?: string[];
  model?: string | null;
  onModelChange: (model: string) => void;
  disabled?: boolean;
  canSubmit: boolean;
  running?: boolean;
  onStop?: () => void;
  stopDisabled?: boolean;
  placeholder?: string;
  availability?: string;
  ariaLabel?: string;
  testId?: string;
  inputTestId?: string;
}

const useStyles = createStyles(({ token }) => ({
  root: {
    position: "relative",
    width: "100%",
    boxSizing: "border-box",
    padding: 7,
    display: "grid",
    gridTemplateColumns: "auto minmax(0, 1fr) auto",
    alignItems: "center",
    gap: 6,
    background: token.colorBgContainer,
    color: token.colorText,
    fontWeight: 400,
    border: `1px solid ${token.colorBorder}`,
    borderRadius: 23,
    boxShadow: token.boxShadowSecondary,
    "& svg[data-ai-composer-icon]": {
      width: 16,
      height: 16,
      fill: "none",
      stroke: "currentColor",
      strokeWidth: 1.6,
      strokeLinecap: "round",
      strokeLinejoin: "round",
    },
    "&:has([contenteditable]:focus)": {
      borderColor: token.colorPrimary,
      boxShadow: "none",
    },
    "&[data-expanded=true]": {
      borderRadius: 16,
      gridTemplateColumns: "auto minmax(0, 1fr)",
      "& [data-composer-part=input]": { gridColumn: "1 / -1", gridRow: 1 },
      "& [data-composer-part=attachments]": { gridColumn: 1, gridRow: 2 },
      "& [data-composer-part=actions]": { gridColumn: 2, gridRow: 2 },
    },
  },
  scope: {
    float: "left",
    marginRight: 6,
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    padding: "0 6px",
    borderRadius: 5,
    background: token.colorPrimaryBg,
    color: token.colorPrimaryText,
    fontSize: 11,
    lineHeight: "22px",
    maxWidth: "min(100px, 100%)",
    boxSizing: "border-box",
    justifySelf: "start",
    minWidth: 0,
    flexShrink: 1,
    "& span": {
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
    },
    "& svg": { flexShrink: 0, width: 12, height: 12 },
  },
  input: { minWidth: 0, maxHeight: 160, gridColumn: 2, gridRow: 1 },
  content: {
    display: "flow-root",
    padding: "2px 0",
    fontSize: 13,
    lineHeight: "22px",
  },
  editor: {
    minHeight: 22,
    whiteSpace: "pre-wrap",
    overflowWrap: "anywhere",
    outline: "none",
    "&[data-empty=true]": {
      position: "relative",
      overflow: "hidden",
      "&::before": {
        content: "attr(data-placeholder)",
        position: "absolute",
        inset: 0,
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
        color: token.colorTextPlaceholder,
        pointerEvents: "none",
      },
    },
  },
  attachmentList: { gridColumn: "1 / -1", minWidth: 0 },
  measurement: {
    position: "absolute",
    visibility: "hidden",
    pointerEvents: "none",
    whiteSpace: "pre",
    fontSize: 13,
  },
  actions: {
    width: "100%",
    maxWidth: 152,
    justifySelf: "end",
    justifyContent: "flex-end",
    display: "flex",
    alignItems: "center",
    gap: 6,
    minWidth: 0,
  },
  action: {
    display: "inline-flex",
    flexShrink: 0,
    "& .ant-btn": {
      width: 30,
      height: 30,
      padding: 0,
      boxShadow: "none",
      borderRadius: "50%",
    },
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
    <svg data-ai-composer-icon="" viewBox="0 0 24 24" aria-hidden="true">
      <path d={path} />
    </svg>
  );
}

export function AiComposer({
  value,
  onChange,
  onSubmit,
  attachmentState,
  scope,
  models,
  model,
  onModelChange,
  disabled = false,
  canSubmit,
  running = false,
  onStop,
  stopDisabled,
  placeholder,
  availability,
  ariaLabel,
  testId,
  inputTestId,
}: AiComposerProps) {
  const { t } = useI18n();
  const { styles } = useStyles();
  const availabilityId = React.useId();
  const locked = disabled || running;
  const ready =
    !locked && canSubmit && !!value.trim() && !attachmentState.reading;
  const submit = () => {
    if (ready) {
      onSubmit();
    }
  };
  const [expanded, setExpanded] = React.useState(false);
  const rootRef = React.useRef<HTMLDivElement>(null);
  const editorRef = React.useRef<HTMLDivElement>(null);
  const measurementRef = React.useRef<HTMLSpanElement>(null);
  React.useLayoutEffect(() => {
    const editor = editorRef.current;
    if (editor && editor.innerText !== value) {
      editor.innerText = value;
    }
  }, [value]);
  React.useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) {
      return;
    }
    const measure = () => {
      if (value.includes("\n")) {
        setExpanded(true);
        return;
      }
      if (!root.clientWidth) {
        setExpanded(false);
        return;
      }
      const parts = ["attachments", "scope", "actions"].map((part) =>
        root.querySelector<HTMLElement>(`[data-composer-part=${part}]`),
      );
      const style = getComputedStyle(root);
      const compactWidth =
        root.clientWidth -
        parseFloat(style.paddingLeft) -
        parseFloat(style.paddingRight) -
        3 * parseFloat(style.columnGap) -
        parts.reduce((width, part) => width + (part?.offsetWidth ?? 0), 0);
      setExpanded(
        compactWidth < 80 ||
          (measurementRef.current?.offsetWidth ?? 0) > compactWidth,
      );
    };
    measure();
    const resizeObserver = new ResizeObserver(measure);
    resizeObserver.observe(root);
    root
      .querySelectorAll<HTMLElement>(
        "[data-composer-part=scope], [data-composer-part=actions]",
      )
      .forEach((part) => resizeObserver.observe(part));
    return () => resizeObserver.disconnect();
  }, [value]);
  return (
    <div
      ref={rootRef}
      data-expanded={expanded}
      className={styles.root}
      role="group"
      aria-label={ariaLabel}
      data-test-id={testId}
      onPaste={!locked ? attachmentState.onPaste : undefined}
      onDragOver={!locked ? attachmentState.onDragOver : undefined}
      onDrop={!locked ? attachmentState.onDrop : undefined}
    >
      <span className={styles.action} data-composer-part="attachments">
        <AiAttachmentPicker state={attachmentState} disabled={locked} />
      </span>
      <Scrollbar
        className={styles.input}
        scrollX={false}
        defer={false}
        data-composer-part="input"
      >
        <div className={styles.content}>
          <Tooltip title={scope}>
            <span
              className={styles.scope}
              data-composer-part="scope"
              contentEditable={false}
            >
              {icon("M12 2l3 7 7 3-7 3-3 7-3-7-7-3 7-3z")}
              <span>{scope}</span>
            </span>
          </Tooltip>
          <div
            ref={editorRef}
            className={styles.editor}
            role="textbox"
            aria-multiline="true"
            contentEditable={locked ? false : "plaintext-only"}
            aria-disabled={locked}
            tabIndex={locked ? -1 : 0}
            data-empty={!value}
            data-placeholder={
              placeholder ?? t("Describe changes or a new page…")
            }
            onInput={(event) => {
              if (!locked) {
                const editor = event.currentTarget;
                // Browsers leave a lone <br> after deleting all editable text.
                onChange(
                  editor.innerText === "\n" && !editor.textContent
                    ? ""
                    : editor.innerText,
                );
              }
            }}
            onKeyDown={(event) => {
              if (
                event.key === "Enter" &&
                !event.shiftKey &&
                !event.nativeEvent.isComposing
              ) {
                event.preventDefault();
                submit();
              }
            }}
            aria-label={t("Describe changes or a new page…")}
            data-test-id={inputTestId}
            aria-describedby={availabilityId}
          />
        </div>
      </Scrollbar>
      <div className={styles.actions} data-composer-part="actions">
        {model && (
          <AiModelSelect
            models={models ?? []}
            model={model}
            disabled={locked}
            onChange={onModelChange}
          />
        )}
        <Tooltip
          title={
            running ? t("Stop AI task") : (availability ?? t("Send AI request"))
          }
        >
          <span className={styles.action}>
            {running ? (
              <Button
                aria-label={t("Stop AI task")}
                icon={<StopOutlined />}
                onClick={onStop}
                disabled={stopDisabled}
              />
            ) : (
              <Button
                type="primary"
                disabled={!ready}
                onClick={submit}
                aria-label={t("Send AI request")}
                icon={icon("M12 19V5 M5 12l7-7 7 7")}
              />
            )}
          </span>
        </Tooltip>
      </div>
      {(attachmentState.attachments.length > 0 || attachmentState.error) && (
        <div className={styles.attachmentList}>
          <AiAttachmentList
            attachments={attachmentState.attachments}
            error={attachmentState.error}
            disabled={locked || attachmentState.reading}
            onRemove={(index) =>
              attachmentState.setAttachments(
                attachmentState.attachments.filter((_, i) => i !== index),
              )
            }
          />
        </div>
      )}
      <span
        ref={measurementRef}
        className={styles.measurement}
        aria-hidden="true"
      >
        {value}
      </span>
      <span id={availabilityId} className={styles.availability}>
        {availability ?? t("AI edits the current selection or page.")}
      </span>
    </div>
  );
}
