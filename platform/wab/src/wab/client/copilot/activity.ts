import { ensure } from "@/wab/shared/common";
import type { CopilotCaller } from "@/wab/shared/copilot/copilot-tool-types";
import { findLast } from "lodash";
import { observable, runInAction } from "mobx";

export interface ActivityTarget {
  componentUuid?: string;
  elementUuid?: string;
  ancestorUuids?: string[];
  canvasName?: string;
  frameUuid?: string;
  label: string;
}

export interface CanvasActivity {
  id: number;
  targets: ActivityTarget[];
  status: "running" | "success";
  scanning: boolean;
  kind: "edit" | "inspection";
  caller?: CopilotCaller;
}

const MIN_SCAN_MS = 1600;
const COMPLETION_MS = 400;

export interface ActivityRegion {
  key: string;
  target: ActivityTarget;
  request: CanvasActivity;
  count: number;
  scanning: boolean;
}

/** Prefer an active edit over the completion of another request. */
export function currentActivity(requests: readonly CanvasActivity[]) {
  return (
    findLast(requests, (r) => r.status === "running") ??
    requests[requests.length - 1]
  );
}

/** Editor UI state only; never part of the site model or undo history. */
export class CopilotActivity {
  readonly requests = observable.array<CanvasActivity>([], { deep: false });
  private nextId = 0;
  private timers = new Set<ReturnType<typeof setTimeout>>();

  /** Each retained request holds one reference per node, including its exit delay. */
  get regions(): ActivityRegion[] {
    const nodes = new Map<
      string,
      { target: ActivityTarget; requests: CanvasActivity[] }
    >();
    for (const request of this.requests) {
      const seen = new Set<string>();
      for (const target of request.targets) {
        const key = JSON.stringify([
          target.componentUuid,
          target.elementUuid,
          target.canvasName,
          target.frameUuid,
        ]);
        if (seen.has(key)) {
          continue;
        }
        seen.add(key);
        const node = nodes.get(key);
        if (node) {
          node.requests.push(request);
        } else {
          nodes.set(key, { target, requests: [request] });
        }
      }
    }
    return Array.from(nodes, ([key, node]) => ({
      key,
      target: node.target,
      request: ensure(
        currentActivity(node.requests),
        "Active node has no requests",
      ),
      count: node.requests.length,
      scanning: node.requests.some((request) => request.scanning),
    }));
  }

  begin(targets: ActivityTarget[], kind: CanvasActivity["kind"] = "edit", caller?: CopilotCaller) {
    const request: CanvasActivity = {
      id: ++this.nextId,
      targets,
      status: "running",
      scanning: true,
      kind,
      caller,
    };
    const started = Date.now();
    let finished = false;
    runInAction(() => this.requests.push(request));
    return (status: "success" | "error") => {
      if (finished) {
        return;
      }
      finished = true;
      const index = this.requests.findIndex((r) => r.id === request.id);
      if (index < 0) {
        return;
      }
      if (status === "error") {
        runInAction(() => this.requests.remove(this.requests[index]));
        return;
      }
      runInAction(() => {
        this.requests[index] = { ...request, status };
      });
      // Report the result immediately; only the canvas animation has a minimum duration.
      const stopScan = () => {
        const currentIndex = this.requests.findIndex((r) => r.id === request.id);
        if (currentIndex < 0) {
          return;
        }
        runInAction(() => {
          this.requests[currentIndex] = {
            ...this.requests[currentIndex],
            scanning: false,
          };
        });
        const timer = setTimeout(() => {
          this.timers.delete(timer);
          runInAction(() => {
            const current = this.requests.find((r) => r.id === request.id);
            if (current) {
              this.requests.remove(current);
            }
          });
        }, COMPLETION_MS);
        this.timers.add(timer);
      };
      const remaining = MIN_SCAN_MS - (Date.now() - started);
      if (remaining > 0) {
        const timer = setTimeout(() => {
          this.timers.delete(timer);
          stopScan();
        }, remaining);
        this.timers.add(timer);
      } else {
        stopScan();
      }
    };
  }

  dispose() {
    this.timers.forEach(clearTimeout);
    this.timers.clear();
    runInAction(() => this.requests.clear());
  }
}

export function activityTargets(
  name: string,
  input: Record<string, unknown>,
): Omit<ActivityTarget, "label">[] {
  if (name === "executeBatch") {
    return (
      input.operations as { name: string; input: Record<string, unknown> }[]
    ).flatMap((op) => activityTargets(op.name, op.input));
  }
  if (typeof input.componentUuid === "string") {
    const target = {
      componentUuid: input.componentUuid,
      elementUuid:
        typeof input.elementUuid === "string" ? input.elementUuid : undefined,
    };
    return typeof input.targetUuid === "string"
      ? [
          target,
          { componentUuid: input.componentUuid, elementUuid: input.targetUuid },
        ]
      : [target];
  }
  if (typeof input.canvasName === "string") {
    return [
      {
        canvasName: input.canvasName,
        frameUuid:
          typeof input.frameUuid === "string" ? input.frameUuid : undefined,
      },
    ];
  }
  return [{}];
}

export function activityText(request: CanvasActivity) {
  return request.kind === "inspection" ? "Read" : "Edit";
}
