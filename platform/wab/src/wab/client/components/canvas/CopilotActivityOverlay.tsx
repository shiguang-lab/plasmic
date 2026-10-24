import styles from "@/wab/client/components/canvas/CopilotActivityOverlay.module.scss";
import { createAgentCursor } from "@/wab/client/copilot/agent-cursor";
import {
  ActivityTarget,
  CanvasActivity,
  activityText,
  currentActivity,
} from "@/wab/client/copilot/activity";
import { useI18n } from "@/wab/client/i18n";
import { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { getArenaName, getFrameHeight } from "@/wab/shared/Arenas";
import { ancestorsUp, flattenTpls } from "@/wab/shared/core/tpls";
import { ensure } from "@/wab/shared/common";
import { findLast, groupBy } from "lodash";
import { ArenaFrame, TplNode } from "@/wab/shared/model/classes";
import { createStyles } from "antd-style";
import classNames from "classnames";
import { observer } from "mobx-react";
import React from "react";

const useActivityStyles = createStyles(({ token }) => ({
  root: {
    "--scan-color": token.colorPrimary,
    "--activity-label-text": token.colorTextLightSolid,
    "&[data-kind=inspection]": { "--scan-color": token.colorInfo },
  },
}));

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
  scanning,
  onBounds,
}: {
  viewCtx: ViewCtx;
  request: CanvasActivity;
  target: ActivityTarget;
  scanning: boolean;
  onBounds?: (bounds: Bounds | undefined) => void;
}) {
  const { t } = useI18n();
  const { styles: themeStyles } = useActivityStyles();
  const [region, setRegion] = React.useState<Bounds>();
  React.useEffect(() => {
    let animation: number;
    const update = () => {
      const frame = viewCtx.arenaFrame();
      let bounds: Bounds | undefined;
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
          (node) => node.uuid === target.elementUuid,
        );
        if (!tpl) {
          tpl = target.ancestorUuids
            ?.map((uuid) => tpls.find((node) => node.uuid === uuid))
            .find(Boolean);
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
          tpl = tpl.parent;
        }
      }
      setRegion((previous) => {
        return JSON.stringify(previous) === JSON.stringify(bounds)
          ? previous
          : bounds;
      });
      onBounds?.(bounds);
      animation = requestAnimationFrame(update);
    };
    update();
    return () => cancelAnimationFrame(animation);
  }, [viewCtx, target, onBounds]);

  if (!region) {
    return null;
  }
  const zoom = viewCtx.studioCtx.zoom;
  return (
    <div
      className={classNames(styles.region, themeStyles.root)}
      data-kind={request.kind}
      data-status={request.status}
      data-scanning={scanning}
      data-copilot-target={target.elementUuid ?? target.componentUuid ?? "page"}
      aria-hidden="true"
      style={{ ...region, borderWidth: 2 / zoom }}
    >
      <div className={styles.scan} />
      <div className={styles.label} style={{ transform: `scale(${1 / zoom})` }}>
        {t(activityText(request))}
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
  const cursorHost = React.useRef<HTMLDivElement>(null);
  const cursor = React.useRef<ReturnType<typeof createAgentCursor>>();
  const previousRequest = React.useRef<CanvasActivity>();
  const { t } = useI18n();
  const { styles: themeStyles } = useActivityStyles();
  const viewCtx = studioCtx.tryGetViewCtxForFrame(frame);
  React.useEffect(() => {
    if (!cursorHost.current || !viewCtx) {
      return;
    }
    const host = cursorHost.current;
    const instance = createAgentCursor(host, {
      label: t("AI assistant"),
      color: getComputedStyle(host).getPropertyValue("--scan-color").trim(),
      scale: () => studioCtx.zoom,
    });
    cursor.current = instance;
    return () => {
      instance.dispose();
      cursor.current = undefined;
    };
  }, [studioCtx, viewCtx, t]);
  const matchingRegions = studioCtx.copilotActivity.regions.filter(
    ({ target }) =>
      (!target.componentUuid ||
        target.componentUuid === frame.container.component.uuid) &&
      (!target.canvasName ||
        (studioCtx.currentArena &&
          getArenaName(studioCtx.currentArena) === target.canvasName)) &&
      (!target.frameUuid || target.frameUuid === frame.uuid),
  );
  const cursorRequest = currentActivity(
    matchingRegions.map((region) => region.request).filter((r) => r.kind === "edit").sort((a, b) => a.id - b.id),
  );
  React.useEffect(() => {
    // Failed requests disappear immediately; successful feedback may fade out.
    if (!cursorRequest && previousRequest.current?.status === "running") {
      cursor.current?.clear();
    }
    previousRequest.current = cursorRequest;
  }, [cursorRequest]);
  const onBounds = React.useCallback((bounds: Bounds | undefined) => {
    if (!bounds || !cursorRequest) {
      cursor.current?.clear();
      return;
    }
    cursor.current?.update(cursorRequest.id, {
      x: bounds.left + bounds.width / 2,
      y: bounds.top + bounds.height / 2,
    }, cursorRequest.status === "running");
  }, [cursorRequest]);
  if (!viewCtx) {
    return null;
  }
  // Scope fields select frames; once matched, they do not distinguish nodes.
  // A whole-component request and its root Tpl also address the same region.
  const regions = Object.entries(groupBy(matchingRegions, ({ target }) =>
    target.elementUuid ?? frame.container.component.tplTree.uuid,
  )).map(([key, matches]) => ({
    ...matches[0],
    key,
    request: ensure(
      currentActivity(matches.map(({ request }) => request).sort((a, b) => a.id - b.id)),
      "Matching activity region has no requests",
    ),
    scanning: matches.some(({ scanning }) => scanning),
  }));
  const tpls = new Map(
    regions.some(({ target }) => target.elementUuid)
      ? flattenTpls(frame.container.component.tplTree).map((tpl) => [tpl.uuid, tpl])
      : [],
  );
  // Keep nested activity of a different kind, but show each kind only at its
  // outermost target. Retain the requests so children return when parents finish.
  const visibleRegions = regions.filter(({ key, target, request }) => {
    if (!target.elementUuid) {
      return true;
    }
    const tpl = tpls.get(target.elementUuid);
    const ancestorUuids = new Set(
      tpl
        ? ancestorsUp(tpl, true).map((ancestor) => ancestor.uuid)
        : target.ancestorUuids,
    );
    return !regions.some(
      (parent) =>
        parent.key !== key &&
        parent.request.kind === request.kind &&
        (!parent.target.elementUuid ||
          ancestorUuids.has(parent.target.elementUuid)),
    );
  });
  const cursorRegion = findLast(visibleRegions, (region) => region.request.id === cursorRequest?.id)
    ?? findLast(visibleRegions, (region) => region.request.kind === "edit");
  return (
    <>
      <div ref={cursorHost} className={classNames(styles.cursorHost, themeStyles.root)} />
      {visibleRegions.map(({ key, request, target, scanning }) => (
        <ActivityRegion
          key={key}
          viewCtx={viewCtx}
          request={request}
          target={target}
          scanning={scanning}
          onBounds={key === cursorRegion?.key ? onBounds : undefined}
        />
      ))}
    </>
  );
});
