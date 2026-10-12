import { useI18n } from "@/wab/client/i18n";
import { Scrollbar } from "@shiguang2/components/esm/scrollbar";
import { Select } from "antd";
import { createStyles } from "antd-style";
import * as React from "react";

const useStyles = createStyles(({ token }) => ({
  model: {
    width: 140,
    flexShrink: 1,
    minWidth: 0,
    "& .ant-select": { width: "100%", fontSize: 12 },
    "& .ant-select-content": {
      color: token.colorTextSecondary,
      textAlign: "right",
    },
    "&& .ant-select.ant-select-borderless, && .ant-select.ant-select-borderless:focus-within, & input:focus, & input:focus-visible":
      {
        outline: "none",
        boxShadow: "none",
        borderColor: "transparent",
      },
  },
}));

export function AiModelSelect({
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
  return (
    <div className={styles.model}>
      <Select
        aria-label={t("AI model")}
        size="small"
        variant="borderless"
        value={model}
        options={models.map((id) => ({ value: id, label: id }))}
        onChange={onChange}
        disabled={disabled}
        popupMatchSelectWidth={false}
        virtual={false}
        listHeight={0}
        popupRender={(menu) => (
          <Scrollbar
            ref={viewport}
            scrollX={false}
            defer={false}
            style={{ maxHeight: 240 }}
          >
            {menu}
          </Scrollbar>
        )}
        onInputKeyDown={() =>
          requestAnimationFrame(() =>
            viewport.current
              ?.querySelector(".ant-select-item-option-active")
              ?.scrollIntoView({ block: "nearest" }),
          )
        }
      />
    </div>
  );
}
