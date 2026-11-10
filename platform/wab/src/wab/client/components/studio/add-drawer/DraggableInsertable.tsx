import { DragItem } from "@/wab/client/components/widgets";
import { AddTplItem } from "@/wab/client/definitions/insertables";
import { DragInsertManager } from "@/wab/client/Dnd";
import { handleError, normalizeError } from "@/wab/client/ErrorNotifications";
import {
  isStudioDesignInputEnabled,
  onStudioInputContextChange,
} from "@/wab/client/studio-ctx/studio-input";
import { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import type { XDraggableEvent } from "@/wab/commons/components/XDraggable";
import { Pt } from "@/wab/shared/geom";
import { TplNode } from "@/wab/shared/model/classes";
import * as React from "react";

export interface DraggableInsertableProps {
  spec: AddTplItem;
  shouldInterceptInsert?: (item: AddTplItem) => boolean;
  sc: StudioCtx;
  children: React.ReactNode;
  onDragEnd?: (
    spec: AddTplItem,
    result: [ViewCtx, TplNode] | undefined,
  ) => void;
  minPx?: number;
}

interface InsertionDrag {
  abort: AbortController;
  cancel: () => void;
  stopWatching: () => void;
  pending: Promise<void>;
  manager?: DragInsertManager;
  unlogged: boolean;
}

function updateDropTarget(
  sc: StudioCtx,
  manager: DragInsertManager,
  event: XDraggableEvent,
) {
  const clipper = sc.canvasClipper();
  const { clientX, clientY } = event.mouseEvent;
  // Only skip drag feedback. Other surfaces can cover an artboard.
  const hit = clipper.ownerDocument
    .elementsFromPoint(clientX, clientY)
    .find((element) => !element.closest(".drag-guard, .DragItem__Handle"));
  if (hit && clipper.contains(hit)) {
    manager.drag(new Pt(clientX, clientY), event.mouseEvent);
  } else {
    manager.clear();
  }
}

function clearDrag(sc: StudioCtx, drag: InsertionDrag) {
  try {
    drag.manager?.clear();
  } finally {
    if (drag.unlogged) {
      try {
        sc.stopUnlogged();
      } finally {
        sc.setIsDraggingObject(false);
      }
    }
  }
}

export function DraggableInsertable(props: DraggableInsertableProps) {
  const { spec, shouldInterceptInsert, sc, onDragEnd, minPx } = props;
  const active = React.useRef<InsertionDrag>(undefined);

  const isActive = (drag: InsertionDrag) =>
    !drag.abort.signal.aborted && isStudioDesignInputEnabled(sc);

  const finish = (drag: InsertionDrag, result?: [ViewCtx, TplNode]) => {
    if (active.current !== drag) {
      return;
    }
    active.current = undefined;
    drag.abort.abort();
    drag.stopWatching();
    clearDrag(sc, drag);
    onDragEnd?.(spec, result);
  };

  // Each press owns its queue. Late work checks its owner again inside model changes.
  const enqueue = (drag: InsertionDrag, operation: () => Promise<void>) => {
    drag.pending = drag.pending
      .then(async () => {
        if (isActive(drag)) {
          await operation();
        } else {
          finish(drag);
        }
      })
      .catch((error) => {
        drag.cancel();
        handleError(normalizeError(error));
      });
  };

  const drop = async (drag: InsertionDrag, event: XDraggableEvent) => {
    const manager = drag.manager;
    if (!manager) {
      return undefined;
    }
    // The final hit can differ from the last move.
    updateDropTarget(sc, manager, event);
    const view = manager.tentativeVc;
    if (!view || shouldInterceptInsert?.(spec)) {
      return undefined;
    }
    const extraInfo = await spec.asyncExtraInfo?.(sc);
    if (extraInfo === false || !isActive(drag)) {
      return undefined;
    }
    let result: [ViewCtx, TplNode] | undefined;
    await sc.changeUnsafe(() => {
      if (
        isActive(drag) &&
        !view.isDisposed &&
        view.isVisible() &&
        sc.tryGetViewCtxForFrame(view.arenaFrame()) === view
      ) {
        result = manager.endDrag(spec, extraInfo);
      }
    });
    return result;
  };

  React.useLayoutEffect(() => () => active.current?.cancel(), [sc, spec.key]);

  return (
    <DragItem
      minPx={minPx}
      key={spec.key}
      onDragStart={(event) => {
        if (active.current) {
          finish(active.current);
        }
        if (!isStudioDesignInputEnabled(sc)) {
          event.cancel();
          return;
        }
        const drag: InsertionDrag = {
          abort: new AbortController(),
          cancel: () => {
            event.cancel();
            finish(drag);
          },
          stopWatching: onStudioInputContextChange(sc, () => drag.cancel()),
          pending: Promise.resolve(),
          unlogged: false,
        };
        active.current = drag;
        enqueue(drag, async () => {
          const manager = await DragInsertManager.build(
            sc,
            spec,
            undefined,
            drag.abort.signal,
          );
          if (!isActive(drag)) {
            return;
          }
          await sc.changeUnsafe(() => {
            if (isActive(drag)) {
              drag.manager = manager;
              sc.startUnlogged();
              drag.unlogged = true;
              sc.setIsDraggingObject(true);
            }
          });
        });
      }}
      onDrag={(event) => {
        const drag = active.current;
        if (!drag) {
          return;
        }
        enqueue(drag, async () => {
          await sc.changeUnsafe(() => {
            if (isActive(drag) && drag.manager) {
              updateDropTarget(sc, drag.manager, event);
            }
          });
        });
      }}
      onDragEnd={(event) => {
        const drag = active.current;
        if (!drag) {
          return;
        }
        if (event.data.aborted) {
          finish(drag);
          return;
        }
        enqueue(drag, async () => {
          const result = await drop(drag, event);
          finish(drag, result);
        });
      }}
      dragHandle={() => (
        <div className={"component-drag-handle"}>
          <div className="create-item__icon">{spec.icon}</div>
          {spec.displayLabel ?? spec.label}
        </div>
      )}
    >
      {props.children}
    </DragItem>
  );
}
