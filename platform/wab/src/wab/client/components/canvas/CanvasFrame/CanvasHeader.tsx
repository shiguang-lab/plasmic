import { useCanvasHeaderInputs } from "@/wab/client/components/canvas/CanvasFrame/canvas-header-inputs";
import { useFrameWidth } from "@/wab/client/studio-ctx/frame-width";
import { useStudioArena, useViewEntryForFrame } from "@/wab/client/studio-ctx/arena-state";
import { useStudioSelection, useViewSelection } from "@/wab/client/studio-ctx/selection-state";
import { useShallow } from "zustand/react/shallow";
import { useCanvasZoom } from "@/wab/client/studio-ctx/viewport-state";
import { maybeShowContextMenu } from "@/wab/client/components/ContextMenu";
import {
  StyleVariantEditor,
  VariantLabel,
  makeCanvasVariantContextMenu,
} from "@/wab/client/components/VariantControls";
import { CanvasConfigButton } from "@/wab/client/components/canvas/CanvasFrame/CanvasConfigButton";
import styles from "@/wab/client/components/canvas/CanvasFrame/CanvasHeader.module.scss";
import { EditableLabelHandles } from "@/wab/client/components/widgets/EditableLabel";
import { Icon } from "@/wab/client/components/widgets/Icon";
import { TriggerTarget } from "@/wab/client/components/widgets/TriggerAnchor";
import { useStudioCtx } from "@/wab/client/contexts/StudioContexts";
import {
  useScaledElementRef,
  useZoomStyledRef,
} from "@/wab/client/hooks/useScaledElementRef";
import ComponentIcon from "@/wab/client/plasmic/plasmic_kit/PlasmicIcon__Component";
import PageIcon from "@/wab/client/plasmic/plasmic_kit_design_system/icons/PlasmicIcon__Page";
import { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { MaybeWrap } from "@/wab/commons/components/ReactUtil";
import {
  AnyArena,
  isComponentArena,
  isMixedArena,
  isPageArena,
} from "@/wab/shared/Arenas";
import {
  StyleVariant,
  isStyleOrCodeComponentVariant,
} from "@/wab/shared/Variants";
import {
  ArenaFrame,
  Component,
  Variant,
  isKnownTplTag,
} from "@/wab/shared/model/classes";
import { Popover, Tooltip } from "antd";
import cn from "classnames";
import * as React from "react";
import { useLayoutEffect, useRef, useState } from "react";

export const CanvasHeader = React.memo(function CanvasHeader(props: {
  studioCtx: StudioCtx;
  arena: AnyArena;
  frame: ArenaFrame;
}) {
  const { studioCtx, frame, arena } = props;
  useStudioSelection(studioCtx, useShallow((state) => [state.frames, state.view]));
  const focusedMode = useStudioArena(studioCtx, (state) => state.focusedMode);
  const viewportZoom = useCanvasZoom(studioCtx);
  const width = useFrameWidth(studioCtx, frame);
  const isFocused =
    studioCtx.focusedFrames().includes(frame) ||
    studioCtx.focusedContentFrame() === frame;
  const isFocusedFrame = studioCtx.focusedViewCtx()?.arenaFrame() === frame;
  const shouldShowFrameConfigButton =
    !focusedMode && (!isComponentArena(arena) || isFocusedFrame);

  const rootRef = useScaledElementRef<HTMLDivElement>();

  useZoomStyledRef(
    (zoom) => ({
      maxWidth: `${Math.max(0, width * zoom)}px`,
    }),
    rootRef,
  );

  const [contentIsCollapsed, setContentIsCollapsed] = useState(false);
  useLayoutEffect(() => {
    if (rootRef.current) {
      setContentIsCollapsed(
        rootRef.current.offsetWidth < rootRef.current.scrollWidth,
      );
    }
  }, [viewportZoom]);

  return (
    <>
      <div
        ref={rootRef}
        className={cn(
          "CanvasFrame__Label flex flex-vcenter flex-no-shrink-children",
          {
            "CanvasFrame__Label--focused": isFocused,
          },
        )}
        data-canvas-artboard-uid={frame.uid}
      >
        <CanvasHeaderContent
          showTooltip={
            studioCtx.focusedViewCtx()?.arenaFrame() !== frame &&
            contentIsCollapsed
          }
          studioCtx={studioCtx}
          frame={frame}
          arena={arena}
        />
      </div>
      {shouldShowFrameConfigButton && (
        <CanvasConfigButton showDims studioCtx={studioCtx} frame={frame} />
      )}
    </>
  );
});

const CanvasHeaderContent = React.memo(function CanvasHeaderContent(props: {
  studioCtx: StudioCtx;
  frame: ArenaFrame;
  arena: AnyArena;
  showTooltip: boolean;
}) {
  const { studioCtx, frame, arena, showTooltip } = props;
  const arenaKind = useStudioArena(studioCtx, (state) => state.kind);
  useStudioSelection(studioCtx, (state) => state.view);
  const vc = studioCtx.focusedViewCtx();
  useViewSelection(vc, (state) => state.tpls);
  const focusedTpl = vc?.focusedTpl();
  const header = useCanvasHeaderInputs(studioCtx, frame, isKnownTplTag(focusedTpl) ? focusedTpl : undefined, isPageArena(arena));
  if (!header) { return null; }

  const arenaFrameNameLabel = header.frameName;
  const displayVariants = header.displayVariants
    .map((it) => it.displayName)
    .join(" + ");

  const componentIcon = (
    <Icon
      icon={header.pageComponent ? PageIcon : ComponentIcon}
      className="flex-no-shrink dimdimfg mr-xsm"
    />
  );

  return (
    <MaybeWrap
      cond={showTooltip}
      wrapper={(children) => (
        <Tooltip
          placement={"topLeft"}
          title={
            <div>
              {arenaKind === "mixed" && (
                <>
                  {componentIcon} {arenaFrameNameLabel}
                </>
              )}
              {displayVariants && (
                <div
                  className={
                    arenaKind === "mixed"
                      ? styles.tooltipVariantsContainer
                      : undefined
                  }
                >
                  {displayVariants}
                </div>
              )}
            </div>
          }
        >
          <TriggerTarget>{children}</TriggerTarget>
        </Tooltip>
      )}
    >
      {isMixedArena(arena) && (
        <span className="mr-ch">{arenaFrameNameLabel}</span>
      )}
      <CanvasVariantsDesc
        studioCtx={studioCtx}
        frame={frame}
        isPageArena={isPageArena(arena)}
      />
    </MaybeWrap>
  );
});

export const VariantName = React.memo(function VariantName_({
  variant,
  isSelected,
  component,
}: {
  isSelected: boolean;
  variant: Variant;
  component: Component;
}) {
  const studioCtx = useStudioCtx();
  const variantLabelRef = useRef<EditableLabelHandles>(null);
  const [showStyleVariantEditor, setShowStyleVariantEditor] = useState(false);

  return (
    <span
      key={variant.uuid}
      className="CanvasFrame__Label__variant"
      onContextMenu={(e: any) => {
        e.preventDefault();
        maybeShowContextMenu(
          e,
          makeCanvasVariantContextMenu({
            studioCtx,
            variant,
            component,
            onRequestEditing: () => {
              if (isStyleOrCodeComponentVariant(variant)) {
                setShowStyleVariantEditor(true);
              } else {
                variantLabelRef.current?.setEditing(true);
              }
            },
          }),
        );
      }}
    >
      <MaybeWrap
        cond={isStyleOrCodeComponentVariant(variant)}
        wrapper={(children) => (
          <Popover
            placement="left"
            motion={{ motionName: "" }}
            destroyOnHidden
            open={showStyleVariantEditor}
            content={() => (
              <StyleVariantEditor
                variant={variant as StyleVariant}
                component={component}
                onDismiss={() => setShowStyleVariantEditor(false)}
              />
            )}
          >
            <TriggerTarget>{children}</TriggerTarget>
          </Popover>
        )}
      >
        <VariantLabel
          ref={variantLabelRef}
          doubleClickToEdit // Single-click to edit is disabled
          variant={variant}
          isRecording={isSelected}
        />
      </MaybeWrap>
    </span>
  );
});

export const CanvasVariantsDesc = React.memo(function CanvasVariantsDesc(props: {
  studioCtx: StudioCtx;
  frame: ArenaFrame;
  isPageArena?: boolean;
}) {
  const { studioCtx, frame } = props;
  const vc = useViewEntryForFrame(studioCtx, frame)?.view;
  useViewSelection(vc, (state) => state.tpls);
  const focusedTpl = vc?.focusedTpl();
  const header = useCanvasHeaderInputs(studioCtx, frame, isKnownTplTag(focusedTpl) ? focusedTpl : undefined, props.isPageArena);
  useStudioSelection(studioCtx, (state) => state.view);
  if (!header) { return null; }

  if (frame === studioCtx.focusedViewCtx()?.arenaFrame()) {
    // Variants description in the recording panel instead
    return null;
  }

  return (
    <div className="inline-flex flex-fill">
      {header.displayVariants.map((displayVariant) => (
        <VariantName
          key={displayVariant.variant.uuid}
          {...displayVariant}
          component={header.component}
        />
      ))}
    </div>
  );
});
