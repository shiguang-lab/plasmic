import { LabeledToggleButtonGroupItemRow } from "@/wab/client/components/sidebar/sidebar-helpers";
import StyleToggleButton from "@/wab/client/components/style-controls/StyleToggleButton";
import { useI18n } from "@/wab/client/i18n";
import styles from "@/wab/client/components/style-controls/PaintRows.module.scss";
import type { Side } from "@/wab/shared/geom";
import React from "react";

export function LabeledLineStyleToggleButtonGroupItemRow(
  props: Omit<
    React.ComponentProps<typeof LabeledToggleButtonGroupItemRow>,
    "children"
  >,
) {
  const { t } = useI18n();
  return (
    <LabeledToggleButtonGroupItemRow {...props}>
      <StyleToggleButton
        className={styles.lineStyleButton}
        value="none"
        tooltip={t("None")}
        stretched
      >
        <LineStyleIcon lineStyle="none" />
      </StyleToggleButton>
      <StyleToggleButton
        className={styles.lineStyleButton}
        value="dotted"
        tooltip={t("Dotted")}
        stretched
      >
        <LineStyleIcon lineStyle="dotted" />
      </StyleToggleButton>
      <StyleToggleButton
        className={styles.lineStyleButton}
        value="dashed"
        tooltip={t("Dashed")}
        stretched
      >
        <LineStyleIcon lineStyle="dashed" />
      </StyleToggleButton>
      <StyleToggleButton
        className={styles.lineStyleButton}
        value="solid"
        tooltip={t("Solid line")}
        stretched
      >
        <LineStyleIcon lineStyle="solid" />
      </StyleToggleButton>
    </LabeledToggleButtonGroupItemRow>
  );
}

function LineStyleIcon({ lineStyle }: { lineStyle: "none" | "dotted" | "dashed" | "solid" }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      {lineStyle === "none" ? <path d="m4 4 8 8m0-8-8 8" stroke="currentColor" strokeWidth="1.5" /> :
        <path d="M2 8h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"
          strokeDasharray={lineStyle === "dotted" ? "0 3" : lineStyle === "dashed" ? "3 3" : undefined} />}
    </svg>
  );
}

export function BorderEdgeIcon({ side }: { side?: Side }) {
  const edges = { top: "M3 3h10", right: "M13 3v10", bottom: "M3 13h10", left: "M3 3v10" };
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="3" y="3" width="10" height="10" rx="0.5" stroke="currentColor"
        strokeWidth={side ? 1 : 1.5} strokeDasharray={side ? "1.5 2" : undefined} opacity={side ? 0.45 : 1} />
      {side && <path d={edges[side]} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />}
    </svg>
  );
}
