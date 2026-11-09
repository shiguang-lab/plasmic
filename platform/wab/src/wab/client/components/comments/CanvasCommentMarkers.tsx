import { useStudioOverlayState } from "@/wab/client/studio-ctx/studio-overlay-state";
import { useStudioRenderPolicy } from "@/wab/client/studio-ctx/studio-render-policy";
import { useStudioLiveMode } from "@/wab/client/studio-ctx/studio-mode-state";
import { useStudioSelection, useViewSelection } from "@/wab/client/studio-ctx/selection-state";
import { useStudioArena, useViewEntryForFrame } from "@/wab/client/studio-ctx/arena-state";
import { useViewVariants } from "@/wab/client/studio-ctx/variant-state";
import { useShallow } from "zustand/react/shallow";
import { useCanvasRenderCount } from "@/wab/client/hooks/useCanvasRenderStatus";
import { useCanvasTransforming, useViewportValue } from "@/wab/client/studio-ctx/viewport-state";
import { CanvasTransformedBox } from "@/wab/client/components/canvas/CanvasTransformedBox";
import { useRerenderOnUserBodyChange } from "@/wab/client/components/canvas/UserBodyObserver";
import { AddCommentMarker } from "@/wab/client/components/comments/AddCommentMarker";
import { CommentMarker } from "@/wab/client/components/comments/CommentMarker";
import CommentPost from "@/wab/client/components/comments/CommentPost";
import {
  getCommentFrameKey,
  getSubjectVariantsKey,
  TplCommentThread,
} from "@/wab/client/components/comments/utils";
import { Avatar } from "@/wab/client/components/studio/Avatar";
import { useStudioCtx } from "@/wab/client/contexts/StudioContexts";
import { useI18n } from "@/wab/client/i18n";
import {
  getSetOfPinnedVariantsForViewCtx,
  ViewCtx,
} from "@/wab/client/studio-ctx/view-ctx";
import { AnyArena } from "@/wab/shared/Arenas";
import {
  ensure,
  ensureString,
  withoutNils,
  xGroupBy,
} from "@/wab/shared/common";
import {
  isTplNamable,
  tryGetTplOwnerComponent,
} from "@/wab/shared/core/tpls";
import { Box } from "@/wab/shared/geom";
import { ArenaFrame, TplNode } from "@/wab/shared/model/classes";
import { maybeMkSemVerSiteElement } from "@/wab/shared/site-diffs";
import { Popover, Tooltip } from "antd";
import $ from "jquery";
import { noCanvasModelFields, useCanvasComponentInputs, useCanvasViewInputs } from "@/wab/client/components/canvas/canvas-view-inputs";
import { useCommentMarkerOwner } from "@/wab/client/components/comments/comment-marker-inputs";
import React, { ReactNode } from "react";
import { createPortal } from "react-dom";
import { useStore } from "zustand";

const emptyThreads: TplCommentThread[] = [];
const HORIZONTAL_MARKER_OFFSET = 12;
const ADD_COMMENT_MARKER_MARGIN = 10;
const ADD_COMMENT_INDIVIDUAL_MARKER_MARGIN = 20;
const COMMENT_MARKER_INITIAL_Z_INDEX = 12;
const THREAD_MARKER_MARGIN = 30;

export const CanvasCommentSubjectLabel = React.memo(function CanvasCommentSubjectLabel(props: { subject: TplNode; view: ViewCtx }) {
  const { t: studioUiT, label } = useI18n();

  const { subject, view } = props;
  const owner = useCommentMarkerOwner(view, subject);
  if (!owner.alive) {return null;}
  const item = ensure(owner.item, "Comment subject must be a design element");
  const typeName = label(item.type);
  const objName = item.name;
  return (
    <>
      {objName ? (
        <>
          {typeName} <strong>{objName}</strong>
        </>
      ) : (
        studioUiT("Unnamed {type}", { type: typeName })
      )}
    </>
  );
});

const CanvasCommentMarker = React.memo(function CanvasCommentMarker(props: {
  commentThread: TplCommentThread;
  viewCtx: ViewCtx;
  offsetRight: number;
  zIndex: number;
  onHoverChange: (hovering: boolean) => void;
}) {
  const { commentThread, viewCtx, offsetRight, zIndex, onHoverChange } = props;
  const commentsCtx = viewCtx.studioCtx.commentsCtx;
  const lifetime = useCanvasViewInputs(viewCtx, noCanvasModelFields);

  const threadComments = commentThread.comments;
  const [comment] = threadComments;
  const isSelected = useStore(
    commentsCtx.dialogStore,
    (state) => state.thread?.threadId === commentThread.id,
  );
  const subject = commentsCtx
    .bundler()
    .objByAddr(commentThread.location.subject) as TplNode;
  const author = ensure(
    useStore(commentsCtx.store, (state) =>
      state.usersMap.get(ensureString(comment.createdById)),
    ),
    "Comment author should exist",
  );

  return (
    <CanvasCommentOverlay
      offsetRight={offsetRight}
      tpl={subject}
      viewCtx={viewCtx}
      className={"CommentMarker"}
      onClick={(e) => {
        if (lifetime.alive && !viewCtx.disposeSignal.aborted && !isSelected) {
          e.stopPropagation();
          commentsCtx.openCommentThreadDialog(commentThread.id, true);
        }
      }}
      zIndex={zIndex}
    >
      <Popover
        key={isSelected ? "selected" : `${comment.id}-not-selected`}
        classNames={{ root: "NoPaddingPopover NoBackgroundStyles" }}
        placement={"top"}
        trigger={["hover"]}
        destroyOnHidden
        arrow={false}
        content={
          !isSelected ? (
            <CommentPost
              comment={comment}
              commentThread={commentThread}
              subjectLabel={<CanvasCommentSubjectLabel view={viewCtx} subject={subject} />}
              hoverBox
              repliesLinkLabel={
                threadComments.length > 1
                  ? `${threadComments.length - 1} replies`
                  : null
              }
            />
          ) : null
        }
      >
        <div
          onMouseEnter={() => onHoverChange(true)}
          onMouseLeave={() => onHoverChange(false)}
        >
          <CommentMarker
            className={"CommentMarkerInitial"}
            data-test-id={`comment-marker-${commentThread.id}`}
          >
            <Avatar user={author} size="small" showToolTip={false} />
          </CommentMarker>
        </div>
      </Popover>
    </CanvasCommentOverlay>
  );
});

export const CanvasAddCommentMarker = React.memo(
  function CanvasAddCommentMarker(props: { viewCtx: ViewCtx; tpl: TplNode }) {
    const { t: uiT } = useI18n();
    const { viewCtx, tpl } = props;
    const owner = useCommentMarkerOwner(viewCtx, tpl);
  useViewVariants(viewCtx, useShallow((variantState) => [variantState.frames, variantState.global, variantState.isEditingNonBaseVariant]));
  useViewSelection(viewCtx, (state) => state.context);
    const commentsCtx = viewCtx.studioCtx.commentsCtx;
    const variants = owner.alive ? getSetOfPinnedVariantsForViewCtx(
      viewCtx,
      viewCtx.bundler(),
    ) : [];
    const variantKey = getSubjectVariantsKey(tpl, variants);
    const commentCount = useStore(
      commentsCtx.store,
      (state) => state.commentStatsByVariant.get(variantKey)?.commentCount ?? 0,
    );
    if (!owner.alive) {return null;}
    const spotlightComponent = viewCtx.currentComponentCtx()?.component();
    const ownerComponent = tryGetTplOwnerComponent(tpl);
    const isRecording = viewCtx.isEditingNonBaseVariant;

    // Don't show the add comment marker if the component is in spotlight mode
    // and is a child of the spotlighted component.
    const isSpotlightChild = ownerComponent === spotlightComponent;

    if (!ownerComponent || !isTplNamable(tpl) || isSpotlightChild) {
      return null;
    }

    const offsetRight = commentCount * HORIZONTAL_MARKER_OFFSET;
    return (
      <CanvasCommentOverlay
        tpl={tpl}
        viewCtx={viewCtx}
        className={"AddCommentMarker"}
        offsetRight={
          // push the add comment marker to right if comment marker any exist
          offsetRight
            ? THREAD_MARKER_MARGIN + offsetRight + ADD_COMMENT_MARKER_MARGIN
            : ADD_COMMENT_INDIVIDUAL_MARKER_MARGIN
        }
      >
        <Tooltip title={uiT("New comment")}>
          <AddCommentMarker
            isRecording={isRecording}
            icon={{
              onClick: (e) => {
                e.stopPropagation();
                if (!owner.isCurrent()) {return;}
                commentsCtx.openNewCommentDialog(
                  viewCtx,
                  tpl,
                  Box.fromRectSides(e.currentTarget.getBoundingClientRect()),
                );
              },
            }}
          />
        </Tooltip>
      </CanvasCommentOverlay>
    );
  },
);

const CanvasSubjectCommentMarkers = React.memo(function CanvasSubjectCommentMarkers({
  subjectCommentThreads,
  viewCtx,
}: {
  subjectCommentThreads: TplCommentThread[];
  viewCtx: ViewCtx;
}) {
  const [hoveredThreadId, setHoveredThreadId] = React.useState<string | null>(
    null,
  );
  const commentsCtx = viewCtx.studioCtx.commentsCtx;
  const openedThreadId = useStore(commentsCtx.dialogStore, (state) =>
    subjectCommentThreads.some(
      (thread) => thread.id === state.thread?.threadId,
    )
      ? state.thread?.threadId
      : undefined,
  );

  const focusedIndex = subjectCommentThreads.findIndex(
    (t) => t.id === (hoveredThreadId ?? openedThreadId),
  );

  return (
    <>
      {subjectCommentThreads.map((commentThread, index, arr) => {
        let zIndex;
        if (focusedIndex === -1) {
          // No hover or selection — use base decreasing z-index
          zIndex = COMMENT_MARKER_INITIAL_Z_INDEX + arr.length - index;
        } else {
          // Calculate relative to the focused (hovered/selected) index
          const distance = Math.abs(index - focusedIndex);
          zIndex = arr.length + COMMENT_MARKER_INITIAL_Z_INDEX - distance;
        }

        return (
          <CanvasCommentMarker
            key={commentThread.id}
            offsetRight={
              THREAD_MARKER_MARGIN + index * HORIZONTAL_MARKER_OFFSET
            }
            zIndex={zIndex}
            commentThread={commentThread}
            viewCtx={viewCtx}
            onHoverChange={(hovering) =>
              setHoveredThreadId(hovering ? commentThread.id : null)
            }
          />
        );
      })}
    </>
  );
});

export const CanvasCommentMarkers = React.memo(function CanvasCommentMarkers(props: {arena: AnyArena; arenaFrame: ArenaFrame}) {
  const studio = useStudioCtx();
  const owner = useCanvasComponentInputs(studio, props.arenaFrame, noCanvasModelFields);
  const view = useViewEntryForFrame(studio, props.arenaFrame)?.view;
  const runtime = useCanvasViewInputs(view, noCanvasModelFields);
  return owner.alive && (!view || runtime.alive) ? <CanvasCommentMarkersContent {...props} /> : null;
});

function CanvasCommentMarkersContent({
  arenaFrame,
}: {
  arena: AnyArena;
  arenaFrame: ArenaFrame;
}) {
  const studioCtx = useStudioCtx();
  useStudioArena(studioCtx, (state) => state.frames);
  useCanvasTransforming(studioCtx);
  useViewportValue(studioCtx, (state) => state.visibleScalerBox);
  const viewCtx = useViewEntryForFrame(studioCtx, arenaFrame)?.view;
  useStudioLiveMode(studioCtx);
  useStudioSelection(studioCtx, (state) => state.view === viewCtx);
  useViewVariants(viewCtx, useShallow((variantState) => [variantState.frames, variantState.global]));
  useViewSelection(viewCtx, (state) => state.tpls);
  const commentsCtx = studioCtx.commentsCtx;
  const frameKey = viewCtx
    ? getCommentFrameKey(
        viewCtx.component,
        getSetOfPinnedVariantsForViewCtx(viewCtx, viewCtx.bundler()),
      )
    : undefined;
  const threadsForFrame =
    useStore(commentsCtx.store, (state) =>
      frameKey ? state.unresolvedThreadsByFrame.get(frameKey) : undefined,
    ) ?? emptyThreads;
  const focusedTpls = withoutNils(viewCtx?.focusedTpls() ?? []);

  useRerenderOnUserBodyChange(studioCtx, viewCtx);

  useStudioRenderPolicy(studioCtx, (policy) => policy.devMode);
  useStudioOverlayState(studioCtx, (state) => state.screenshotting || state.resizeDragging);
  const shouldHideCommentMarker =
    studioCtx.shouldHideUIOverlay() || !viewCtx || !viewCtx.isVisible();

  if (shouldHideCommentMarker) {
    return null;
  }

  const threadsGroupedBySubject = xGroupBy(
    threadsForFrame,
    (thread) => thread.subjectInfo?.subject.uuid,
  );

  return (
    <>
      {focusedTpls.map((tpl) => (
        <CanvasAddCommentMarker key={tpl.uuid} viewCtx={viewCtx} tpl={tpl} />
      ))}
      {[...threadsGroupedBySubject.entries()].map(
        ([subjectKey, subjectCommentThreads]) => (
          <CanvasSubjectCommentMarkers
            key={subjectKey}
            subjectCommentThreads={subjectCommentThreads}
            viewCtx={viewCtx}
          />
        ),
      )}
    </>
  );
}

export const CanvasCommentOverlay = React.memo(function CanvasCommentOverlay({
  tpl,
  children,
  viewCtx,
  onClick,
  className,
  offsetRight,
  zIndex = COMMENT_MARKER_INITIAL_Z_INDEX,
}: {
  tpl: TplNode;
  children?: ReactNode;
  viewCtx: ViewCtx;
  onClick?: (e: any) => void;
  className?: string;
  offsetRight: number;
  zIndex?: number;
}) {
  const owner = useCommentMarkerOwner(viewCtx, tpl);
  useViewSelection(viewCtx, (state) => state.context);
  useViewVariants(viewCtx, useShallow((variantState) => [variantState.frames, variantState.global]));
  const renderCount = useCanvasRenderCount(viewCtx);
  if (!owner.alive || renderCount === 0) {
    return null;
  }

  const [_, doms] = viewCtx.maybeDomsForTpl(tpl, {
    ignoreFocusedCloneKey: true,
  });

  const $elt = $(doms ?? []);

  if (!$elt || $elt.length === 0) {
    return null;
  }


  return createPortal(
    <CanvasTransformedBox
      relativeTo={"arena"}
      $elt={$elt}
      viewCtx={viewCtx}
      style={{ zIndex }}
      className="ElementHighlightBoxContainer"
      // Anchor markers to the visible part of the element so they never float
      // outside the artboard over Studio UI.
      clipToVisible
    >
      <div
        className={className}
        onClick={(event) => {if (owner.isCurrent()) {onClick?.(event);}}}
        style={{
          right: `calc(0% - ${offsetRight}px)`,
        }}
      >
        {children}
      </div>
    </CanvasTransformedBox>,
    ensure(document.querySelector(".canvas-editor__scaler"), ""),
  );
});
