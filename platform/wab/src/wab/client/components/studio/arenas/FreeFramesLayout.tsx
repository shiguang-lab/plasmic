import { CanvasFrame } from "@/wab/client/components/canvas/CanvasFrame";
import { CanvasCtx } from "@/wab/client/components/canvas/canvas-ctx";
import { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { getMixedArenaSize } from "@/wab/shared/Arenas";
import { Arena, ArenaFrame } from "@/wab/shared/model/classes";
import L from "lodash";
import { observer } from "mobx-react";
import React from "react";

export const FreeFramesLayout = observer(function FreeFramesLayout(props: {
  studioCtx: StudioCtx;
  arena: Arena;
  onFrameLoad: (frame: ArenaFrame, canvasCtx: CanvasCtx) => void;
}) {
  const { studioCtx, onFrameLoad, arena } = props;

  // This component is inserted into the scaler.
  // The scaler needs to know the size of its children to zoom properly.
  // Since mixed arenas have absolutely-positioned frames,
  // the DOM doesn't auto-compute the size.
  // Instead, we compute the size and set it on a container div.
  const arenaScalerSize = getMixedArenaSize(arena);
  const contentView = studioCtx.viewCtxs.find((vc) => vc.contentEditor.target);
  const contentSize = contentView?.contentEditor.size.get();
  const contentFrame = contentView?.arenaFrame();

  // We sort arenaFrames here by their uid as we render, so that
  // if they get re-ordered, we don't re-render a CanvasFrame.  The frame
  // themselves are absolutely-positioned anyway, so the render order
  // doesn't matter.
  return (
    <div
      style={{
        width: `${Math.max(arenaScalerSize.x, contentSize && contentFrame ? (contentFrame.left ?? 0) + contentSize.width : 0)}px`,
        height: `${Math.max(arenaScalerSize.y, contentSize && contentFrame ? (contentFrame.top ?? 0) + contentSize.height : 0)}px`,
      }}
    >
      {L.sortBy(arena.children, (f) => f.uid).map((frame) => {
        return (
          <CanvasFrame
            studioCtx={studioCtx}
            arena={arena}
            key={frame.uid}
            onFrameLoad={onFrameLoad}
            arenaFrame={frame}
            isFree={true}
          />
        );
      })}
    </div>
  );
});
