// Only the private copy imports this measurement boundary.
import type { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import type { Box } from "@/wab/shared/geom";
import type { ValNode } from "@/wab/shared/core/val-nodes";
import { geometry } from "./probe";

export function measureProductionQuery(vc: ViewCtx, box: Box | undefined, candidate: () => ValNode[]) {
  const at=performance.now();
  const result=geometry.mode === "baseline"
    ? (window as any).__geometryBaseline(vc,box) as ValNode[]
    : candidate();
  if(geometry.samples.length<2000)geometry.samples.push({mode:geometry.mode,totalMs:performance.now()-at,selected:result.length});
  return result;
}
