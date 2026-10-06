import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { getArenaFrames } from "@/wab/shared/Arenas";
import { assert, mkShortId } from "@/wab/shared/common";
import { getSiteArenas } from "@/wab/shared/core/sites";
import type { Component } from "@/wab/shared/model/classes";

const inspections = new WeakMap<
  StudioCtx,
  Map<string, { release: () => void; finished: Promise<unknown> }>
>();

/** Pin a background canvas for a desktop DOM read without changing the user's arena or selection. */
export function beginCanvasInspection(
  studio: StudioCtx,
  component?: Component,
  options: { frameUuid?: string; forExport?: boolean } = {},
) {
  const target =
    component ??
    getSiteArenas(studio.site)
      .flatMap((arena) => getArenaFrames(arena))
      .find((frame) => frame.uuid === options.frameUuid)?.container.component;
  assert(target, "No component renders the requested frame");
  let leases = inspections.get(studio);
  if (!leases) {
    leases = new Map();
    inspections.set(studio, leases);
  }
  const active = leases;
  const inspectionId = mkShortId();
  return new Promise<{
    inspectionId: string;
    componentUuid: string;
    frameUuid: string;
  }>((resolve, reject) => {
    let prepared = false;
    const finished = Promise.resolve().then(() =>
      studio.withBackgroundViewCtxForComponent(
        target,
        async (viewCtx) => {
          const previousExporting = viewCtx.canvasExporting.get();
          try {
            if (options.forExport) {
              viewCtx.canvasExporting.set(true);
              viewCtx.scheduleSync({ eval: true, styles: false, asap: true });
            }
            await viewCtx.awaitSync();
            const root = viewCtx.canvasCtx.doc().documentElement;
            const previousId = root.getAttribute(
              "data-plasmic-canvas-inspection",
            );
            let release: () => void;
            const released = new Promise<void>((done) => {
              release = done;
            });
            const timer = setTimeout(() => release(), 120000);
            root.setAttribute("data-plasmic-canvas-inspection", inspectionId);
            active.set(inspectionId, { release: () => release(), finished });
            prepared = true;
            resolve({
              inspectionId,
              componentUuid: target.uuid,
              frameUuid: viewCtx.arenaFrame().uuid,
            });
            try {
              await released;
            } finally {
              clearTimeout(timer);
              if (previousId === null) {
                root.removeAttribute("data-plasmic-canvas-inspection");
              } else {
                root.setAttribute("data-plasmic-canvas-inspection", previousId);
              }
              active.delete(inspectionId);
            }
            return true;
          } finally {
            if (options.forExport) {
              viewCtx.canvasExporting.set(previousExporting);
              viewCtx.scheduleSync({ eval: true, styles: false, asap: true });
              await viewCtx.awaitSync();
            }
          }
        },
        { frameUuid: options.frameUuid },
      ),
    );
    finished.then(() => {
      if (!prepared) {
        reject(new Error("No canvas renders this component"));
      }
    }, reject);
  });
}

export async function endCanvasInspection(
  studio: StudioCtx,
  inspectionId: string,
) {
  const lease = inspections.get(studio)?.get(inspectionId);
  if (!lease) {
    return { released: false };
  }
  lease.release();
  await lease.finished;
  return { released: true };
}
