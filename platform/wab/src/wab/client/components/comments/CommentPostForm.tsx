import { useUserMentions } from "@/wab/client/components/user-mentions/useUserMentions";
import { showError } from "@/wab/client/ErrorNotifications";
import { useI18n } from "@/wab/client/i18n";
import type { DefaultCommentPostFormProps } from "@/wab/client/plasmic/plasmic_kit_comments/PlasmicCommentPostForm";
import { ArrowUpOutlined } from "@ant-design/icons";
import { Scrollbar } from "@shiguang2/components/esm/scrollbar";
import { Button, Flex, Input, Tooltip } from "antd";
import { createStyles } from "antd-style";
import * as React from "react";
import { createPortal } from "react-dom";

const useStyles = createStyles(({ token }) => ({
  root: { minWidth: 0, width: "100%" },
  input: {
    border: `1px solid ${token.colorBorder}`,
    borderRadius: token.borderRadius,
    background: token.colorFillQuaternary,
    "&:focus-within": {
      borderColor: token.colorPrimary,
      boxShadow: `0 0 0 2px ${token.colorPrimaryBg}`,
    },
    "& textarea.ant-input": {
      overflow: "hidden",
      resize: "none",
      border: 0,
      background: "transparent",
      boxShadow: "none",
      padding: "10px 12px",
      fontSize: 12,
    },
  },
  toolbar: { padding: "4px 8px 8px" },
  hint: { color: token.colorTextSecondary, fontSize: 11 },
  footer: {
    marginTop: 5,
    textAlign: "right",
    color: token.colorTextSecondary,
    fontSize: 11,
  },
}));

export type CommentPostFormProps = DefaultCommentPostFormProps & {
  id: string;
  initialRows: number;
  defaultValue: string;
  onChange?: (value: string) => void;
  onCancel?: () => void;
  onSubmit?: (value: string) => void | Promise<void>;
};

export default function CommentPostForm({
  id,
  defaultValue,
  initialRows,
  onSubmit,
  onCancel,
  isEditing,
  onChange,
  className,
}: CommentPostFormProps) {
  const { t } = useI18n();
  const { styles, cx } = useStyles();
  const [value, setValue] = React.useState(defaultValue);
  const [submitting, setSubmitting] = React.useState(false);
  const inputElementId = `comment-post-input-${id}`;
  const {
    onKeyHandler,
    onSelectHandler,
    userMentionsPopover,
    handleMentionClick,
  } = useUserMentions({ value, inputSelector: `#${inputElementId}` });
  const valid =
    !!value.trim() && (!isEditing || value.trim() !== defaultValue.trim());
  const submit = async () => {
    if (!valid || submitting) {
      return;
    }
    setSubmitting(true);
    return Promise.resolve()
      .then(() => onSubmit?.(value.trim()))
      .then(() => {
        setValue("");
        onChange?.("");
      })
      .catch((error) => showError(error, { title: "Failed to send comment" }))
      .finally(() => setSubmitting(false));
  };
  return (
    <div className={cx(styles.root, className)}>
      <div className={styles.input}>
        <Scrollbar scrollX={false} style={{ maxHeight: 160, minHeight: 0 }}>
          <Input.TextArea
            id={inputElementId}
            value={value}
            disabled={submitting}
            autoComplete="off"
            placeholder={t("Add a comment")}
            aria-label={t("Add a comment")}
            autoSize={{ minRows: initialRows }}
            data-test-id="comment-post-text-area"
            onChange={(e) => {
              setValue(e.target.value);
              onChange?.(e.target.value);
            }}
            onSelect={onSelectHandler}
            onKeyDown={(e) => {
              onKeyHandler(e);
              if (
                !e.defaultPrevented &&
                e.key === "Enter" &&
                !e.shiftKey &&
                !e.nativeEvent.isComposing &&
                e.keyCode !== 229
              ) {
                e.preventDefault();
                void submit();
              }
            }}
          />
        </Scrollbar>
        <Flex align="center" gap={8} className={styles.toolbar}>
          <Tooltip title={t("Mention someone")}>
            <Button
              type="text"
              size="small"
              aria-label={t("Mention someone")}
              onClick={handleMentionClick}
            >
              @
            </Button>
          </Tooltip>
          {isEditing && (
            <Button type="text" size="small" onClick={onCancel}>
              {t("Cancel")}
            </Button>
          )}
          <span className={styles.hint} style={{ marginInlineStart: "auto" }}>
            {t("Enter to send")}
          </span>
          <Button
            type="primary"
            size="small"
            icon={<ArrowUpOutlined />}
            iconPlacement="end"
            aria-label={t(isEditing ? "Save" : "Send")}
            disabled={!valid}
            loading={submitting}
            data-test-id="comment-post-submit-button"
            onClick={() => void submit()}
          >
            {t(isEditing ? "Save" : "Send")}
          </Button>
        </Flex>
      </div>
      <div className={styles.footer}>{t("Shift+Enter for a new line")}</div>
      {createPortal(userMentionsPopover, document.body)}
    </div>
  );
}
