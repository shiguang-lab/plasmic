import styles from "@/wab/client/components/canvas/CanvasOverlayToolbar.module.scss";
import EyeIcon from "@/wab/client/plasmic/plasmic_kit/PlasmicIcon__Eye";
import { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { withoutNils } from "@/wab/shared/common";
import { getCanvasOverlayTargets } from "@/wab/shared/core/canvas-overlays";
import { isCodeComponent } from "@/wab/shared/core/components";
import { isSlotSelection } from "@/wab/shared/core/slots";
import { isValComponent } from "@/wab/shared/core/val-nodes";
import { observer } from "mobx-react";
import * as React from "react";

export const CanvasOverlayToolbar = observer(function CanvasOverlayToolbar({
  viewCtx,
  fallback = false,
}: {
  viewCtx: ViewCtx;
  fallback?: boolean;
}) {
  if (
    viewCtx.studioCtx.isInteractiveMode ||
    viewCtx.focusedTpls().filter(Boolean).length !== 1 ||
    (fallback && viewCtx.focusedDomElts().some((elt) => !!elt?.length))
  ) {
    return null;
  }
  const path = viewCtx.focusedTplAncestorsThroughComponents();
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
      })),
  );
  if (!overlays.length) {
    return null;
  }

  return (
    <div
      className={fallback ? styles.fallback : styles.toolbar}
      role="toolbar"
      aria-label="浮层编辑"
      onClick={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
      onMouseDown={(event) => {
        event.preventDefault();
        event.stopPropagation();
      }}
    >
      {overlays.map(({ tpl, fullKey }) => {
        const label =
          tpl.name || tpl.component.name.replace("plasmic-antd6-", "");
        const open = viewCtx.canvasOverlayOpen(fullKey);
        const action = `${open ? "收起" : "展开"} ${label} 内容`;
        return (
          <button
            className={styles.toggle}
            key={fullKey}
            type="button"
            title={action}
            aria-label={action}
            aria-pressed={open}
            onClick={() => viewCtx.setCanvasOverlayOpen(fullKey, !open)}
          >
            <EyeIcon aria-hidden="true" />
          </button>
        );
      })}
    </div>
  );
});
