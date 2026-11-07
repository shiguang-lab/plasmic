import { useStudioRenderPolicy } from "@/wab/client/studio-ctx/studio-render-policy";
import { useArenaStatus } from "@/wab/client/studio-ctx/arena-state";
import { CanvasCtx } from "@/wab/client/components/canvas/canvas-ctx";
import { ComponentArenaLayout } from "@/wab/client/components/studio/arenas/ComponentArenaLayout";
import { FocusModeLayout, useArenaFocusedFrame } from "@/wab/client/components/studio/arenas/FocusModeLayout";
import { FreeFramesLayout } from "@/wab/client/components/studio/arenas/FreeFramesLayout";
import { PageArenaLayout } from "@/wab/client/components/studio/arenas/PageArenaLayout";
import { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import {
  AnyArena,
  isComponentArena,
  isFocusedDedicatedArena,
  isMixedArena,
  isPageArena,
} from "@/wab/shared/Arenas";
import { cx, unexpected } from "@/wab/shared/common";
import { ArenaFrame } from "@/wab/shared/model/classes";
import React from "react";

export function CanvasArenaShell(props: {
  studioCtx: StudioCtx;
  arena: AnyArena;
  onFrameLoad: (frame: ArenaFrame, canvasCtx: CanvasCtx) => void;
}) {
  const { studioCtx, arena, onFrameLoad } = props;
  const isDevMode = useStudioRenderPolicy(studioCtx, (policy) => policy.devMode);
  const status = useArenaStatus(studioCtx, arena);

  return (
    <div
      data-arena-uid={arena.uid}
      className={cx(
        status === "visible"
          ? "canvas-editor__frames"
          : status === "background"
            ? "canvas-editor__frames canvas-editor__frames--background"
            : "display-none",
        isDevMode ? undefined : "invisible",
      )}
    >
      {status !== "dead" && (
        <CanvasArena
          studioCtx={studioCtx}
          arena={arena}
          onFrameLoad={onFrameLoad}
        />
      )}
    </div>
  );
}

export function CanvasArena(props: {
  studioCtx: StudioCtx;
  arena: AnyArena;
  onFrameLoad: (frame: ArenaFrame, canvasCtx: CanvasCtx) => void;
}) {
  const { studioCtx, arena, onFrameLoad } = props;
  const focusedFrame = useArenaFocusedFrame(studioCtx, arena);
  if (isMixedArena(arena)) {
    return (
      <FreeFramesLayout
        arena={arena}
        studioCtx={studioCtx}
        onFrameLoad={onFrameLoad}
      />
    );
  } else if (focusedFrame && isFocusedDedicatedArena(arena)) {
    return (
      <FocusModeLayout
        arena={arena}
        studioCtx={studioCtx}
        onFrameLoad={onFrameLoad}
      />
    );
  } else if (isPageArena(arena)) {
    return (
      <PageArenaLayout
        studioCtx={studioCtx}
        arena={arena}
        onFrameLoad={onFrameLoad}
      />
    );
  } else if (isComponentArena(arena)) {
    return (
      <ComponentArenaLayout
        studioCtx={studioCtx}
        arena={arena}
        onFrameLoad={onFrameLoad}
      />
    );
  } else {
    unexpected();
  }
}
