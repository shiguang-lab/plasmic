import { useInlineAddInputs } from "@/wab/client/components/canvas/HoverBox/inline-add-inputs";
import { parentStackStyleProvider } from "@/wab/client/components/canvas/HoverBox/parent-stack-inputs";
import { useStyleCells } from "@/wab/client/studio-ctx/style-inputs-react";
import type { NativeStyleProvider } from "@/wab/client/studio-ctx/style-inputs";
import { useViewVariants } from "@/wab/client/studio-ctx/variant-state";
import { useCanvasRenderCount } from "@/wab/client/hooks/useCanvasRenderStatus";
import { useShallow } from "zustand/react/shallow";
import type { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import type { TplNode } from "@/wab/shared/model/classes";
import { useStudioSelection, useViewSelection } from "@/wab/client/studio-ctx/selection-state";
import { useEditingTextContext } from "@/wab/client/studio-ctx/editing-text-state";
import { useCanvasZoom } from "@/wab/client/studio-ctx/viewport-state";
import styles from "@/wab/client/components/canvas/HoverBox/InlineAddButton.module.scss";
import { Icon } from "@/wab/client/components/widgets/Icon";
import PlusIcon from "@/wab/client/plasmic/plasmic_kit/PlasmicIcon__Plus";
import { useStudioCtx } from "@/wab/client/contexts/StudioContexts";
import { getContainerType } from "@/wab/client/utils/tpl-client-utils";
import { SlotSelection } from "@/wab/shared/core/slots";
import {
  isComponentRoot,
  isTplColumn,
  isTplContainer,
  isTplTagOrComponent,
  isTplTextBlock,
} from "@/wab/shared/core/tpls";
import { ContainerLayoutType } from "@/wab/shared/layoututils";
import { TplTag, isKnownTplNode } from "@/wab/shared/model/classes";
import cn from "classnames";
import * as React from "react";

const BUTTON_SIZE = 30;
const BUTTON_MARGIN = 15;

export const InlineAddButton = React.memo(function InlineAddButton({
  elementWidth = 0,
  elementHeight = 0,
  dimensionsBoxWidth = 0,
}: {
  elementWidth?: number;
  elementHeight?: number;
  dimensionsBoxWidth?: number;
}) {
  const studioCtx = useStudioCtx();
  useStudioSelection(studioCtx, (state) => state.view);
  const viewportZoom = useCanvasZoom(studioCtx);

  const viewCtx = studioCtx.focusedViewCtx();
  const selection = useViewSelection(viewCtx, useShallow((state) => [state.targets, state.tpls, state.context]));
  const variants = useViewVariants(viewCtx, useShallow((state) => [state.frames, state.global]));
  const renderCount = useCanvasRenderCount(viewCtx);
  const scope = React.useMemo(() => viewCtx ? { models: studioCtx.modelSnapshots, signal: viewCtx.disposeSignal } : undefined, [viewCtx, studioCtx.modelSnapshots]);
  const active = !!scope && !!viewCtx && !scope.signal.aborted && scope.models === studioCtx.modelSnapshots && studioCtx.arenaState.isCurrentLifetime(viewCtx.modelLifetime);
  const focusedNode = active ? viewCtx?.focusedTplOrSlotSelection() : undefined;
  const editingTextContext = useEditingTextContext(viewCtx);
  const ready = useInlineAddInputs(viewCtx, isKnownTplNode(focusedNode) ? focusedNode : undefined, selection);
  const parent = ready && isKnownTplNode(focusedNode) ? focusedNode.parent : undefined;
  const provider = React.useMemo(() => active && ready && viewCtx && parent && isTplTagOrComponent(parent) ? parentStackStyleProvider(viewCtx, parent) : undefined, [active, ready, viewCtx, parent, variants, selection, renderCount]);
  const shouldShowButton =
    active && ready && !editingTextContext &&
    viewCtx?.focusedSelectable() &&
    !(isTplTextBlock(focusedNode) && isTplTextBlock(focusedNode.parent));
  const isColumn = isKnownTplNode(focusedNode) && isTplColumn(focusedNode);
  const isSlot = focusedNode instanceof SlotSelection;
  const isContainer =
    isKnownTplNode(focusedNode) && isTplContainer(focusedNode);
  const isEmptyContainer =
    isContainer && (focusedNode as TplTag)?.children?.length === 0;
  const _isComponentRoot =
    isKnownTplNode(focusedNode) && isComponentRoot(focusedNode);
  const canRenderButtonInside =
    isSlot || isEmptyContainer || _isComponentRoot || isColumn;
  if (!ready || !shouldShowButton || !viewCtx) { return null; }
  const placement = { studioCtx, viewportZoom, canRenderButtonInside, elementWidth, elementHeight, dimensionsBoxWidth };
  return provider && parent
    ? <InlineAddParentLayout {...placement} provider={provider} viewCtx={viewCtx} parent={parent} />
    : <InlineAddPlacement {...placement} parentIsFlexRow={false} />;
});

interface PlacementProps { studioCtx: StudioCtx; viewportZoom: number; canRenderButtonInside: boolean; elementWidth: number; elementHeight: number; dimensionsBoxWidth: number; }
function InlineAddParentLayout({ provider, viewCtx, parent, ...placement }: PlacementProps & { provider: NativeStyleProvider; viewCtx: ViewCtx; parent: TplNode }) {
  useStyleCells(provider, ["display", "flex-direction"]);
  const parentIsFlexRow = getContainerType(parent, viewCtx) === ContainerLayoutType.flexRow;
  return <InlineAddPlacement {...placement} parentIsFlexRow={parentIsFlexRow} />;
}

function InlineAddPlacement({ studioCtx, viewportZoom, canRenderButtonInside, elementWidth, elementHeight, dimensionsBoxWidth, parentIsFlexRow }: PlacementProps & { parentIsFlexRow: boolean }) {
  const visibleWidth = elementWidth * viewportZoom;
  const visibleHeight = elementHeight * viewportZoom;

  // Enough space depends on where it'll be rendered
  const hasEnoughSpace =
    !parentIsFlexRow && !canRenderButtonInside
      ? // In case it'll be rendered on the right bottom edge
        visibleWidth > dimensionsBoxWidth + BUTTON_SIZE * 2 + BUTTON_MARGIN * 3
      : // Else
        visibleHeight > BUTTON_SIZE * 2 + BUTTON_MARGIN * 3;

  // When the visible width is smalled than the dimensions box,
  // we need to displace the button properly
  const shouldAddExtraSpacing =
    !hasEnoughSpace && visibleWidth < dimensionsBoxWidth;

  return (
    <>
      <button
        className={cn(styles.inlineAddButton, {
          [styles.inside]: canRenderButtonInside,
          [styles.bottomEdge]: !parentIsFlexRow && !canRenderButtonInside,
          [styles.rightEdge]: parentIsFlexRow && !canRenderButtonInside,
          [styles.outside]: !hasEnoughSpace,
        })}
        style={
          shouldAddExtraSpacing
            ? {
                transform: `translateX(${
                  (dimensionsBoxWidth - visibleWidth) / 2
                }px) `,
              }
            : {}
        }
        onClick={() =>
          studioCtx.changeUnsafe(() => studioCtx.setShowInlineAddDrawer(true))
        }
        data-event="add-button-inlined"
      >
        <Icon icon={PlusIcon} />
      </button>
    </>
  );
}
