import styles from "@/wab/client/components/canvas/CopilotActivityOverlay.module.scss";
import {
  clipBox,
  computeClipBounds,
} from "@/wab/client/components/canvas/HoverBox/visible-bounds";
import {
  ActivityTarget,
  CanvasActivity,
  activityText,
  currentActivity,
} from "@/wab/client/copilot/activity";
import { createAgentCursor } from "@/wab/client/copilot/agent-cursor";
import { useI18n } from "@/wab/client/i18n";
import { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { getArenaFrames, getArenaName, getFrameHeight } from "@/wab/shared/Arenas";
import { ensure } from "@/wab/shared/common";
import { ancestorsUp, flattenTpls } from "@/wab/shared/core/tpls";
import { Box } from "@/wab/shared/geom";
import { ArenaFrame, TplNode } from "@/wab/shared/model/classes";
import { createStyles } from "antd-style";
import classNames from "classnames";
import { findLast, groupBy } from "lodash";
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

/**
 * Canvas DOM coordinates of the visible part of `elements`: clipped like the
 * selection outline (overflow ancestors in each element's containing block
 * chain and the artboard viewport), and to the `width`×`height` frame.
 */
export function activityBounds(
  elements: Element[],
  width: number,
  height: number,
): Bounds | undefined {
  const frame = { top: 0, left: 0, right: width, bottom: height };
  const visible = elements.flatMap((element) => {
    const box = clipBox(
      Box.fromRect(element.getBoundingClientRect()),
      computeClipBounds(element),
    );
    const inFrame = box && clipBox(box, frame);
    return inFrame ? [inFrame.rect()] : [];
  });
  return Box.mergeBBs(visible)?.posRect();
}

/** Where a target's scan is drawn. */
interface RegionLayout {
  /** The Tpl whose DOM is drawn, which may be an ancestor of the target. */
  drawnUuid: string;
  /** Ancestors of the drawn Tpl, nearest first, excluding itself. */
  drawnAncestorUuids: string[];
  /** Undefined when the drawn Tpl is entirely clipped. */
  bounds?: Bounds;
}

function measureRegion(
  viewCtx: ViewCtx,
  frame: ArenaFrame,
  tpls: Map<string, TplNode>,
  target: ActivityTarget,
): RegionLayout | undefined {
  const height = getFrameHeight(frame);
  const root = frame.container.component.tplTree;
  if (!target.elementUuid) {
    return {
      drawnUuid: root.uuid,
      drawnAncestorUuids: [],
      bounds: { left: 0, top: 0, width: frame.width, height },
    };
  }
  // Removed targets use their nearest surviving ancestor.
  let tpl: TplNode | null | undefined =
    tpls.get(target.elementUuid) ??
    target.ancestorUuids?.map((uuid) => tpls.get(uuid)).find(Boolean);
  // Slots, nonvisual code components and unrendered content use their nearest
  // rendered ancestor.
  while (tpl) {
    const val = viewCtx.renderState.tpl2bestVal(tpl, undefined);
    const doms = val && viewCtx.renderState.sel2dom(val, viewCtx.canvasCtx);
    if (doms?.length) {
      return {
        drawnUuid: tpl.uuid,
        drawnAncestorUuids: ancestorsUp(tpl, true).map(
          (ancestor) => ancestor.uuid,
        ),
        bounds: activityBounds(doms, frame.width, height),
      };
    }
    tpl = tpl.parent;
  }
  return undefined;
}

const ActivityRegion = observer(function ActivityRegion({
  viewCtx,
  request,
  target,
  scanning,
  bounds,
}: {
  viewCtx: ViewCtx;
  request: CanvasActivity;
  target: ActivityTarget;
  scanning: boolean;
  bounds: Bounds;
}) {
  const { t } = useI18n();
  const { styles: themeStyles } = useActivityStyles();
  const zoom = viewCtx.studioCtx.zoom;
  return (
    <div
      className={classNames(styles.region, themeStyles.root)}
      data-kind={request.kind}
      data-status={request.status}
      data-scanning={scanning}
      data-copilot-target={target.elementUuid ?? target.componentUuid ?? "page"}
      aria-hidden="true"
      style={{ ...bounds, borderWidth: 2 / zoom }}
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
  const { t } = useI18n();
  const { styles: themeStyles } = useActivityStyles();
  const viewCtx = studioCtx.tryGetViewCtxForFrame(frame);
  const matchesFrame = (target: ActivityTarget, candidate: ArenaFrame) =>
    (!target.componentUuid || target.componentUuid === candidate.container.component.uuid) &&
    (!target.canvasName || (studioCtx.currentArena && getArenaName(studioCtx.currentArena) === target.canvasName)) &&
    (!target.frameUuid || target.frameUuid === candidate.uuid);
  const matchingRegions = studioCtx.copilotActivity.regions.filter(
    ({ target }) => matchesFrame(target, frame),
  );
  const cursorRequest = studioCtx.copilotActivity.cursorActivity;
  const cursorFrame = cursorRequest && (
    studioCtx.currentArena ? getArenaFrames(studioCtx.currentArena) : [frame]
  ).find((candidate) => cursorRequest.targets.some((target) => matchesFrame(target, candidate)));
  const ownsCursor = cursorFrame === frame;
  React.useEffect(() => {
    if (!ownsCursor || !cursorHost.current || !viewCtx) {
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
  }, [studioCtx, viewCtx, t, ownsCursor]);
  // Scope fields select frames; once matched, they do not distinguish nodes.
  // A whole-component request and its root Tpl also address the same region.
  const regions = Object.entries(
    groupBy(
      matchingRegions,
      ({ target }) =>
        target.elementUuid ?? frame.container.component.tplTree.uuid,
    ),
  ).map(([key, matches]) => ({
    ...matches[0],
    key,
    request: ensure(
      currentActivity(
        matches.map(({ request }) => request).sort((a, b) => a.id - b.id),
      ),
      "Matching activity region has no requests",
    ),
    scanning: matches.some(({ scanning }) => scanning),
  }));
  // Render state is not observable, so follow the canvas DOM every frame.
  // Every region is measured, including suppressed ones, because suppression
  // depends on where each scan would be drawn.
  const [layouts, setLayouts] = React.useState<Record<string, RegionLayout>>(
    {},
  );
  const latestRegions = React.useRef(regions);
  latestRegions.current = regions;
  const regionKeys = JSON.stringify(regions.map(({ key }) => key));
  React.useEffect(() => {
    if (!viewCtx || !latestRegions.current.length) {
      // Idle frames don't poll the canvas DOM.
      setLayouts((previous) =>
        Object.keys(previous).length ? {} : previous,
      );
      return;
    }
    let animation: number;
    const update = () => {
      const arenaFrame = viewCtx.arenaFrame();
      const tpls = new Map(
        latestRegions.current.some(({ target }) => target.elementUuid)
          ? flattenTpls(arenaFrame.container.component.tplTree).map((tpl) => [
              tpl.uuid,
              tpl,
            ])
          : [],
      );
      const next: Record<string, RegionLayout> = {};
      for (const { key, target } of latestRegions.current) {
        const layout = measureRegion(viewCtx, arenaFrame, tpls, target);
        if (layout) {
          next[key] = layout;
        }
      }
      setLayouts((previous) =>
        JSON.stringify(previous) === JSON.stringify(next) ? previous : next,
      );
      animation = requestAnimationFrame(update);
    };
    update();
    return () => cancelAnimationFrame(animation);
  }, [viewCtx, regionKeys]);
  const placedRegions = regions.flatMap((region) => {
    const layout = layouts[region.key];
    return layout ? [{ ...region, layout }] : [];
  });
  // Targets drawn on the same element (e.g. an unrendered child and its
  // rendered parent) form one scan per kind.
  const drawnRegions = Object.values(
    groupBy(placedRegions, ({ layout, request }) =>
      JSON.stringify([layout.drawnUuid, request.kind]),
    ),
  ).map((matches) => ({
    ...(matches.find(({ key, layout }) => key === layout.drawnUuid) ??
      matches[0]),
    request: ensure(
      currentActivity(
        matches.map(({ request }) => request).sort((a, b) => a.id - b.id),
      ),
      "Drawn activity region has no requests",
    ),
    scanning: matches.some(({ scanning }) => scanning),
  }));
  // Keep nested activity of a different kind, but show each kind only at its
  // outermost drawn element. Retain the requests so children return when
  // parents finish.
  const outermostRegions = drawnRegions.filter(
    (region) =>
      !drawnRegions.some(
        (parent) =>
          parent !== region &&
          parent.request.kind === region.request.kind &&
          region.layout.drawnAncestorUuids.includes(parent.layout.drawnUuid),
      ),
  );
  const visibleRegions = outermostRegions.filter(
    ({ layout }) => !!layout.bounds,
  );
  // A clipped cursor region clears the cursor rather than leaving it behind.
  const cursorRegion =
    findLast(
      outermostRegions,
      (region) => region.request.id === cursorRequest?.id,
    ) ??
    findLast(outermostRegions, (region) => region.request.kind === "edit");
  const cursorBounds = cursorRegion?.layout.bounds;
  const cursorBoundsKey = JSON.stringify(cursorBounds);
  const cursorName = cursorRequest?.caller?.name ?? t("AI assistant");
  React.useEffect(() => {
    if (!cursorRegion) {
      return;
    }
    if (!cursorBounds || !cursorRequest) {
      cursor.current?.clear();
      return;
    }
    cursor.current?.update(
      cursorRequest.id,
      {
        x: cursorBounds.left + cursorBounds.width / 2,
        y: cursorBounds.top + cursorBounds.height / 2,
      },
      cursorName,
    );
    // Bounds are compared by value; the object changes on every measurement.
  }, [cursorRegion?.key, cursorBoundsKey, cursorRequest, cursorName, ownsCursor]);
  if (!viewCtx) {
    return null;
  }
  return (
    <>
      {ownsCursor && <div
        ref={cursorHost}
        className={classNames(styles.cursorHost, themeStyles.root)}
      />}
      {visibleRegions.map(({ key, request, target, scanning, layout }) => (
        <ActivityRegion
          key={key}
          viewCtx={viewCtx}
          request={request}
          target={target}
          scanning={scanning}
          bounds={ensure(layout.bounds, "Visible activity region has bounds")}
        />
      ))}
    </>
  );
});
