import { parentStackStyleProvider, useParentStackItemInputs } from "@/wab/client/components/canvas/HoverBox/parent-stack-inputs";
import type { NativeStyleProvider } from "@/wab/client/studio-ctx/style-inputs";
import { useStyleCells } from "@/wab/client/studio-ctx/style-inputs-react";
import { useViewVariants } from "@/wab/client/studio-ctx/variant-state";
import { useShallow } from "zustand/react/shallow";
import type { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import type { ValComponent } from "@/wab/shared/core/val-nodes";
import { useStore } from "zustand";
import { createStore } from "zustand/vanilla";
import { useContentEditorScope } from "@/wab/client/studio-ctx/canvas-content-editor";
import { useStudioOverlayState } from "@/wab/client/studio-ctx/studio-overlay-state";
import { useCanvasRenderCount } from "@/wab/client/hooks/useCanvasRenderStatus";
import { useStudioSelection, useViewSelection } from "@/wab/client/studio-ctx/selection-state";
import styles from "@/wab/client/components/canvas/HoverBox/StackOfParents.module.scss";
import { createNodeIcon } from "@/wab/client/components/sidebar-tabs/tpl-tree";
import { FRAME_ICON, SLOT_ICON } from "@/wab/client/icons";
import { useStudioCtx } from "@/wab/client/contexts/StudioContexts";
import { getSlotSelectionDisplayName } from "@/wab/client/utils/tpl-client-utils";
import { FrameViewMode } from "@/wab/shared/Arenas";
import { SQ, Selectable } from "@/wab/shared/core/selection";
import { SlotSelection } from "@/wab/shared/core/slots";
import {
  isTplNamable,
  isTplTag,
  isTplTagOrComponent,
  isTplVariantable,
  summarizeTpl,
} from "@/wab/shared/core/tpls";
import { TplNode } from "@/wab/shared/model/classes";
import * as cssVariables from "@/wab/styles/css-variables";
import * as React from "react";
import { RefObject, useEffect, useMemo, useRef } from "react";

const AUTO_HIDE_TIMEOUT = 2000;
const noRoot = createStore<ValComponent | null>(() => null);

function useParentsOfFocusedSelectable() {
  const studioCtx = useStudioCtx();
  const contentScope = useContentEditorScope(studioCtx);
  useStudioSelection(studioCtx, (state) => state.view);
  const viewCtx = studioCtx.focusedViewCtx();
  const selection = useViewSelection(viewCtx, useShallow((state) => [state.targets, state.tpls, state.context]));
  const scope = useMemo(() => viewCtx ? { models: studioCtx.modelSnapshots, signal: viewCtx.disposeSignal } : undefined, [viewCtx, studioCtx.modelSnapshots]);
  const active = !!scope && !scope.signal.aborted && scope.models === studioCtx.modelSnapshots;
  const focusedSelectable = active ? viewCtx?.focusedSelectable() : undefined;
  const renderCount = useCanvasRenderCount(viewCtx);
  useStore(viewCtx ? viewCtx.frameState.valRootStore : noRoot);
  const valUserRoot = active ? viewCtx?.valState().maybeValUserRoot() : undefined;
  const isValRendered = !!valUserRoot;

  const parentsChain = useMemo(
    () =>
      !isValRendered ||
      !focusedSelectable ||
      (focusedSelectable instanceof SlotSelection && !focusedSelectable.val)
        ? []
        : SQ(focusedSelectable, viewCtx!.valState(), false)
            .parents()
            .toArray()
            .filter((selectable) => viewCtx?.contentEditor.contains(selectable))
            .map((selectable) => {
              const tpl = selectable.tpl;

              return {
                key:
                  (selectable instanceof SlotSelection &&
                    selectable.val?.fullKey) ||
                  tpl?.uuid,
                selectable,
                isUserRoot: selectable === valUserRoot,
              };
            })
            .reverse(),
    [viewCtx, focusedSelectable, isValRendered, valUserRoot, contentScope, renderCount, selection],
  );

  return parentsChain;
}

export const StackOfParents = React.memo(function StackOfParents({
  hoverTagRef,
}: {
  hoverTagRef: RefObject<HTMLDivElement | null>;
}) {
  const studioCtx = useStudioCtx();
  const stackOfParents = useStudioOverlayState(studioCtx, (state) => state.stackOfParents);
  useStudioSelection(studioCtx, (state) => state.view);
  const viewCtx = studioCtx.focusedViewCtx();
  useViewSelection(viewCtx, (state) => state.targets);
  const focusedSelectable = viewCtx?.focusedSelectable();
  const parentsChain = useParentsOfFocusedSelectable();

  useEffect(
    () => () => {
      studioCtx.setShowStackOfParents(false);
    },
    [focusedSelectable, studioCtx],
  );

  const onClickItem = (val?: Selectable) => (e: React.MouseEvent) => {
    if (val && viewCtx) {
      viewCtx.change(() =>
        viewCtx.getViewOps().tryFocusObj(val, {
          anchorCloneKey: viewCtx.focusedCloneKey(),
          appendToMultiSelection: e.shiftKey,
          exact: true,
        }),
      );
    }
  };

  const onMouseEnter = (val?: Selectable) => () =>
    viewCtx &&
    viewCtx.setViewCtxHoverBySelectable(val, viewCtx.focusedCloneKey());

  const onMouseLeave = () => viewCtx?.setViewCtxHoverBySelectable(null);

  const autoHideTimeoutRef = useRef(0);

  const cancelAutoHide = () => clearTimeout(autoHideTimeoutRef.current);

  const scheduleAutoHide = () => {
    cancelAutoHide();
    autoHideTimeoutRef.current = +setTimeout(() => {
      studioCtx.setShowStackOfParents(false);
    }, AUTO_HIDE_TIMEOUT);
  };

  useEffect(() => {
    if (stackOfParents) {
      scheduleAutoHide();
    } else {
      // To make sure there's no pending auto-hide execution
      cancelAutoHide();
    }
    return cancelAutoHide;
  }, [stackOfParents, studioCtx]);

  useEffect(() => {
    const tag = hoverTagRef.current;
    if (!tag) { return; }
    tag.addEventListener("mouseenter", cancelAutoHide);
    tag.addEventListener("mouseleave", scheduleAutoHide);
    return () => {
      tag.removeEventListener("mouseenter", cancelAutoHide);
      tag.removeEventListener("mouseleave", scheduleAutoHide);
    };
  }, [hoverTagRef, studioCtx]);

  return !parentsChain.length ? null : !stackOfParents ? (
    <div className={styles.visualHint} data-canvas-node-tree />
  ) : (
    <div
      className={styles.root}
      data-canvas-node-tree
      onMouseEnter={cancelAutoHide}
      onMouseLeave={scheduleAutoHide as any}
    >
      {parentsChain.map((it, i) => (
        <div
          key={it.key}
          className={styles.stackItem}
          onClick={onClickItem(it.selectable)}
          onMouseEnter={onMouseEnter(it.selectable)}
          onMouseLeave={onMouseLeave}
        >
          <div
            className={styles.stackItemBackground}
            style={{
              background: `var(${cssVariables.selectionControlsColor})`,
              filter: `brightness(${1 + (i - parentsChain.length) * 0.07})`,
            }}
          />
          <div>
            {viewCtx && <ParentStackItemContent viewCtx={viewCtx} selectable={it.selectable} isUserRoot={it.isUserRoot} />}
          </div>
        </div>
      ))}
    </div>
  );
});


function ParentStackItemContent({ viewCtx, selectable, isUserRoot }: { viewCtx: ViewCtx; selectable: Selectable; isUserRoot: boolean }) {
  const ready = useParentStackItemInputs(viewCtx, selectable, isUserRoot);
  const variants = useViewVariants(viewCtx, useShallow((state) => [state.frames, state.global]));
  const context = useViewSelection(viewCtx, (state) => state.context);
  const renderCount = useCanvasRenderCount(viewCtx);
  const tpl = selectable instanceof SlotSelection ? selectable.getTpl() : selectable.tpl;
  const needsStyle = ready && tpl && isTplTag(tpl) && !(selectable instanceof SlotSelection) && !(isUserRoot && viewCtx.arenaFrame().viewMode === FrameViewMode.Stretch);
  const provider = useMemo(() => needsStyle && tpl ? parentStackStyleProvider(viewCtx, tpl) : undefined, [viewCtx, tpl, variants, context, renderCount, needsStyle]);
  if (!ready || !tpl) { return null; }
  return provider
    ? <ParentStackItemStyleContent viewCtx={viewCtx} selectable={selectable} tpl={tpl} isUserRoot={isUserRoot} provider={provider} />
    : <ParentStackItemDescription viewCtx={viewCtx} selectable={selectable} tpl={tpl} isUserRoot={isUserRoot} />;
}

function ParentStackItemStyleContent({ viewCtx, selectable, tpl, isUserRoot, provider }: { viewCtx: ViewCtx; selectable: Selectable; tpl: TplNode; isUserRoot: boolean; provider: NativeStyleProvider }) {
  useStyleCells(provider, ["display", "flex-direction"]);
  return <ParentStackItemDescription viewCtx={viewCtx} selectable={selectable} tpl={tpl} isUserRoot={isUserRoot} />;
}

function ParentStackItemDescription({ viewCtx, selectable, tpl, isUserRoot }: { viewCtx: ViewCtx; selectable: Selectable; tpl: TplNode; isUserRoot: boolean }) {
  const studioCtx = viewCtx.studioCtx;
  const isFrame = isUserRoot && viewCtx.arenaFrame().viewMode === FrameViewMode.Stretch;
  const name = selectable instanceof SlotSelection
    ? getSlotSelectionDisplayName(selectable, viewCtx)
    : isFrame ? studioCtx.tplMgr().describeArenaFrame(viewCtx.arenaFrame())
      : isTplNamable(tpl) && tpl.name ? tpl.name
        : summarizeTpl(tpl, isTplVariantable(tpl) ? viewCtx.effectiveCurrentVariantSetting(tpl).rsh() : undefined);
  const icon = selectable instanceof SlotSelection ? SLOT_ICON : isFrame ? FRAME_ICON
    : createNodeIcon(tpl, isTplTagOrComponent(tpl) ? viewCtx.effectiveCurrentVariantSetting(tpl) : undefined);
  return <>{icon} {name}</>;
}
