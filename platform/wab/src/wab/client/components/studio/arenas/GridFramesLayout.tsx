import { useGridLayoutInputs } from "@/wab/client/components/studio/arenas/arena-layout-inputs";
import { useFrameHeights } from "@/wab/client/studio-ctx/frame-heights";
import { useCanvasZoom } from "@/wab/client/studio-ctx/viewport-state";
import { CanvasFrame } from "@/wab/client/components/canvas/CanvasFrame";
import { CanvasCtx } from "@/wab/client/components/canvas/canvas-ctx";
import sty from "@/wab/client/components/studio/arenas/GridFramesLayout.module.sass";
import { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { useStudioCtx } from "@/wab/client/contexts/StudioContexts";
import { AnyArena, getFrameHeight } from "@/wab/shared/Arenas";
import { maybe, switchType } from "@/wab/shared/common";
import {
  ArenaFrame,
  ArenaFrameGrid,
  ArenaFrameRow,
  ComponentArena,
  PageArena,
} from "@/wab/shared/model/classes";
import React from "react";

type GridFramesLayoutProps = {
  arena: AnyArena;
  grid: ArenaFrameGrid;
  onFrameLoad: (frame: ArenaFrame, canvasCtx: CanvasCtx) => void;
  makeRowLabel?: (row: ArenaFrameRow, index: number) => React.ReactNode;
  makeRowLabelControls?: (row: ArenaFrameRow, index: number) => React.ReactNode;
  rowEndControls?: (row: ArenaFrameRow, index: number) => React.ReactNode;
  gridEndControls?: () => React.ReactNode;
};
export const GridFramesLayout = React.memo(function GridFramesLayout(props: GridFramesLayoutProps) {
  const studio = useStudioCtx();
  const inputs = useGridLayoutInputs(studio, props.grid);
  return inputs ? <GridFramesLayoutContent {...props} /> : null;
});
function GridFramesLayoutContent(props: GridFramesLayoutProps) {
  const {
    arena,
    grid,
    onFrameLoad,
    makeRowLabel,
    makeRowLabelControls,
    rowEndControls,
    gridEndControls,
  } = props;

  const studioCtx = useStudioCtx();

  return (
    <div className={sty.root}>
      {grid.rows.map((row, rowIndex) => (
        // It's necessary to encode the rowKey and rowIndex in the key here, so that
        // upon reordering rows, the CanvasFrame components are unmounted and mounted
        // again. The full reason is explained in the comment above the CanvasFrame key.
        <div key={`${row.rowKey?.uuid ?? "rowKey"}-${rowIndex}`}>
          <ArenaGridRowLabel
            studioCtx={studioCtx}
            arena={arena}
            key={`label-${row.rowKey?.uuid ?? rowIndex}`}
          >
            {makeRowLabel?.(row, rowIndex)}
            {makeRowLabelControls?.(row, rowIndex)}
          </ArenaGridRowLabel>
          {row.cols.map((cell, index) => (
            // It is necessary to encode the `index` in the key CanvasFrame key here,
            // so that upon reordering variants, the CanvasFrame components are unmounted
            // and mounted again. The reason is that if they have a stable key, then the
            // component won't be re-rendered, but React will manipulate the DOM elements to
            // match the right order; however, when an iframe is detached from the DOM, its
            // content is reset, so we end up with an empty iframe!
            <CanvasFrame
              key={`${cell.frame.uid}-${index}`}
              studioCtx={studioCtx}
              arena={arena}
              onFrameLoad={onFrameLoad}
              arenaFrame={cell.frame}
              isFree={false}
            />
          ))}
          {rowEndControls && (
            <div key={`controls-${row.rowKey?.uuid ?? rowIndex}`}>
              {rowEndControls(row, rowIndex)}
            </div>
          )}
        </div>
      ))}
      {gridEndControls && (
        <div key="end-row">
          <ArenaGridRowLabel
            arena={arena}
            studioCtx={studioCtx}
            key={`end-label`}
          >
            {null}
          </ArenaGridRowLabel>
          {gridEndControls()}
        </div>
      )}
    </div>
  );
}

const ArenaGridRowLabel = React.memo(function ArenaGridRowLabel(props: {
  arena: AnyArena;
  studioCtx: StudioCtx;
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  const { studioCtx, children, style } = props;
  useGridLayoutInputs(studioCtx, switchType(props.arena).when([ComponentArena, PageArena], (arena) => arena.matrix).elseUnsafe(() => undefined));
  const viewportZoom = useCanvasZoom(studioCtx);
  const heightFrames = switchType(props.arena)
    .when(ComponentArena, (arena) => arena.matrix.rows[0]?.cols[0]?.frame ? [arena.matrix.rows[0].cols[0].frame] : [])
    .when(PageArena, (arena) => arena.matrix.rows.flatMap((row) => row.cols.map((cell) => cell.frame)))
    .elseUnsafe(() => []);
  useFrameHeights(studioCtx, heightFrames);

  const minRowHeight = switchType(props.arena)
    .when(ComponentArena, (arena) =>
      maybe(arena.matrix.rows[0]?.cols[0]?.frame, (frame) =>
        getFrameHeight(frame),
      ),
    )
    .when(PageArena, (arena) =>
      Math.min.call(
        null,
        ...arena.matrix.rows.map((row) =>
          Math.max.call(
            null,
            ...row.cols.map((col) => getFrameHeight(col.frame)),
          ),
        ),
      ),
    )
    .elseUnsafe(() => 300);

  return (
    <div
      className={sty.rowLabel}
      style={{
        transform: `scale(${Math.min(
          1 / viewportZoom,
          minRowHeight / 27 /* label line-height */,
        )})`,
        ...style,
      }}
    >
      <div className={sty.rowLabelInner}>{children}</div>
    </div>
  );
});
