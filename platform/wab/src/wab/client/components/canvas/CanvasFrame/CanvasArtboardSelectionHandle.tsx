import { createStore } from "zustand/vanilla";
import { useStudioArena } from "@/wab/client/studio-ctx/arena-state";
import { useStore } from "zustand";
import { useContentEditorScope } from "@/wab/client/studio-ctx/canvas-content-editor";
import { useFocusedViewSelection, useStudioSelection } from "@/wab/client/studio-ctx/selection-state";
import { useShallow } from "zustand/react/shallow";
import { maybeShowContextMenu } from "@/wab/client/components/ContextMenu";
import styles from "@/wab/client/components/canvas/CanvasFrame/CanvasFrame.module.scss";
import { makeFrameMenu } from "@/wab/client/components/frame-menu";
import { getGlobalCssVariableValue } from "@/wab/client/components/studio/GlobalCssVariables";
import { Icon } from "@/wab/client/components/widgets/Icon";
import { useScaledElementRef } from "@/wab/client/hooks/useScaledElementRef";
import PlasmicIcon__Frame from "@/wab/client/plasmic/plasmic_kit/PlasmicIcon__Frame";
import { useStudioCtx } from "@/wab/client/contexts/StudioContexts";
import { ArenaFrame } from "@/wab/shared/model/classes";
import { gridSpacing, hoverBoxTagHeight } from "@/wab/styles/css-variables";
import cn from "classnames";
import * as React from "react";

const inactiveHandle = createStore<unknown>(() => undefined);

export const CanvasArtboardSelectionHandle = React.memo(function CanvasArtboardSelectionHandle({
    frame,
    onClick,
  }: {
    frame: ArenaFrame;
    onClick: (e?: React.MouseEvent<HTMLElement>) => void;
  }) {
    const studioCtx = useStudioCtx();
    useContentEditorScope(studioCtx);
    useStudioArena(studioCtx, (state) => state.kind);
  useFocusedViewSelection(studioCtx, useShallow((state) => [state.context, state.targets, state.tpls]));
  useStudioSelection(studioCtx, useShallow((state) => [state.frames, state.view]));
    const ownerFrame = studioCtx.focusedViewCtx()?.arenaFrame() ?? frame;
    const scope = React.useMemo(() => {
      const models = studioCtx.modelSnapshots;
      return {
        models, lifetime: studioCtx.arenaState.lifetime(),
        owned: studioCtx.arenaState.frameMembershipStore.getState().some((ref) => ref.uid === ownerFrame.uid && models.resolve(ref) === ownerFrame),
      };
    }, [studioCtx, ownerFrame]);
    const active = scope.owned && !scope.lifetime.aborted && studioCtx.arenaState.isCurrentLifetime(scope.lifetime) && scope.models === studioCtx.modelSnapshots;
    useStore(active ? scope.models.declaredField(ownerFrame, "viewMode") : inactiveHandle);
    useStore(active ? scope.models.declaredField(ownerFrame, "container") : inactiveHandle);
    useStore(active ? scope.models.declaredField(ownerFrame.container, "component") : inactiveHandle);
    useStore(active ? scope.models.declaredField(ownerFrame.container.component, "tplTree") : inactiveHandle);
    const stopClickPropagation = React.useCallback(
      (e?: React.MouseEvent<HTMLElement>) => e?.stopPropagation(),
      [],
    );
    const hoverBoxObj = studioCtx.hoverBoxControlledObj;
    const isFocused =
      studioCtx.focusedFrames().includes(frame) || hoverBoxObj === frame;
    const isProminent =
      !isFocused && studioCtx.focusedViewCtx()?.arenaFrame() === frame;
    const _gridSpacing = parseInt(getGlobalCssVariableValue(gridSpacing));
    const _hoverBoxTagHeight = parseInt(
      getGlobalCssVariableValue(hoverBoxTagHeight),
    );

    const minZoom = isFocused ? 0 : _hoverBoxTagHeight / _gridSpacing;

    const rootRef = useScaledElementRef<HTMLDivElement>({
      minZoom: minZoom,
    });

    const handleContextMenu = (e) => {
      onClick(e);

      const viewCtx = studioCtx.focusedViewCtx();

      if (viewCtx) {
        const menu = makeFrameMenu({ viewCtx, frame });
        maybeShowContextMenu(e.nativeEvent, menu);
      }
    };

    return (
      <div
        ref={rootRef}
        className={cn(styles.artboardSelectionHandle, {
          [styles.artboardSelectionHandle_prominent]: isProminent,
          [styles.artboardSelectionHandle_focused]: isFocused,
        })}
        onContextMenu={handleContextMenu}
        onMouseDown={onClick}
        onClick={stopClickPropagation}
      >
        <Icon icon={PlasmicIcon__Frame} />
      </div>
    );
});
