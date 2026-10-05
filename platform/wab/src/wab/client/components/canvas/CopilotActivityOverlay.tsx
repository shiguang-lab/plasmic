import styles from "@/wab/client/components/canvas/CopilotActivityOverlay.module.scss";
import {
  ActivityTarget,
  CanvasActivity,
  activityText,
  currentActivity,
} from "@/wab/client/copilot/activity";
import { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { getArenaName, getFrameHeight } from "@/wab/shared/Arenas";
import { flattenTpls } from "@/wab/shared/core/tpls";
import { ArenaFrame, TplNode } from "@/wab/shared/model/classes";
import { observer } from "mobx-react";
import React from "react";

type Bounds = { left: number; top: number; width: number; height: number };

/** Canvas DOM coordinates, clipped to the frame and nested scroll containers. */
export function activityBounds(
  elements: Element[],
  width: number,
  height: number,
): Bounds | undefined {
  const rects = elements.flatMap((element) => {
    const rect = element.getBoundingClientRect();
    let left = Math.max(0, rect.left),
      top = Math.max(0, rect.top);
    let right = Math.min(width, rect.right),
      bottom = Math.min(height, rect.bottom);
    const win = element.ownerDocument.defaultView;
    for (
      let parent = element.parentElement;
      parent && win;
      parent = parent.parentElement
    ) {
      const css = win.getComputedStyle(parent);
      const bounds = parent.getBoundingClientRect();
      if (/^(hidden|clip|auto|scroll)$/.test(css.overflowX)) {
        left = Math.max(left, bounds.left);
        right = Math.min(right, bounds.right);
      }
      if (/^(hidden|clip|auto|scroll)$/.test(css.overflowY)) {
        top = Math.max(top, bounds.top);
        bottom = Math.min(bottom, bounds.bottom);
      }
    }
    return right > left && bottom > top ? [{ left, top, right, bottom }] : [];
  });
  if (!rects.length) {
    return undefined;
  }
  const left = Math.min(...rects.map((r) => r.left));
  const top = Math.min(...rects.map((r) => r.top));
  return {
    left,
    top,
    width: Math.max(...rects.map((r) => r.right)) - left,
    height: Math.max(...rects.map((r) => r.bottom)) - top,
  };
}

const ActivityRegion = observer(function ActivityRegion({
  viewCtx,
  request,
  target,
}: {
  viewCtx: ViewCtx;
  request: CanvasActivity;
  target: ActivityTarget;
}) {
  const [region, setRegion] = React.useState<{
    bounds: Bounds;
    enclosing: boolean;
  }>();
  React.useEffect(() => {
    let animation: number;
    const update = () => {
      const frame = viewCtx.arenaFrame();
      let bounds: Bounds | undefined;
      let enclosing = false;
      if (!target.elementUuid) {
        bounds = {
          left: 0,
          top: 0,
          width: frame.width,
          height: getFrameHeight(frame),
        };
      } else {
        const tpls = flattenTpls(frame.container.component.tplTree);
        let tpl: TplNode | null | undefined = tpls.find(
          (t) => t.uuid === target.elementUuid,
        );
        if (!tpl) {
          tpl = target.ancestorUuids
            ?.map((uuid) => tpls.find((t) => t.uuid === uuid))
            .find(Boolean);
          enclosing = true;
        }
        // Slots and nonvisual code components use their nearest rendered ancestor.
        while (tpl) {
          const val = viewCtx.renderState.tpl2bestVal(tpl, undefined);
          const doms =
            val && viewCtx.renderState.sel2dom(val, viewCtx.canvasCtx);
          if (doms?.length) {
            bounds = activityBounds(doms, frame.width, getFrameHeight(frame));
            break;
          }
          enclosing = true;
          tpl = tpl.parent;
        }
      }
      setRegion((previous) => {
        const next = bounds ? { bounds, enclosing } : undefined;
        return JSON.stringify(previous) === JSON.stringify(next)
          ? previous
          : next;
      });
      animation = requestAnimationFrame(update);
    };
    update();
    return () => cancelAnimationFrame(animation);
  }, [viewCtx, target]);

  if (!region) {
    return null;
  }
  const zoom = viewCtx.studioCtx.zoom;
  return (
    <div
      className={styles.region}
      data-mode={request.mode}
      data-status={request.status}
      data-copilot-target={target.elementUuid ?? target.componentUuid ?? "page"}
      aria-hidden="true"
      style={{ ...region.bounds, borderWidth: 2 / zoom }}
    >
      <div className={styles.scan} />
      <div className={styles.label} style={{ transform: `scale(${1 / zoom})` }}>
        {activityText(request)} · {target.label}
        {region.enclosing ? " (containing region)" : ""}
      </div>
    </div>
  );
});

export const CopilotActivityOverlay = observer(function CopilotActivityOverlay({
  studioCtx,
  frame,
}: {
  studioCtx: StudioCtx;
  frame: ArenaFrame;
}) {
  const viewCtx = studioCtx.tryGetViewCtxForFrame(frame);
  if (!viewCtx) {
    return null;
  }
  return (
    <>
      {studioCtx.copilotActivity.regions
        .filter(
          ({ target }) =>
            (!target.componentUuid ||
              target.componentUuid === frame.container.component.uuid) &&
            (!target.canvasName ||
              (studioCtx.currentArena &&
                getArenaName(studioCtx.currentArena) === target.canvasName)) &&
            (!target.frameUuid || target.frameUuid === frame.uuid),
        )
        .map(({ key, request, target }) => (
          <ActivityRegion
            key={key}
            viewCtx={viewCtx}
            request={request}
            target={target}
          />
        ))}
    </>
  );
});

export const CopilotActivityStatus = observer(function CopilotActivityStatus({
  studioCtx,
}: {
  studioCtx: StudioCtx;
}) {
  const requests = studioCtx.copilotActivity.requests;
  const request = currentActivity(requests);
  if (!request) {
    return null;
  }
  const label = Array.from(new Set(request.targets.map((t) => t.label))).join(
    ", ",
  );
  return (
    <div
      className={styles.status}
      data-mode={request.mode}
      data-status={request.status}
      role="status"
      aria-live="polite"
    >
      <span className={styles.dot} />
      <span>
        {activityText(request)} · {label}
      </span>
      {requests.length > 1 && <span>({requests.length} operations)</span>}
    </div>
  );
});
