import { useFreestyleState, useDragInsertState } from "@/wab/client/studio-ctx/canvas-insert-state";
import { useStudioOverlayState } from "@/wab/client/studio-ctx/studio-overlay-state";
import { useViewEntryForFrame } from "@/wab/client/studio-ctx/arena-state";
import { useStudioRenderPolicy } from "@/wab/client/studio-ctx/studio-render-policy";
import { useStore } from "zustand";
import { createStore } from "zustand/vanilla";
import { useCanvasTransforming } from "@/wab/client/studio-ctx/viewport-state";
import { CanvasTransformedBox } from "@/wab/client/components/canvas/CanvasTransformedBox";
import { useRerenderOnUserBodyChange } from "@/wab/client/components/canvas/UserBodyObserver";
import { Icon } from "@/wab/client/components/widgets/Icon";
import { InvalidArgsList } from "@/wab/client/components/widgets/InvalidArgs";
import { useStudioCtx } from "@/wab/client/contexts/StudioContexts";
import { hasLayoutBox } from "@/wab/client/dom";
import { UiText } from "@/wab/client/i18n/UiText";
import WarningIcon from "@/wab/client/plasmic/plasmic_kit_icons/icons/PlasmicIcon__WarningTriangleSvg";
import { RightTabKey } from "@/wab/client/studio-ctx/StudioCtx";
import { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { AnyArena } from "@/wab/shared/Arenas";
import { getTplComponentArg } from "@/wab/shared/TplMgr";
import { ensureBaseVariantSetting } from "@/wab/shared/Variants";
import { assert, last } from "@/wab/shared/common";
import {
  CodeComponent,
  getComponentDisplayName,
  getParamForVar,
  isCodeComponent,
} from "@/wab/shared/core/components";
import { InvalidArgMeta } from "@/wab/shared/core/invalid-arg";
import { getTplOwnerComponent } from "@/wab/shared/core/tpls";
import {
  ValComponent,
  flattenVals,
  isValComponent,
} from "@/wab/shared/core/val-nodes";
import { ArenaFrame, isKnownVarRef } from "@/wab/shared/model/classes";
import { Tooltip } from "antd";
import $ from "jquery";
import { useCanvasRenderCount } from "@/wab/client/hooks/useCanvasRenderStatus";
import { useCanvasViewInputs, noCanvasModelFields } from "@/wab/client/components/canvas/canvas-view-inputs";
import { useParentStackItemInputs } from "@/wab/client/components/canvas/HoverBox/parent-stack-inputs";
import React from "react";

const TooltipMessage = ({
  component,
  invalidArgs,
}: {
  component: CodeComponent;
  invalidArgs: InvalidArgMeta[];
}) => (
  <>
    <UiText
      message="The component {name} may not work properly because some props have an invalid value:"
      values={{ name: getComponentDisplayName(component) }}
    />
    <InvalidArgsList invalidArgs={invalidArgs} />
  </>
);

export const CanvasAction = React.memo(CanvasActionContent);
function CanvasActionContent(props: {
  viewCtx: ViewCtx;
  valComponent: ValComponent;
}) {
  const { viewCtx, valComponent } = props;
  useCanvasRenderCount(viewCtx);
  const alive = useParentStackItemInputs(viewCtx, valComponent, false);
  const dom = alive ? viewCtx.renderState.sel2dom(valComponent, viewCtx.canvasCtx) : undefined;
  const component = valComponent.tpl.component;
  const invalidArgs = valComponent.invalidArgs;
  const $elt = dom && $(dom);
  if (
    !isCodeComponent(component) ||
    !invalidArgs ||
    invalidArgs.length === 0 ||
    !dom ||
    !$elt ||
    $elt.toArray().filter(hasLayoutBox).length === 0
  ) {
    return null;
  }
  return (
    <CanvasTransformedBox
      relativeTo="frame"
      $elt={$elt}
      viewCtx={viewCtx}
      keepDims={true}
      // Pin the warning to the visible corner of the component, not to a
      // corner scrolled away or outside the artboard.
      clipToVisible
    >
      <div
        style={{
          zIndex: 1000,
          position: "relative",
          cursor: "pointer",
          top: -10,
          left: -10,
        }}
        onClick={(e) => {
          e.stopPropagation();
          if (viewCtx.disposeSignal.aborted || !viewCtx.studioCtx.arenaState.isCurrentLifetime(viewCtx.modelLifetime)) { return; }

          // We start enforcing the settings tab, so that it's clear where the user should change something
          viewCtx.studioCtx.switchRightTab(RightTabKey.style);

          const invalidTpl = valComponent.tpl;
          const invalidTplOwner = getTplOwnerComponent(invalidTpl);
          const invalidParam = invalidArgs[0].param;

          // If the invalid component is owned by the current component, we can just hightlight the tpl and param
          if (invalidTplOwner === viewCtx.currentComponent()) {
            viewCtx.setHighlightParams({
              params: [invalidParam],
              tpl: invalidTpl,
            });
            viewCtx.selectNewTpl(invalidTpl);
          } else {
            const valOwners = viewCtx.valState().valOwners(valComponent);
            assert(
              valOwners.length >= 1,
              "There should be at least one val owners in the path from valComponent to root",
            );

            // This is the tpl in the current view that owns the invalid tpl, we will highlight it
            const visibleTplOwner = last(valOwners).tpl;

            if (valOwners.length === 1) {
              // If there is only one val owners, it means that the we are one wrapping away from the current view,
              // we will check for linked props as a best effort to highlight the correct param
              const arg = getTplComponentArg(
                invalidTpl,
                ensureBaseVariantSetting(invalidTpl),
                invalidParam.variable,
              );

              if (arg && isKnownVarRef(arg.expr)) {
                // If it's a linked prop we highlight will get the respective param in the component
                const linkedParam = getParamForVar(
                  visibleTplOwner.component,
                  arg.expr.variable,
                );

                viewCtx.setHighlightParams({
                  params: [linkedParam],
                  tpl: visibleTplOwner,
                });
              }
            }

            viewCtx.selectNewTpl(visibleTplOwner);
          }
        }}
      >
        <Tooltip
          title={
            <TooltipMessage component={component} invalidArgs={invalidArgs} />
          }
        >
          {/* `Icon` gives the tooltip a DOM anchor. */}
          <Icon icon={WarningIcon} className="invalid-arg-warning" size={25} />
        </Tooltip>
      </div>
    </CanvasTransformedBox>
  );
}

const emptyValRootStore = createStore<ValComponent | null>(() => null);

export const CanvasActions = React.memo(CanvasActions_);
function CanvasActions_(props: { arena: AnyArena; arenaFrame: ArenaFrame }) {
  const studioCtx = useStudioCtx();
  useCanvasTransforming(studioCtx);
  useFreestyleState(studioCtx);
  useDragInsertState(studioCtx);
  useStudioRenderPolicy(studioCtx, (policy) => policy.devMode);
  const viewCtx = useViewEntryForFrame(studioCtx, props.arenaFrame)?.view;

  useCanvasRenderCount(viewCtx);
  const { alive } = useCanvasViewInputs(viewCtx, noCanvasModelFields);
  useRerenderOnUserBodyChange(studioCtx, alive ? viewCtx : undefined);

  const valRoot = useStore(viewCtx?.frameState.valRootStore ?? emptyValRootStore);
  useStudioOverlayState(studioCtx, (state) => state.screenshotting || state.resizeDragging);
  if (!alive || !viewCtx || viewCtx.studioCtx !== studioCtx || !valRoot || studioCtx.shouldHideUIOverlay()) {
    return null;
  }
  const invalidArgs = flattenVals(valRoot).filter((valNode) => {
    return (
      isValComponent(valNode) &&
      valNode.invalidArgs &&
      valNode.invalidArgs.length > 0
    );
  });
  return (
    <>
      {invalidArgs.map((valNode) => {
        assert(isValComponent(valNode), "checked before");
        return <CanvasAction viewCtx={viewCtx} valComponent={valNode} />;
      })}
    </>
  );
}
