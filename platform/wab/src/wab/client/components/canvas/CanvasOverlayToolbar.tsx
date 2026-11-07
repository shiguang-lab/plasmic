import { useStudioRenderPolicy } from "@/wab/client/studio-ctx/studio-render-policy";
import { useViewVariants } from "@/wab/client/studio-ctx/variant-state";
import { useViewSelection } from "@/wab/client/studio-ctx/selection-state";
import { useShallow } from "zustand/react/shallow";
import styles from "@/wab/client/components/canvas/CanvasOverlayToolbar.module.scss";
import { useI18n } from "@/wab/client/i18n";
import EyeIcon from "@/wab/client/plasmic/plasmic_kit/PlasmicIcon__Eye";
import { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { $$$ } from "@/wab/shared/TplQuery";
import { withoutNils } from "@/wab/shared/common";
import { getCanvasOverlayTargets } from "@/wab/shared/core/canvas-overlays";
import { isCodeComponent } from "@/wab/shared/core/components";
import { isSlotSelection } from "@/wab/shared/core/slots";
import { isValComponent } from "@/wab/shared/core/val-nodes";
import { observer } from "mobx-react";
import { useStore } from "zustand";
import * as React from "react";

export const CanvasOverlayToolbar = observer(function CanvasOverlayToolbar({
  viewCtx,
  fallback = false,
}: {
  viewCtx: ViewCtx;
  fallback?: boolean;
}) {
  useViewVariants(viewCtx, useShallow((variantState) => variantState.frames.map((frame) => frame.component)));
  useViewSelection(viewCtx, useShallow((state) => [state.context, state.doms, state.targets, state.tpls]));
  const { t: uiT } = useI18n();
  const interactive = useStudioRenderPolicy(viewCtx.studioCtx, (policy) => policy.interactive);
  if (
    interactive ||
    viewCtx.focusedTpls().filter(Boolean).length !== 1 ||
    (fallback && viewCtx.focusedDomElts().some((elt) => !!elt?.length))
  ) {
    return null;
  }
  const editableOwners = new Set(
    viewCtx.componentStackFrames().map((frame) => frame.component),
  );
  const path = viewCtx
    .focusedTplAncestorsThroughComponents()
    .filter(({ node }) => {
      const owner = $$$(
        isSlotSelection(node) ? node.getTpl() : node,
      ).tryGetOwningComponent();
      return owner !== undefined && editableOwners.has(owner);
    });
  const selected = path[0]?.node;
  const ancestors = withoutNils(
    path.map(({ node }) =>
      isSlotSelection(node) ? (node.tpl ?? node.val?.tpl) : node,
    ),
  );
  const targets = getCanvasOverlayTargets(
    viewCtx.currentComponent(),
    ancestors,
    {
      selectedSlot: isSlotSelection(selected)
        ? selected.slotParam.variable.name
        : undefined,
      getMeta: (tpl) =>
        isCodeComponent(tpl.component)
          ? viewCtx.getCodeComponentMeta(tpl.component)
          : undefined,
      getSetting: (tpl) => viewCtx.effectiveCurrentVariantSetting(tpl),
      getProp: (tpl, prop) =>
        viewCtx
          .maybeTpl2ValsInContext(tpl, { allowAnyContext: true })
          .filter(isValComponent)[0]?.codeComponentProps?.[prop],
    },
  );
  const overlays = targets.flatMap((tpl) =>
    viewCtx
      .maybeTpl2ValsInContext(tpl, { allowAnyContext: true })
      .filter(isValComponent)
      .map((val) => ({
        tpl,
        fullKey: val.fullKey,
        sessionInstance: val.codeComponentProps?.__plasmic_selection_prop__?.sessionInstance ?? val.fullKey,
      })),
  );
  if (!overlays.length) {
    return null;
  }

  return (
    <div
      className={fallback ? styles.fallback : styles.toolbar}
      role="toolbar"
      aria-label={uiT("Edit overlays")}
      onClick={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
      onMouseDown={(event) => {
        event.preventDefault();
        event.stopPropagation();
      }}
    >
      {overlays.map(({ tpl, fullKey, sessionInstance }) => {
        const label =
          tpl.name || tpl.component.name.replace("plasmic-antd6-", "");
        return <CanvasOverlayToggle key={fullKey} viewCtx={viewCtx} instance={sessionInstance} label={label} />;
      })}
    </div>
  );
});

function CanvasOverlayToggle({ viewCtx, instance, label }: { viewCtx: ViewCtx; instance: string; label: string }) {
  const { t: uiT } = useI18n();
  const open = useStore(viewCtx.canvasSessionState.instanceStore(instance), (state) => !!state.open?.value);
  const action = uiT(open ? "Hide {name} content" : "Show {name} content", { name: label });
  return <button className={styles.toggle} type="button" title={action} aria-label={action}
    aria-pressed={open} onClick={() => viewCtx.setCanvasOverlayOpen(instance, !open)}>
    <EyeIcon aria-hidden="true" />
  </button>;
}
