// eslint-disable-next-line @typescript-eslint/no-restricted-imports
import { useApp } from "@/wab/client/components/top-view";
import type { App } from "@/wab/client/components/top-view";
import { assert, ensure } from "@/wab/shared/common";
import L from "lodash";
import * as React from "react";
import { ReactNode } from "react";
import { unstable_batchedUpdates } from "react-dom";
import {
  DraggableCore,
  DraggableCoreProps,
  DraggableData,
  DraggableEventHandler,
} from "react-draggable";
import { isComposingKeyEvent } from "@/wab/commons/components/ReactUtil";

type MouseEvent = React.MouseEvent | globalThis.MouseEvent;

interface DraggableState {
  initX: number;
  initY: number;
  started: boolean;
  /**
   * Whether the user hit Escape.  After this, started is false and no more drag
   * events are emitted.  This can be set even if started was false (but the
   * event is not emitted to the user).
   */
  aborted: boolean;
}

export type XDraggableData = DraggableState & {
  deltaX: number;
  deltaY: number;
};

export interface XDraggableEvent {
  mouseEvent: MouseEvent;
  draggableData: DraggableData;
  data: XDraggableData;
  /** Cancels this press if it still owns the native drag. */
  cancel: () => void;
}

export type XDraggableEventHandler = (e: XDraggableEvent) => void;

export type Omit<T, K extends keyof T> = Pick<T, Exclude<keyof T, K>>;
export type XDraggableProps = Partial<
  Omit<DraggableCoreProps, "onStart" | "onStop" | "onDrag" | "nodeRef"> & {
    nodeRef?: React.RefObject<HTMLElement | SVGElement | null>;
    onDrag: XDraggableEventHandler;
    onStart: XDraggableEventHandler;
    onStop: XDraggableEventHandler;
    minPx: number;
    render: (lastEvent: XDraggableEvent | undefined) => ReactNode;
    useMovement?: boolean;
  }
> & { children?: React.ReactNode };

type DragSessionProps = Pick<XDraggableProps, "minPx" | "onStart" | "onDrag" | "onStop" | "useMovement"> & { app: App };

/** Synchronous pointer commands publish immutable render snapshots. */
class DragSession {
  private current: XDraggableEvent | undefined;
  private pressed = false;
  private lastNativeEvent?: MouseEvent;
  private core: DraggableCore | null = null;
  private stopCancellation?: () => void;
  private readonly listeners = new Set<() => void>();
  constructor(private props: DragSessionProps) {}
  updateProps(props: DragSessionProps) { this.props = props; }
  attachCore(core: DraggableCore | null) { this.core = core; }
  private stopNativeDrag(event: MouseEvent) {
    // react-draggable accepts either native mouse or touch events here.
    const native = event as Parameters<DraggableCore["onMouseUp"]>[0];
    if (event.type.startsWith("touch")) {
      this.core?.onTouchEnd(native);
    } else {
      this.core?.onMouseUp(native);
    }
  }
  read = () => this.current;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private publish(event: XDraggableEvent) {
    this.current = {
      ...event,
      mouseEvent: L.assignIn({}, event.mouseEvent),
      data: Object.freeze({ ...event.data }),
    };
    this.listeners.forEach((listener) => listener());
  }
  private event(mouseEvent: MouseEvent, draggableData: DraggableData, state: XDraggableData, cancel: () => void): XDraggableEvent {
    const { useMovement } = this.props;
    return { mouseEvent, draggableData, cancel, data: {
      ...state,
      deltaX: useMovement ? state.deltaX + mouseEvent.movementX : mouseEvent.pageX - state.initX,
      deltaY: useMovement ? state.deltaY + mouseEvent.movementY : mouseEvent.pageY - state.initY,
    } };
  }
  start: DraggableEventHandler = (mouseEvent, data) =>
    unstable_batchedUpdates(() => {
      const props = this.props;
      const cancel = () => {
        if (this.current?.cancel === cancel) {
          this.abort(true);
        }
      };
      const event = this.event(mouseEvent, data, {
        initX: mouseEvent.pageX, initY: mouseEvent.pageY,
        started: !props.minPx, aborted: false, deltaX: 0, deltaY: 0,
      }, cancel);
      this.pressed = true;
      this.current = event;
      this.lastNativeEvent = mouseEvent;
      this.stopCancellation?.();
      const doc = data.node.ownerDocument, win = ensure(doc.defaultView, "Drag document has no window");
      win.addEventListener("keydown", this.escape, true);
      win.addEventListener("blur", cancel);
      doc.addEventListener("pointercancel", cancel, true);
      doc.addEventListener("touchcancel", cancel, true);
      this.stopCancellation = () => {
        win.removeEventListener("keydown", this.escape, true);
        win.removeEventListener("blur", cancel);
        doc.removeEventListener("pointercancel", cancel, true);
        doc.removeEventListener("touchcancel", cancel, true);
      };
      props.app.setIsDragging(true);
      if (!props.minPx) { props.onStart?.(event); }
      if (!this.pressed) { return false; }
      this.publish(event);
      return undefined;
    });
  move: DraggableEventHandler = (mouseEvent, data) => {
    const last = ensure(this.current, "Expected an active drag event");
    if (last.data.aborted) { return false; }
    return unstable_batchedUpdates(() => {
      const props = this.props;
      this.lastNativeEvent = mouseEvent;
      let event = this.event(mouseEvent, data, last.data, last.cancel);
      if (!last.data.started && props.minPx && Math.hypot(event.data.deltaX, event.data.deltaY) >= props.minPx) {
        event = { ...event, data: { ...event.data, started: true } };
        this.current = event;
        props.onStart?.(event);
      }
      if (last.data.started) { props.onDrag?.(event); }
      if (this.pressed) { this.publish(event); }
    });
  };
  stop: DraggableEventHandler = (mouseEvent, data) => {
    const last = ensure(this.current, "Expected an active drag event");
    // Returning false prevents DraggableCore from releasing its native listeners.
    if (last.data.aborted) { return undefined; }
    unstable_batchedUpdates(() => {
      const props = this.props;
      this.pressed = false;
      this.lastNativeEvent = undefined;
      this.stopCancellation?.(); this.stopCancellation = undefined;
      props.app.setIsDragging(false);
      const event = this.event(mouseEvent, data, { ...last.data, started: false }, last.cancel);
      if (last.data.started) { props.onStop?.(event); }
      this.publish(event);
    });
    return undefined;
  };
  escape = (keyboardEvent: KeyboardEvent) => {
    if (keyboardEvent.key === "Escape" && !keyboardEvent.defaultPrevented && !isComposingKeyEvent(keyboardEvent)) {
      keyboardEvent.preventDefault(); keyboardEvent.stopPropagation();
      this.abort(true);
    }
  };
  private abort(notify: boolean) {
    const last = this.current;
    if (!this.pressed || !last) { return; }
    this.pressed = false;
    this.stopCancellation?.(); this.stopCancellation = undefined;
    const props = this.props;
    const nativeEvent = this.lastNativeEvent;
    this.lastNativeEvent = undefined;
    const event = { ...last, data: { ...last.data, started: false, aborted: true } };
    this.current = event;
    // The core's stop handler sees the aborted state and releases its listeners
    // without notifying the owner again. Unmount already releases the core.
    if (notify && nativeEvent) { this.stopNativeDrag(nativeEvent); }
    props.app.setIsDragging(false);
    if (last.data.started) { props.onStop?.(event); }
    if (notify) { this.publish(event); }
  }
  release = () => this.abort(false);
}

export function XDraggable({ minPx = 4, ...props }: XDraggableProps) {
  const app = useApp();
  const { onStart, onDrag, onStop, useMovement } = props;
  const [session] = React.useState(
    () => new DragSession({ minPx, app, onStart, onDrag, onStop, useMovement }),
  );
  const coreRef = React.useRef<DraggableCore>(null);
  React.useLayoutEffect(() => {
    session.updateProps({ minPx, app, onStart, onDrag, onStop, useMovement });
  }, [session, minPx, app, onStart, onDrag, onStop, useMovement]);
  const lastEvent = React.useSyncExternalStore(session.subscribe, session.read, session.read);
  React.useLayoutEffect(() => {
    session.attachCore(coreRef.current);
    return () => {
      session.release();
      session.attachCore(null);
    };
  }, [session]);
  const ownNodeRef = React.useRef<HTMLElement | SVGElement | null>(null);
  const attachNativeNode = React.useCallback((node: HTMLElement | SVGElement | null) => { ownNodeRef.current = node; }, []);
  const { nodeRef, render, children } = props;
  const draggableProps = L.omit(props, ["onStart", "onStop", "onDrag", "nodeRef", "render", "children", "useMovement"]);
  const child = render?.(lastEvent) || children;
  let dragChild = child;
  if (!nodeRef) {
    assert(React.isValidElement<React.RefAttributes<HTMLElement | SVGElement>>(child) && typeof child.type === "string",
      "XDraggable component children must provide a nodeRef to their native drag target");
    const Child: React.ElementType = child.type as React.ElementType;
    dragChild = <Child {...child.props} key={child.key} ref={attachNativeNode} />;
  }
  return <>
    <DraggableCore {...draggableProps}
      ref={coreRef}
      nodeRef={(nodeRef ?? ownNodeRef) as DraggableCoreProps["nodeRef"]}
      enableUserSelectHack={false}
      onStart={session.start} onDrag={session.move} onStop={session.stop}>
      {dragChild}
    </DraggableCore>
  </>;
}
