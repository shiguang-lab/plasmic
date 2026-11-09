import { useFrameWidth } from "@/wab/client/studio-ctx/frame-width";
import { useFrameHeight } from "@/wab/client/studio-ctx/frame-heights";
import { useStudioArena, useViewEntryForFrame, useViewRegistry } from "@/wab/client/studio-ctx/arena-state";
import { useStudioSelection } from "@/wab/client/studio-ctx/selection-state";
import { useShallow } from "zustand/react/shallow";
import { useCanvasZoom } from "@/wab/client/studio-ctx/viewport-state";
import { FramePanel } from "@/wab/client/components/sidebar-tabs/frame-tab";
import { getGlobalCssVariableValue } from "@/wab/client/components/studio/GlobalCssVariables";
import { useScaledElementRef } from "@/wab/client/hooks/useScaledElementRef";
import GearIcon from "@/wab/client/plasmic/plasmic_kit/PlasmicIcon__Gear";
import { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { ArenaFrame } from "@/wab/shared/model/classes";
import { gridSpacing, hoverBoxTagHeight } from "@/wab/styles/css-variables";
import { Popover } from "antd";
import cn from "classnames";
import * as React from "react";

export function CanvasConfigButton(props: {
  studioCtx: StudioCtx;
  frame: ArenaFrame;
  contained?: boolean;
  showDims?: boolean;
}) {
  const { studioCtx, frame, showDims } = props;
  const [selectedFrames, selectedView] = useStudioSelection(studioCtx, useShallow((state) => [state.frames, state.view] as const));
  const viewportZoom = useCanvasZoom(studioCtx);
  const frameHeight = useFrameHeight(studioCtx, showDims ? frame : undefined);
  const frameWidth = useFrameWidth(studioCtx, showDims ? frame : undefined);
  const arenaFrames = useStudioArena(studioCtx, (state) => state.frames);
  const focusedViewFrame = useViewRegistry(studioCtx, (entries) => entries.find((entry) => entry.view === selectedView)?.frame);
  const focusedFrame = selectedFrames.find((selected) => arenaFrames.includes(selected)) ?? focusedViewFrame;
  const vc = useViewEntryForFrame(studioCtx, frame)?.view;
  const isFocused = focusedFrame?.uid === frame.uid;
  const [visible, setVisible] = React.useState(false);
  const _gridSpacing = parseInt(getGlobalCssVariableValue(gridSpacing), 10);
  const _hoverBoxTagHeight = parseInt(
    getGlobalCssVariableValue(hoverBoxTagHeight),
    10,
  );
  const minZoom = Math.max(viewportZoom, _hoverBoxTagHeight / _gridSpacing);

  const buttonRef = useScaledElementRef<HTMLButtonElement>({
    minZoom,
    extraTransformation: props.contained ? "" : "rotate(90deg)",
    disableScaling: props.contained,
  });

  return (
    <Popover
      content={vc && <FramePanel viewCtx={vc} frame={frame} />}
      trigger={["click"]}
      onOpenChange={(v) => setVisible(v)}
      open={visible}
      placement={props.contained ? "bottomLeft" : "right"}
    >
      <button
        ref={buttonRef}
        className={cn({
          flex: true,
          "flex-vcenter": true,
          CanvasFrame__Config: true,
          CanvasFrame__Config_contained: props.contained,
        })}
        data-test-id={isFocused && "artboard-config-button"}
        onPointerDown={async (e) => {
          if (studioCtx.isPanMode()) {
            // panning clicking.
            return;
          }
          e.stopPropagation();
          await studioCtx.changeUnsafe(() =>
            studioCtx.setStudioFocusOnFrame({ frame: frame, autoZoom: false }),
          );
        }}
      >
        <GearIcon className="CanvasFrame__Config__icon" />
        {showDims && (
          <>
            {frameWidth}{" "}
            <span style={{ margin: "0 5px", fontSize: ".7em" }}>✕</span>{" "}
            {frameHeight}
          </>
        )}
      </button>
    </Popover>
  );
}
