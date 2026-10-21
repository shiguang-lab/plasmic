import { useI18n } from "@/wab/client/i18n";
import { DownOutlined } from "@ant-design/icons";
import { Scrollbar } from "@shiguang2/components/esm/scrollbar";
import { Dropdown } from "antd";
import { createStyles } from "antd-style";
import * as React from "react";

const useStyles = createStyles(({ token }) => ({
  model: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "2px 4px",
    minHeight: 24,
    border: 0,
    borderRadius: token.borderRadiusSM,
    background: "transparent",
    color: token.colorTextSecondary,
    fontSize: 11,
    fontFamily: "inherit",
    lineHeight: "20px",
    cursor: "pointer",
    flexShrink: 1,
    minWidth: 0,
    "&:hover:not(:disabled)": { color: token.colorText },
    "&:disabled": { cursor: "not-allowed", color: token.colorTextDisabled },
    "& > .anticon": { flexShrink: 0, fontSize: 10 },
  },
  name: {
    minWidth: 0,
    overflowWrap: "anywhere",
    whiteSpace: "normal",
    textAlign: "left",
  },
  menu: { maxWidth: "calc(100vw - 16px)" },
}));

export function AiModelDropdown({
  models,
  model,
  disabled,
  onChange,
}: {
  models: string[];
  model: string;
  disabled?: boolean;
  onChange: (model: string) => void;
}) {
  const { t } = useI18n();
  const { styles } = useStyles();
  const viewport = React.useRef<HTMLElement>(null);
  const [open, setOpen] = React.useState(false);
  return (
    <Dropdown
      trigger={["click"]}
      placement="topRight"
      disabled={disabled}
      open={open && !disabled}
      onOpenChange={setOpen}
      autoFocus
      menu={{
        style: { maxHeight: "none", overflow: "visible" },
        items: models.map((id) => ({
          key: id,
          label: <span className={styles.name}>{id}</span>,
        })),
        selectable: true,
        selectedKeys: [model],
        onClick: ({ key }) => {
          onChange(key);
          setOpen(false);
        },
      }}
      popupRender={(menu) => (
        <Scrollbar
          ref={viewport}
          className={styles.menu}
          scrollX={false}
          defer={false}
          style={{ maxHeight: "min(240px, calc(100vh - 16px))" }}
          onKeyDown={() =>
            requestAnimationFrame(() =>
              viewport.current
                ?.querySelector(".ant-dropdown-menu-item-active")
                ?.scrollIntoView({ block: "nearest" }),
            )
          }
        >
          {menu}
        </Scrollbar>
      )}
    >
      <button
        type="button"
        className={styles.model}
        aria-label={t("AI model")}
        aria-haspopup="menu"
        aria-expanded={open && !disabled}
        disabled={disabled}
      >
        <span className={styles.name}>{model}</span>
        <DownOutlined />
      </button>
    </Dropdown>
  );
}
