import {
  TreeDndManager,
  type TreeDndManager as TreeDndManagerType,
} from "@/wab/client/components/sidebar-tabs/tpl-tree";
import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import type { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import type { TplNode } from "@/wab/shared/model/classes";
import { act, cleanup, render } from "@testing-library/react";
import * as React from "react";
import { useStore } from "zustand";

/** Drag commands update plain fields and publish their native store version. */

afterEach(cleanup);

function manager(): TreeDndManagerType {
  return new TreeDndManager({} as StudioCtx);
}

const item = { uuid: "tpl-1" } as unknown as TplNode;

it("exposes drop predicates from plain fields", () => {
  const m = manager();
  expect(m.isDropTarget(item)).toBe(false);
  expect(m.getInsertionMarker(item)).toBeUndefined();

  m.setTarget({
    viewCtx: {} as ViewCtx,
    outcome: {
      insertion: "insert-as-child",
      item,
      marker: { item, indent: 0, insertion: "insert-as-child" },
    } as any,
  });

  expect(m.isDropTarget(item)).toBe(true);
  expect(m.getInsertionMarker(item)).toEqual({
    item,
    indent: 0,
    insertion: "insert-as-child",
  });

  m.setTarget(undefined);
  expect(m.isDropTarget(item)).toBe(false);
});

it("bumps the store version on every drag-state write", () => {
  const m = manager();
  expect(m.store.getState().version).toBe(0);

  m.setDraggedItems([]);
  expect(m.store.getState().version).toBe(1);

  m.setDraggedItems([{ node: item } as any]);
  expect(m.store.getState().version).toBe(2);

  m.onDragEnd();
  expect(m.store.getState().version).toBe(4);
  expect(m.draggedItems).toEqual([]);
});

it("re-renders subscribers when the drag state changes", async () => {
  const m = manager();
  let renders = 0;

  function Row() {
    useStore(m.store, (state) => state.version);
    renders += 1;
    return null;
  }

  render(<Row />);
  const before = renders;

  await act(async () => {
    m.setDraggedItems([{ node: item } as any]);
  });

  expect(renders - before).toBe(1);
});
