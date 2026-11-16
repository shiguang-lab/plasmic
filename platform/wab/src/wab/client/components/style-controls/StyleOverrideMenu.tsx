import { shouldBeDisabled } from "@/wab/client/components/sidebar/sidebar-helpers";
import { changeStyle, ExpsProvider } from "@/wab/client/components/style-controls/StyleComponent";
import styles from "@/wab/client/components/style-controls/PaintRows.module.scss";
import { useStyleCells, useStyleIndicators } from "@/wab/client/studio-ctx/style-inputs-react";
import { useI18n } from "@/wab/client/i18n";
import { DownOutlined } from "@ant-design/icons";
import { Dropdown } from "antd";
import React from "react";

export function StyleOverrideMenu({ label, hasOverride, isNone, disabled, noneLabel, onCustom, onChange }: {
  label: string;
  hasOverride: boolean;
  isNone: boolean;
  disabled?: boolean;
  noneLabel?: string;
  onCustom?: () => void;
  onChange: (mode: "none" | "default") => void;
}) {
  const { t } = useI18n();
  const [open, setOpen] = React.useState(false);
  const none = noneLabel ?? t("None");
  const status = isNone ? none : t(hasOverride ? "Custom" : "Default");
  return (
    <Dropdown
      trigger={["click"]}
      placement="bottomRight"
      disabled={disabled}
      open={open && !disabled}
      onOpenChange={setOpen}
      menu={{
        items: [
          ...(onCustom ? [{ key: "custom", label: t("Custom"), disabled: hasOverride && !isNone }] : []),
          { key: "none", label: none, disabled: isNone },
          { key: "default", label: t("Restore default"), disabled: !hasOverride },
        ],
        onClick: ({ key }) => {
          setOpen(false);
          if (key === "custom") { onCustom?.(); }
          if (key === "none" || key === "default") { onChange(key); }
        },
      }}
    >
      <button type="button" className={styles.fillStatus} disabled={disabled}
        aria-label={`${label}: ${status}`} aria-haspopup="menu" aria-expanded={open && !disabled}>
        {status}<DownOutlined aria-hidden="true" />
      </button>
    </Dropdown>
  );
}

/** Default removes only the current target's overrides; none explicitly suppresses the effect. */
export function StyleOverrideControl({ expsProvider, label, styleProps, noneValues, noneLabel, customValues, onChange }: {
  expsProvider: ExpsProvider;
  label: string;
  styleProps: string[];
  noneValues: Record<string, string>;
  noneLabel?: string;
  customValues?: Record<string, string>;
  onChange?: () => void;
}) {
  const cells = useStyleCells(expsProvider, styleProps);
  const indicators = useStyleIndicators(expsProvider, styleProps);
  const { isDisabled } = shouldBeDisabled({ props: {}, indicators, label });
  const hasOverride = cells.some((cell) => cell.targetHas);
  const isNone = Object.entries(noneValues).every(([key, value]) =>
    cells.some((cell) => cell.key === key && cell.targetHas && cell.raw === value),
  );
  return <StyleOverrideMenu label={label} hasOverride={hasOverride} isNone={isNone}
    onCustom={customValues ? () => {
      onChange?.();
      changeStyle(expsProvider, () => {
        const exp = expsProvider.targetExp();
        Object.entries(customValues).forEach(([prop, value]) => exp.set(prop, value));
      });
    } : undefined}
    disabled={isDisabled} noneLabel={noneLabel} onChange={(mode) => {
      onChange?.();
      changeStyle(expsProvider, () => {
        const target = expsProvider.maybeTargetExp();
        styleProps.forEach((prop) => target?.clear(prop));
        if (mode === "none") {
          const exp = expsProvider.targetExp();
          Object.entries(noneValues).forEach(([prop, value]) => exp.set(prop, value));
        }
      });
    }} />;
}
