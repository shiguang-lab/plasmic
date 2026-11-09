import { useFreeLayoutInputs } from "@/wab/client/components/studio/arenas/arena-layout-inputs";
import { useActiveContentEditor, useContentEditor } from "@/wab/client/studio-ctx/canvas-content-editor";
import { useFrameHeights } from "@/wab/client/studio-ctx/frame-heights";
import { CanvasFrame } from "@/wab/client/components/canvas/CanvasFrame";
import { CanvasCtx } from "@/wab/client/components/canvas/canvas-ctx";
import { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { Arena, ArenaFrame } from "@/wab/shared/model/classes";
import L from "lodash";
import React from "react";

type FreeFramesLayoutProps = {
  studioCtx: StudioCtx;
  arena: Arena;
  onFrameLoad: (frame: ArenaFrame, canvasCtx: CanvasCtx) => void;
};
export const FreeFramesLayout = React.memo(function FreeFramesLayout(props: FreeFramesLayoutProps) {
  const inputs = useFreeLayoutInputs(props.studioCtx, props.arena);
  return inputs ? <FreeFramesLayoutContent {...props} frames={inputs} /> : null;
});
function FreeFramesLayoutContent(props: FreeFramesLayoutProps & { frames: NonNullable<ReturnType<typeof useFreeLayoutInputs>> }) {
  const { studioCtx, onFrameLoad, arena } = props;

  // This component is inserted into the scaler.
  // The scaler needs to know the size of its children to zoom properly.
  // Since mixed arenas have absolutely-positioned frames,
  // the DOM doesn't auto-compute the size.
  // Instead, we compute the size and set it on a container div.
  const heights = useFrameHeights(studioCtx, props.frames.map((input) => input.frame));
  const arenaScalerSize = { x: Math.max(0, ...props.frames.map((input) => input.left + input.width)), y: Math.max(0, ...props.frames.map((input, index) => input.top + heights[index])) };
  const contentEditor = useActiveContentEditor(studioCtx);
  const contentSize = useContentEditor(contentEditor, (state) => state.size);
  const contentFrame = contentEditor?.viewCtx.arenaFrame();
  const contentPosition = props.frames.find((input) => input.frame === contentFrame);

  // We sort arenaFrames here by their uid as we render, so that
  // if they get re-ordered, we don't re-render a CanvasFrame.  The frame
  // themselves are absolutely-positioned anyway, so the render order
  // doesn't matter.
  return (
    <div
      style={{
        width: `${Math.max(arenaScalerSize.x, contentSize && contentPosition ? contentPosition.left + contentSize.width : 0)}px`,
        height: `${Math.max(arenaScalerSize.y, contentSize && contentPosition ? contentPosition.top + contentSize.height : 0)}px`,
      }}
    >
      {L.sortBy(props.frames, (input) => input.uid).map(({ frame, uid }) => {
        return (
          <CanvasFrame
            studioCtx={studioCtx}
            arena={arena}
            key={uid}
            onFrameLoad={onFrameLoad}
            arenaFrame={frame}
            isFree={true}
          />
        );
      })}
    </div>
  );
}
