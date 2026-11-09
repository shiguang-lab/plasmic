// eslint-disable-next-line @typescript-eslint/no-restricted-imports
import { useApp } from "@/wab/client/components/top-view";
import type { App } from "@/wab/client/components/top-view";
import { assert, ensure } from "@/wab/shared/common";
import L from "lodash";
import * as React from "react";
import { ReactNode } from "react";
import { useCommittedValue } from "@/wab/commons/components/ReactUtil";
import { unstable_batchedUpdates } from "react-dom";
import {
  DraggableCore,
  DraggableCoreProps,
  DraggableData,
  DraggableEventHandler,
} from "react-draggable";
import UseKey from "react-use/lib/component/UseKey";

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

type DragSessionProps = XDraggableProps & { app: App };

/** Synchronous pointer commands publish immutable render snapshots. */
class DragSession {
  private current: XDraggableEvent | undefined;
  private pressed = false;
  private readonly listeners = new Set<() => void>();
  constructor(private readonly readProps: () => DragSessionProps) {}
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
  private event(mouseEvent: MouseEvent, draggableData: DraggableData, state: XDraggableData): XDraggableEvent {
    const { useMovement } = this.readProps();
    return { mouseEvent, draggableData, data: {
      ...state,
      deltaX: useMovement ? state.deltaX + mouseEvent.movementX : mouseEvent.pageX - state.initX,
      deltaY: useMovement ? state.deltaY + mouseEvent.movementY : mouseEvent.pageY - state.initY,
    } };
  }
  start: DraggableEventHandler = (mouseEvent, data) => {
    unstable_batchedUpdates(() => {
      const props = this.readProps();
      const event = this.event(mouseEvent, data, {
        initX: mouseEvent.pageX, initY: mouseEvent.pageY,
        started: !props.minPx, aborted: false, deltaX: 0, deltaY: 0,
      });
      this.pressed = true;
      props.app.setIsDragging(true);
      if (!props.minPx) { props.onStart?.(event); }
      this.publish(event);
    });
  };
  move: DraggableEventHandler = (mouseEvent, data) => {
    const last = ensure(this.current, "Expected an active drag event");
    if (last.data.aborted) { return false; }
    unstable_batchedUpdates(() => {
      const props = this.readProps();
      let event = this.event(mouseEvent, data, last.data);
      if (!last.data.started && props.minPx && Math.hypot(event.data.deltaX, event.data.deltaY) >= props.minPx) {
        event = { ...event, data: { ...event.data, started: true } };
        props.onStart?.(event);
      }
      if (last.data.started) { props.onDrag?.(event); }
      this.publish(event);
    });
    return undefined;
  };
  stop: DraggableEventHandler = (mouseEvent, data) => {
    const last = ensure(this.current, "Expected an active drag event");
    if (last.data.aborted) { return false; }
    unstable_batchedUpdates(() => {
      const props = this.readProps();
      this.pressed = false;
      props.app.setIsDragging(false);
      const event = this.event(mouseEvent, data, { ...last.data, started: false });
      if (last.data.started) { props.onStop?.(event); }
      this.publish(event);
    });
    return undefined;
  };
  escape = (keyboardEvent: Pick<React.KeyboardEvent<HTMLElement>, "stopPropagation">) => {
    keyboardEvent.stopPropagation();
    this.abort(true);
  };
  private abort(notify: boolean) {
    const last = this.current;
    if (!this.pressed || !last) { return; }
    this.pressed = false;
    const props = this.readProps();
    props.app.setIsDragging(false);
    const event = { ...last, data: { ...last.data, started: false, aborted: true } };
    if (last.data.started) { props.onStop?.(event); }
    if (notify) { this.publish(event); } else { this.current = event; }
  }
  release = () => this.abort(false);
}

export function XDraggable({ minPx = 4, ...props }: XDraggableProps) {
  const app = useApp();
  const readProps = useCommittedValue({ ...props, minPx, app });
  const [session] = React.useState(() => new DragSession(readProps));
  const lastEvent = React.useSyncExternalStore(session.subscribe, session.read, session.read);
  React.useLayoutEffect(() => session.release, [session]);
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
    {lastEvent?.data.started && <UseKey filter="Escape" fn={session.escape} />}
    <DraggableCore {...draggableProps}
      nodeRef={(nodeRef ?? ownNodeRef) as DraggableCoreProps["nodeRef"]}
      enableUserSelectHack={false}
      onStart={session.start} onDrag={session.move} onStop={session.stop}>
      {dragChild}
    </DraggableCore>
  </>;
}
