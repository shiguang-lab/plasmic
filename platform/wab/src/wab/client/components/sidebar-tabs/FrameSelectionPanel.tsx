import { ModelFieldSelector } from "@/wab/client/stores/model-field-selector";
import { useFrameHeight } from "@/wab/client/studio-ctx/frame-heights";
import { useFrameWidth } from "@/wab/client/studio-ctx/frame-width";
import type { ArenaFrame } from "@/wab/shared/model/classes";
import { useStudioSelection } from "@/wab/client/studio-ctx/selection-state";
import { useFrameSelectionBounds } from "@/wab/client/components/canvas/selection-bounds";
import { useMultiSelectionStyles } from "@/wab/client/components/sidebar-tabs/MultiSelectionPanel";
import { useI18n } from "@/wab/client/i18n";
import { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { Scrollbar } from "@shiguang2/components/esm/scrollbar";
import React from "react";

export const FrameSelectionPanel = React.memo(function FrameSelectionPanel({
  studioCtx,
}: {
  studioCtx: StudioCtx;
}) {
  useStudioSelection(studioCtx, (state) => state.frames);
  const { t } = useI18n();
  const { styles } = useMultiSelectionStyles();
  const bounds = useFrameSelectionBounds(studioCtx);
  const frames = studioCtx.focusedFrames();
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
          {frames.map((frame) => <FrameSelectionRow key={frame.uuid} studio={studioCtx} frame={frame} />)}
        </ul>
      </section>
    </Scrollbar>
  );
});

const FrameSelectionRow = React.memo(function FrameSelectionRow({ studio, frame }: { studio: StudioCtx; frame: ArenaFrame }) {
  const source = React.useMemo(() => {
    const models = studio.modelSnapshots;
    return new ModelFieldSelector(studio, (read) => {
      const container = models.resolve(read(frame, "container"));
      const component = models.resolve(read(container, "component"));
      const name = read(component, "name");
      if (!name) { read(frame, "name"); }
      return studio.tplMgr().describeArenaFrame(frame);
    });
  }, [studio, frame]);
  const name = React.useSyncExternalStore(source.subscribe, source.getSnapshot, source.getSnapshot);
  const width = useFrameWidth(studio, frame), height = useFrameHeight(studio, frame);
  return <li title={name}>{name} · {width} × {height}</li>;
});
