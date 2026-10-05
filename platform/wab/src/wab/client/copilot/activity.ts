import { ensure } from "@/wab/shared/common";
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
  mode: "read" | "edit";
  targets: ActivityTarget[];
  status: "running" | "success" | "error";
}

export interface ActivityRegion {
  key: string;
  target: ActivityTarget;
  request: CanvasActivity;
  count: number;
}

/** Prefer an active edit/read over the completion of another request. */
export function currentActivity(requests: readonly CanvasActivity[]) {
  return (
    findLast(requests, (r) => r.status === "running" && r.mode === "edit") ??
    findLast(requests, (r) => r.status === "running") ??
    findLast(requests, (r) => r.status === "error") ??
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
    }));
  }

  begin(mode: CanvasActivity["mode"], targets: ActivityTarget[]) {
    const request: CanvasActivity = {
      id: ++this.nextId,
      mode,
      targets,
      status: "running",
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
      runInAction(() => {
        this.requests[index] = { ...request, status };
      });
      // Fast local reads must still be visible, without delaying tool responses.
      const timer = setTimeout(
        () => {
          this.timers.delete(timer);
          runInAction(() => {
            const current = this.requests.find((r) => r.id === request.id);
            if (current) {
              this.requests.remove(current);
            }
          });
        },
        Math.max(400, 1600 - (Date.now() - started)),
      );
      this.timers.add(timer);
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
  if (name === "read") {
    const targets = [
      ...((input.componentUuids ?? []) as string[]).map((componentUuid) => ({
        componentUuid,
      })),
      ...((input.elements ?? []) as ActivityTarget[]),
    ];
    return targets.length ? targets : [{}];
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
  if (request.status === "error") {
    return "Operation failed";
  }
  if (request.mode === "read") {
    return request.status === "running" ? "Reading" : "Read complete";
  }
  return request.status === "running" ? "Editing" : "Edit complete";
}
