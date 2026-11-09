import { useCanvasOverlayToolbarInputs } from "@/wab/client/components/canvas/canvas-overlay-toolbar-inputs";
import { useStudioRenderPolicy } from "@/wab/client/studio-ctx/studio-render-policy";
import styles from "@/wab/client/components/canvas/CanvasOverlayToolbar.module.scss";
import { useI18n } from "@/wab/client/i18n";
import EyeIcon from "@/wab/client/plasmic/plasmic_kit/PlasmicIcon__Eye";
import { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { useStore } from "zustand";
import * as React from "react";

export const CanvasOverlayToolbar = React.memo(function CanvasOverlayToolbar({
  viewCtx,
  fallback = false,
}: {
  viewCtx: ViewCtx;
  fallback?: boolean;
}) {
  const inputs = useCanvasOverlayToolbarInputs(viewCtx);
  const { t: uiT } = useI18n();
  const interactive = useStudioRenderPolicy(viewCtx.studioCtx, (policy) => policy.interactive);
  if (!inputs || !inputs.hasSingleSelection || interactive || (fallback && inputs.hasDomSelection) || !inputs.overlays.length) {
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
      {inputs.overlays.map(({ label, fullKey, instance }) => <CanvasOverlayToggle key={fullKey} viewCtx={viewCtx} instance={instance} label={label} />)}
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
