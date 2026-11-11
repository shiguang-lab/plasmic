import { AGENT_CURSOR_IDLE_MS } from "@/wab/client/copilot/agent-cursor";
import { ensure } from "@/wab/shared/common";
import type { CopilotCaller } from "@/wab/shared/copilot/copilot-tool-types";
import { findLast } from "lodash";
import { shallow } from "zustand/shallow";
import { createStore } from "zustand/vanilla";

export interface ActivityTarget {
  readonly componentUuid?: string;
  readonly elementUuid?: string;
  readonly ancestorUuids?: readonly string[];
  readonly canvasName?: string;
  readonly frameUuid?: string;
}

export interface CanvasActivity {
  readonly id: number;
  readonly targets: readonly ActivityTarget[];
  readonly status: "running" | "success";
  readonly scanning: boolean;
  readonly kind: "edit" | "inspection";
  readonly caller?: CopilotCaller;
}

const MIN_SCAN_MS = 1600;
const COMPLETION_MS = 400;

export interface ActivityRegion {
  readonly key: string;
  readonly target: ActivityTarget;
  readonly request: CanvasActivity;
  readonly count: number;
  readonly scanning: boolean;
}

/** Prefer an active edit over the completion of another request. */
export function currentActivity(requests: readonly CanvasActivity[]) {
  return (
    findLast(requests, (r) => r.status === "running") ??
    requests[requests.length - 1]
  );
}

interface ActivityState {
  readonly requests: readonly CanvasActivity[];
  readonly regions: readonly ActivityRegion[];
}

/** Editor UI state only; never part of the site model or undo history. */
export class CopilotActivity {
  private readonly state = createStore<ActivityState>(() => ({
    requests: [],
    regions: [],
  }));
  readonly store: Pick<
    typeof this.state,
    "getState" | "getInitialState" | "subscribe"
  > = this.state;
  // Cursor expiry and scan completion have independent lifetimes. Publish only
  // the chosen cursor so unrelated callers do not invalidate its consumers.
  private readonly cursorState = createStore<{
    readonly current: CanvasActivity | undefined;
  }>(() => ({ current: undefined }));
  readonly cursorStore: Pick<
    typeof this.cursorState,
    "getState" | "getInitialState" | "subscribe"
  > = this.cursorState;
  private cursorRequests: readonly CanvasActivity[] = [];
  private nextId = 0;
  private timers = new Map<number, ReturnType<typeof setTimeout>>();
  private cursorTimers = new Map<number, ReturnType<typeof setTimeout>>();
  private signalCleanups = new Map<number, () => void>();

  private setCursorRequests(requests: readonly CanvasActivity[]) {
    this.cursorRequests = requests;
    const current = currentActivity(requests);
    this.cursorState.setState(
      (previous) => (previous.current === current ? previous : { current }),
      true,
    );
  }

  private setRequests(requests: readonly CanvasActivity[]) {
    const previous = this.store.getState();
    if (shallow(previous.requests, requests)) {
      return;
    }
    const nodes = new Map<
      string,
      { target: ActivityTarget; requests: CanvasActivity[] }
    >();
    for (const request of requests) {
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
    const oldRegions = new Map(
      previous.regions.map((region) => [region.key, region]),
    );
    const regions = Array.from(nodes, ([key, node]) => {
      const next: ActivityRegion = {
        key,
        target: node.target,
        request: ensure(
          currentActivity(node.requests),
          "Active node has no requests",
        ),
        count: node.requests.length,
        scanning: node.requests.some((request) => request.scanning),
      };
      const old = oldRegions.get(key);
      return old && shallow(old, next) ? old : next;
    });
    this.state.setState(
      {
        requests,
        regions: shallow(previous.regions, regions)
          ? previous.regions
          : regions,
      },
      true,
    );
  }

  private clearRequestResources(id: number) {
    clearTimeout(this.timers.get(id));
    this.timers.delete(id);
    clearTimeout(this.cursorTimers.get(id));
    this.cursorTimers.delete(id);
    this.signalCleanups.get(id)?.();
    this.signalCleanups.delete(id);
  }

  clearCaller(callerId: string) {
    const belongs = (request: CanvasActivity) =>
      request.caller?.id === callerId;
    const requests = this.store.getState().requests;
    for (const request of [...requests, ...this.cursorRequests]) {
      if (belongs(request)) {
        this.clearRequestResources(request.id);
      }
    }
    this.setRequests(requests.filter((request) => !belongs(request)));
    this.setCursorRequests(
      this.cursorRequests.filter((request) => !belongs(request)),
    );
  }

  begin(
    targets: ActivityTarget[],
    kind: CanvasActivity["kind"] = "edit",
    caller?: CopilotCaller,
    signal?: AbortSignal,
  ) {
    signal?.throwIfAborted();
    const request: CanvasActivity = {
      id: ++this.nextId,
      targets: targets.map((target) => ({
        ...target,
        ancestorUuids: target.ancestorUuids?.slice(),
      })),
      status: "running",
      scanning: true,
      kind,
      caller: caller && { ...caller },
    };
    const started = Date.now();
    let finished = false;
    this.setRequests([...this.store.getState().requests, request]);
    if (kind === "edit") {
      this.setCursorRequests([...this.cursorRequests, request]);
      this.cursorTimers.set(
        request.id,
        setTimeout(() => {
          this.cursorTimers.delete(request.id);
          this.setCursorRequests(
            this.cursorRequests.filter((current) => current.id !== request.id),
          );
        }, AGENT_CURSOR_IDLE_MS),
      );
    }
    const cancel = () => finish("error");
    const finish = (status: "success" | "error") => {
      if (finished) {
        return;
      }
      finished = true;
      this.signalCleanups.get(request.id)?.();
      this.signalCleanups.delete(request.id);
      const requests = this.store.getState().requests;
      if (!requests.some((current) => current.id === request.id)) {
        return;
      }
      if (status === "error") {
        this.clearRequestResources(request.id);
        this.setRequests(
          requests.filter((current) => current.id !== request.id),
        );
        this.setCursorRequests(
          this.cursorRequests.filter((current) => current.id !== request.id),
        );
        return;
      }
      const completed = { ...request, status };
      this.setRequests(
        requests.map((current) =>
          current.id === request.id ? completed : current,
        ),
      );
      this.setCursorRequests(
        this.cursorRequests.map((current) =>
          current.id === request.id ? completed : current,
        ),
      );
      // Complete the operation immediately; only feedback has a minimum duration.
      const stopScan = () => {
        this.timers.delete(request.id);
        const current = this.store.getState().requests;
        if (!current.some((item) => item.id === request.id)) {
          return;
        }
        this.setRequests(
          current.map((item) =>
            item.id === request.id ? { ...item, scanning: false } : item,
          ),
        );
        this.timers.set(
          request.id,
          setTimeout(() => {
            this.timers.delete(request.id);
            this.setRequests(
              this.store
                .getState()
                .requests.filter((item) => item.id !== request.id),
            );
          }, COMPLETION_MS),
        );
      };
      const remaining = MIN_SCAN_MS - (Date.now() - started);
      if (remaining > 0) {
        this.timers.set(request.id, setTimeout(stopScan, remaining));
      } else {
        stopScan();
      }
    };
    if (signal) {
      signal.addEventListener("abort", cancel, { once: true });
      this.signalCleanups.set(request.id, () =>
        signal.removeEventListener("abort", cancel),
      );
    }
    return finish;
  }

  dispose() {
    this.timers.forEach(clearTimeout);
    this.timers.clear();
    this.cursorTimers.forEach(clearTimeout);
    this.cursorTimers.clear();
    this.signalCleanups.forEach((cleanup) => cleanup());
    this.signalCleanups.clear();
    this.setRequests([]);
    this.setCursorRequests([]);
  }
}

export function activityTargets(
  name: string,
  input: Record<string, unknown>,
): ActivityTarget[] {
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
