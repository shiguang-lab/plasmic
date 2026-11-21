import styles from "./AiModelDropdown.module.less";
import { useI18n } from "@/wab/client/i18n";
import type { LocalAiModel } from "@/wab/shared/copilot/local-edit";
import { DownOutlined } from "@ant-design/icons";
import { Scrollbar } from "@shiguang2/components/esm/scrollbar";
import { Dropdown } from "antd";
import * as React from "react";

export function AiModelDropdown({
  models,
  model,
  disabled,
  onChange,
  onOpen,
}: {
  models: LocalAiModel[];
  model: string;
  disabled?: boolean;
  onChange: (model: string) => void;
  onOpen?: () => void;
}) {
  const { t } = useI18n();

  const viewport = React.useRef<HTMLElement>(null);
  const [open, setOpen] = React.useState(false);
  return (
    <Dropdown
      trigger={["click"]}
      placement="topRight"
      disabled={disabled}
      open={open && !disabled}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (nextOpen) {
          onOpen?.();
        }
      }}
      autoFocus
      menu={{
        style: { maxHeight: "none", overflow: "visible" },
        items: models.map(({ id, name }) => ({
          key: id,
          label: <span className={styles.name}>{name || id}</span>,
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
        <span className={styles.name}>{models.find(option => option.id === model)?.name || model}</span>
        <DownOutlined />
      </button>
    </Dropdown>
  );
}
