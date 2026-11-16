import { FullRow, LabeledItem, LabeledItemRow } from "@/wab/client/components/sidebar/sidebar-helpers";
import { ColorButton } from "@/wab/client/components/style-controls/ColorButton";
import styles from "@/wab/client/components/style-controls/FilterEffectPanel.module.scss";
import StyleSelect from "@/wab/client/components/style-controls/StyleSelect";
import DimTokenSpinner from "@/wab/client/components/widgets/DimTokenSelector";
import { useI18n } from "@/wab/client/i18n";
import { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { FilterEffect, FilterEffectType, defaultFilterEffects, filterEffectEditorConfig, getFilterEffectLabel } from "@/wab/shared/core/filter-effect-utils";
import { parseCssNumericNew } from "@/wab/shared/css";
import { LENGTH_UNITS } from "@/wab/shared/css/types";
import { Slider } from "antd";
import React from "react";

interface FilterEffectPanelProps {
  studioCtx: StudioCtx;
  filterEffect: FilterEffect | null;
  onChange: (newFilterEffect: FilterEffect | null) => void;
}

export function FilterEffectPanel({ studioCtx, filterEffect, onChange }: FilterEffectPanelProps) {
  const { t } = useI18n();
  React.useEffect(() => () => studioCtx.stopUnlogged(), [studioCtx]);
  const update = (index: number, value: string) => {
    if (!filterEffect) { return; }
    const args = [...filterEffect.args];
    args[index] = value;
    onChange({ ...filterEffect, args });
  };
  const config = filterEffect && filterEffect.type !== "drop-shadow" ? filterEffectEditorConfig[filterEffect.type] : undefined;
  const parsed = filterEffect ? parseCssNumericNew(filterEffect.args[0]) : undefined;
  return <>
    <LabeledItemRow label={t("Type")} labelSize="small">
        <StyleSelect aria-label={t("Effect type")} value={filterEffect?.type ?? "none"} valueSetState="isSet"
          onChange={value => {
            if (!value) { return; }
            const type = value as FilterEffectType | "none";
            onChange(type === "none" ? null : { ...defaultFilterEffects[type], visible: filterEffect?.visible ?? true });
          }}>
          {Object.keys(defaultFilterEffects).map(type => <StyleSelect.Option key={type} value={type}>{t(getFilterEffectLabel(type as FilterEffectType))}</StyleSelect.Option>)}
          <StyleSelect.Option value="none">{t("None")}</StyleSelect.Option>
        </StyleSelect>
    </LabeledItemRow>
    {filterEffect && (filterEffect.type === "drop-shadow" ? <>
      <FullRow className={styles.metrics} autoHeight>
        {(["Left", "Top", "Blur"] as const).map((label, index) => <LabeledItem key={label} label={t(label)} labelSize="small">
          <DimTokenSpinner value={filterEffect.args[index]} studioCtx={studioCtx}
            fieldAriaProps={{ "aria-label": t(label) }} noClear allowedUnits={LENGTH_UNITS} allowFunctions
            min={index === 2 ? 0 : undefined} onChange={value => value && update(index, value)} />
        </LabeledItem>)}
      </FullRow>
      <LabeledItemRow label={t("Color")} labelSize="small">
        <ColorButton color={filterEffect.args[3]} sc={studioCtx} onChange={color => update(3, color)}
          floatingPicker showValue aria-label={t("Color")} />
      </LabeledItemRow>
    </> : config && <LabeledItemRow label={t(config.label)} labelSize="small">
      <div className={styles.amount}>
      <Slider className={styles.slider} included={false} min={0} max={config.max} step={filterEffect.type === "blur" ? 0.1 : 1}
        disabled={!parsed} value={parsed?.num ?? 0}
        onChange={value => {
          if (!parsed) { return; }
          studioCtx.startUnlogged();
          update(0, `${value}${parsed.units}`);
        }} onAfterChange={() => studioCtx.stopUnlogged()} />
      <DimTokenSpinner value={filterEffect.args[0]} studioCtx={studioCtx}
        fieldAriaProps={{ "aria-label": t(config.label) }} noClear
        allowedUnits={config.allowedUnits} min={0} allowFunctions
        onChange={value => value && update(0, value)} />
      </div>
    </LabeledItemRow>)}
  </>;
}
