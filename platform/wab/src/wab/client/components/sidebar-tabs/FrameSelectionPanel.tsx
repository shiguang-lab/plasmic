import { useFrameHeights } from "@/wab/client/studio-ctx/frame-heights";
import { useStudioSelection } from "@/wab/client/studio-ctx/selection-state";
import { useFrameSelectionBounds } from "@/wab/client/components/canvas/selection-bounds";
import { useMultiSelectionStyles } from "@/wab/client/components/sidebar-tabs/MultiSelectionPanel";
import { useI18n } from "@/wab/client/i18n";
import { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { Scrollbar } from "@shiguang2/components/esm/scrollbar";
import { observer } from "mobx-react";
import React from "react";

export const FrameSelectionPanel = observer(function FrameSelectionPanel({
  studioCtx,
}: {
  studioCtx: StudioCtx;
}) {
  useStudioSelection(studioCtx, (state) => state.frames);
  const { t } = useI18n();
  const { styles } = useMultiSelectionStyles();
  const bounds = useFrameSelectionBounds(studioCtx);
  const frames = studioCtx.focusedFrames();
  const heights = useFrameHeights(studioCtx, frames);
  return (
    <Scrollbar
      scrollX={false}
      className={`${styles.root} frame-selection-panel studio-scrollbar`}
    >
      <section className={styles.section}>
        <h3 className={styles.heading}>{t("Selection bounds")}</h3>
        {bounds && (
          <div className={styles.bounds}>
            <span>W {Math.round(bounds.width())}</span>
            <span>H {Math.round(bounds.height())}</span>
          </div>
        )}
        <ul className={styles.layers}>
          {frames.map((frame, index) => {
            const name = studioCtx.tplMgr().describeArenaFrame(frame);
            return (
              <li key={frame.uuid} title={name}>
                {name} · {frame.width} × {heights[index]}
              </li>
            );
          })}
        </ul>
      </section>
    </Scrollbar>
  );
});
