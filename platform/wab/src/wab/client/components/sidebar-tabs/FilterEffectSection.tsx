import { shouldBeDisabled } from "@/wab/client/components/sidebar/sidebar-helpers";
import { FilterEffectIcon } from "@/wab/client/components/style-controls/FilterEffectIcon";
import { FilterEffectPanel } from "@/wab/client/components/style-controls/FilterEffectPanel";
import styles from "@/wab/client/components/style-controls/FilterEffectPanel.module.scss";
import paintStyles from "@/wab/client/components/style-controls/PaintRows.module.scss";
import { changeStyle, ExpsProvider, StylePanelSection } from "@/wab/client/components/style-controls/StyleComponent";
import { StyleEditorPopover } from "@/wab/client/components/style-controls/StyleEditorPopover";
import { ListBox, ListBoxItem } from "@/wab/client/components/widgets";
import { Icon } from "@/wab/client/components/widgets/Icon";
import IconButton from "@/wab/client/components/widgets/IconButton";
import PlusIcon from "@/wab/client/plasmic/plasmic_kit/PlasmicIcon__Plus";
import { useI18n } from "@/wab/client/i18n";
import type { MessageKey } from "@/wab/client/i18n/locales";
import { useStyleCells, useStyleIndicators } from "@/wab/client/studio-ctx/style-inputs-react";
import { arrayMoveIndex } from "@/wab/shared/collections";
import { defaultFilterEffects, FilterEffect, fromFilterObjToString, fromFilterStringToObj, getFilterEffectLabel } from "@/wab/shared/core/filter-effect-utils";
import { joinCssValues, splitCssValue } from "@/wab/shared/css/parse";
import { Dropdown } from "antd";
import React from "react";

const properties = ["filter", "backdrop-filter"] as const;
type FilterProperty = typeof properties[number];
const titles: Record<FilterProperty, MessageKey> = { filter: "Layer filter", "backdrop-filter": "Backdrop filter" };
const additions: { prop: FilterProperty; type: "blur" | "brightness"; label: MessageKey }[] = [
  { prop: "filter", type: "blur", label: "Layer blur" },
  { prop: "backdrop-filter", type: "blur", label: "Backdrop blur" },
  { prop: "filter", type: "brightness", label: "Layer filter" },
  { prop: "backdrop-filter", type: "brightness", label: "Backdrop filter" },
];

export function FilterEffectsPanelSection({ expsProvider }: { expsProvider: ExpsProvider }) {
  const lifetime = React.useMemo(() => expsProvider.studioCtx.arenaState.lifetime(), [expsProvider]);
  const subscribe = React.useCallback((notify: () => void) => {
    lifetime.addEventListener("abort", notify);
    return () => lifetime.removeEventListener("abort", notify);
  }, [lifetime]);
  const active = React.useSyncExternalStore(subscribe, () => !lifetime.aborted);
  return active ? <FilterEffectsContent expsProvider={expsProvider} /> : null;
}

function FilterEffectsContent({ expsProvider }: { expsProvider: ExpsProvider }) {
  const { t } = useI18n();
  const cells = useStyleCells(expsProvider, properties);
  const indicators = useStyleIndicators(expsProvider, properties);
  const [inspected, setInspected] = React.useState<{ prop: FilterProperty; index: number }>();
  const [adding, setAdding] = React.useState(false);
  const chains = properties.map((prop, i) => {
    const raw = cells[i]?.raw;
    const none = raw === "none";
    const filters = !raw || none ? [] : splitCssValue(prop, raw).map(fromFilterStringToObj);
    const { isDisabled } = shouldBeDisabled({ props: {}, indicators: [indicators[i]], label: t(titles[prop]), studioCtx: expsProvider.studioCtx });
    return { prop, filters, none, disabled: isDisabled };
  });
  const write = (prop: FilterProperty, filters: FilterEffect[]) => changeStyle(expsProvider, () => {
    expsProvider.mergedExp().set(prop, filters.length ? joinCssValues(prop, filters.map(fromFilterObjToString)) : "none");
  });
  return <StylePanelSection expsProvider={expsProvider} title={t("Effects")} styleProps={[...properties]} headerMenuOnRightClickOnly
    controls={<Dropdown trigger={["click"]} open={adding} onOpenChange={setAdding} menu={{
      items: additions.map((item, index) => ({ key: String(index), label: t(item.label), disabled: chains.some(chain => chain.prop === item.prop && (chain.none || chain.disabled)) })),
      onClick: ({ key }) => {
        const item = additions[Number(key)];
        const chain = chains.find(candidate => candidate.prop === item.prop);
        if (!chain || chain.disabled || chain.none) { return; }
        write(item.prop, [...chain.filters, defaultFilterEffects[item.type]]);
        setInspected({ prop: item.prop, index: chain.filters.length });
        setAdding(false);
      },
    }}><IconButton size="small" aria-label={t("Add effect")} tooltip={t("Add effect")}><Icon icon={PlusIcon} /></IconButton></Dropdown>}>
    {chains.some(chain => chain.none || chain.filters.length > 0) && <div className={styles.list}>
      {chains.map(({ prop, filters, none, disabled }) => {
        const rows: (FilterEffect | null)[] = none ? [null] : filters;
        const reorder = (from: number, to: number) => {
          if (disabled || from === to || !filters[from] || !filters[to]) { return; }
          write(prop, arrayMoveIndex(filters, from, to));
          setInspected(current => current?.prop === prop ? { prop, index: current.index === from ? to : from < current.index && to >= current.index ? current.index - 1 : from > current.index && to <= current.index ? current.index + 1 : current.index } : current);
        };
        return rows.length > 0 && <ListBox key={prop} onReorder={reorder}>
          {rows.map((effect, index) => <ListBoxItem key={index} index={index} className={paintStyles.fillItem}
            disabled={disabled} isDragDisabled={disabled || rows.length < 2} clickable={false} truncate={false}
            removeLabel={effect ? t("Remove") : t("Remove None override")}
            onRemove={() => {
              if (disabled) { return; }
              setInspected(undefined);
              if (effect && filters.length > 1) { write(prop, filters.filter((_, i) => i !== index)); }
              else { changeStyle(expsProvider, () => expsProvider.maybeTargetExp()?.clear(prop)); }
            }}
            mainContent={
              <div className={paintStyles.fillValue}>
                <StyleEditorPopover title={t(titles[prop])} open={!disabled && inspected?.prop === prop && inspected.index === index}
                  onOpenChange={open => setInspected(open ? { prop, index } : undefined)}
                  content={<FilterEffectPanel studioCtx={expsProvider.studioCtx} filterEffect={effect}
                    onChange={next => {
                      if (disabled) { return; }
                      write(prop, next ? effect ? filters.map((current, i) => i === index ? next : current) : [next] : []);
                      if (!next) { setInspected({ prop, index: 0 }); }
                    }} />}>
                  <button className={paintStyles.fillEdit} type="button" disabled={disabled}
                    aria-label={`${t(titles[prop])}: ${effect ? t(getFilterEffectLabel(effect.type)) : t("None")}`}
                    onKeyDown={event => {
                      if (event.altKey && ["ArrowUp", "ArrowDown"].includes(event.key)) { event.preventDefault(); reorder(index, index + (event.key === "ArrowUp" ? -1 : 1)); }
                    }}>
                    <FilterEffectIcon type={effect?.type ?? "none"} backdrop={prop === "backdrop-filter"} className={styles.kind} />
                    <span className={paintStyles.fillLabel}>{effect ? t(prop === "filter" ? "Layer effect name" : "Backdrop effect name", { effect: t(getFilterEffectLabel(effect.type)) }) : t(titles[prop])}</span>
                  </button>
                </StyleEditorPopover>
              </div>
            } />)}
        </ListBox>;
      })}
    </div>}
  </StylePanelSection>;
}
