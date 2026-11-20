import { InspectorReadOnly } from "@/wab/client/components/studio/inspector-access";
import { shouldBeDisabled } from "@/wab/client/components/sidebar/sidebar-helpers";
import styles from "@/wab/client/components/sidebar-tabs/InteractionStylesPanelSection.module.scss";
import { changeStyle, ExpsProvider, StylePanelSection } from "@/wab/client/components/style-controls/StyleComponent";
import { StyleWrapper } from "@/wab/client/components/style-controls/StyleWrapper";
import { useI18n } from "@/wab/client/i18n";
import type { MessageKey } from "@/wab/client/i18n/locales";
import CursorSvgIcon from "@/wab/client/plasmic/plasmic_kit_icons/icons/PlasmicIcon__CursorSvg";
import CursorClickSvgIcon from "@/wab/client/plasmic/plasmic_kit_icons/icons/PlasmicIcon__CursorClickSvg";
import { useStyleCells, useStyleIndicators } from "@/wab/client/studio-ctx/style-inputs-react";
import { DownOutlined } from "@ant-design/icons";
import { Tooltip } from "antd";
import React from "react";

const cursors: [string, MessageKey][] = [
  ["auto", "Auto"], ["default", "Default"], ["pointer", "Pointer"],
  ["text", "Text"], ["move", "Move"], ["wait", "Wait"],
  ["grab", "Grab"], ["grabbing", "Grabbing"], ["not-allowed", "Not allowed"],
];

export function InteractionStylesPanelSection({ expsProvider }: { expsProvider: ExpsProvider }) {
  const { t } = useI18n();
  const [cursor, pointerEvents] = useStyleCells(expsProvider, ["cursor", "pointer-events"]);
  const indicators = useStyleIndicators(expsProvider, ["cursor", "pointer-events"]);
  const cursorControl = shouldBeDisabled({ props: {}, indicators: [indicators[0]], label: t("Cursor"), studioCtx: expsProvider.studioCtx });
  const pointerControl = shouldBeDisabled({ props: {}, indicators: [indicators[1]], label: t("Pointer events"), studioCtx: expsProvider.studioCtx });
  const inspecting = React.useContext(InspectorReadOnly);
  const interactive = pointerEvents?.value !== "none";
  return <StylePanelSection expsProvider={expsProvider} title={t("Interactions")}
    styleProps={["cursor", "pointer-events"]} headerMenuOnRightClickOnly>
    <div className={styles.row}>
      <StyleWrapper styleName="cursor" className={styles.cursor}>
        <Tooltip title={cursorControl.disabledTooltip || t("Cursor")}>
          <label className={styles.select}>
            <CursorSvgIcon className={styles.cursorIcon} aria-hidden />
            {inspecting ? <span>{t(cursors.find(([value]) => value === (cursor?.value ?? "auto"))?.[1] ?? "Auto")}</span> : <><select aria-label={t("Cursor")} value={cursor?.value ?? "auto"} disabled={cursorControl.isDisabled}
              onChange={event => {
                const value = event.target.value;
                changeStyle(expsProvider, () => expsProvider.mergedExp().set("cursor", value));
              }}>
              {cursors.map(([value, label]) => <option key={value} value={value}>{t(label)}</option>)}
            </select>
            <DownOutlined className={styles.chevron} aria-hidden /></>}
          </label>
        </Tooltip>
      </StyleWrapper>
      <StyleWrapper styleName="pointer-events" className={styles.pointer}>
        <Tooltip title={pointerControl.disabledTooltip || `${t("Pointer events")}: ${t(interactive ? "On" : "Off")}`}>
          {inspecting ? <span>{t(interactive ? "On" : "Off")}</span> : <button type="button" className={styles.toggle} aria-label={t("Pointer events")} aria-pressed={interactive}
            disabled={pointerControl.isDisabled}
            onClick={() => changeStyle(expsProvider, () => expsProvider.mergedExp().set("pointer-events", interactive ? "none" : "auto"))}>
            <CursorClickSvgIcon aria-hidden />
          </button>}
        </Tooltip>
      </StyleWrapper>
    </div>
  </StylePanelSection>;
}
