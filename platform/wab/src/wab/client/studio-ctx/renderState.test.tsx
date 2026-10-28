import { CanvasCtx } from "@/wab/client/components/canvas/canvas-ctx";
import { Fiber } from "@/wab/client/react-global-hook/fiber";
import { createRenderState } from "@/wab/client/studio-ctx/renderState";
import { mkBaseVariant } from "@/wab/shared/Variants";
import { assert, ensure } from "@/wab/shared/common";
import { ComponentType, mkComponent } from "@/wab/shared/core/components";
import { mkParam } from "@/wab/shared/core/lang";
import {
  SlotSelection,
  makeSlotSelectionFullKey,
  makeSlotSelectionKey,
} from "@/wab/shared/core/slots";
import {
  TplTagType,
  isTplTextBlock,
  mkTplComponent,
  mkTplTagX,
} from "@/wab/shared/core/tpls";
import { ValComponent, ValTextTag } from "@/wab/shared/core/val-nodes";
import { typeFactory } from "@/wab/shared/model/model-util";
import { act, cleanup, render } from "@testing-library/react";
import React from "react";

afterEach(cleanup);

function domFiber(element: Element) {
  const fiberKey = ensure(
    Object.keys(element).find((key) => key.startsWith("__reactFiber$")),
    "Expected the element's React Fiber",
  );
  return Reflect.get(element, fiberKey) as Fiber;
}

function fixture(children: React.ReactNode, className = "content") {
  function Roots() {
    return <>{children}</>;
  }
  const { container } = render(<Roots />);
  const element = ensure(
    container.firstElementChild,
    "Expected a rendered root",
  );
  let fiber = domFiber(element);
  while (fiber.type !== Roots) {
    fiber = ensure(fiber.return, "Expected the authored component's Fiber");
  }
  const slotParam = mkParam({
    name: "children",
    paramType: "slot",
    type: typeFactory.renderable(),
  });
  const component = mkComponent({
    name: "Container",
    type: ComponentType.Plain,
    tplTree: mkTplTagX("div"),
    params: [slotParam],
  });
  const val = new ValComponent({
    tpl: mkTplComponent(component, mkBaseVariant(), []),
    valOwner: undefined,
    key: "roots",
    fullKey: "roots",
    frameUid: 1,
    fibers: [fiber],
    parent: undefined,
    className,
    slotInfo: undefined,
    slotArgs: new Map(),
    slotCanvasEnvs: new Map(),
  });
  const state = createRenderState(val.frameUid);
  state.registerVal(val);
  const canvas = { win: () => window } as CanvasCtx;
  return { container, state, val, canvas, fiber, slotParam };
}

it.each(["style", "script", "link", "meta", "title", "base", "template"])(
  "excludes a %s sibling while preserving all content roots",
  (tag) => {
    const { container, state, val, canvas } = fixture(
      <>
        {React.createElement(tag)}
        <div className="content">Content</div>
        <div>Footer</div>
      </>,
    );
    try {
      const roots = Array.from(container.querySelectorAll("div"));
      expect(state.val2dom(val, canvas)).toEqual(roots);
      expect(state.sel2dom(val, canvas)).toEqual(roots);
      expect(container.querySelector(tag)).not.toBeNull();
    } finally {
      state.dispose();
    }
  },
);

it("filters resource nodes when resolving a forwarded className in descendants", () => {
  const { container, state, val, canvas } = fixture(
    <div>
      <style className="content" />
      <div className="content">Content</div>
    </div>,
  );
  try {
    expect(state.val2dom(val, canvas)).toEqual([
      container.querySelector("div.content"),
    ]);
  } finally {
    state.dispose();
  }
});

it("keeps ordinary display:none roots mapped so they can become visible later", () => {
  const { container, state, val, canvas } = fixture(
    <>
      <div style={{ display: "none" }}>Inactive content</div>
      <div className="content">Active content</div>
    </>,
  );
  try {
    expect(state.val2dom(val, canvas)).toEqual(
      Array.from(container.querySelectorAll("div")),
    );
  } finally {
    state.dispose();
  }
});

it("applies the same resource filtering to slot placeholders", () => {
  const { container, state, val, canvas, fiber, slotParam } = fixture(
    <>
      <style />
      <div className="content">Placeholder</div>
    </>,
  );
  try {
    const selection = new SlotSelection({ val, slotParam });
    state.registerSlotPlaceholder(
      makeSlotSelectionKey(selection),
      makeSlotSelectionFullKey(selection),
      fiber,
    );
    expect(state.sel2dom(selection, canvas)).toEqual([
      container.querySelector("div.content"),
    ]);
  } finally {
    state.dispose();
  }
});

it("does not map a resource-only component to a selectable region", () => {
  const { state, val, canvas } = fixture(
    <>
      <style />
      <script />
    </>,
  );
  try {
    expect(state.val2dom(val, canvas)).toEqual([]);
  } finally {
    state.dispose();
  }
});

function textCopies() {
  const handles = new Map<string, NonNullable<ValTextTag["handle"]>>();
  function Text({ id }: { id: string }) {
    const [editing, setEditing] = React.useState(false);
    handles.set(id, {
      enterEdit: () => {
        setEditing(true);
        return undefined;
      },
      exitEdit: () => setEditing(false),
    });
    return (
      <span className="title" data-testid={id}>
        {editing ? <input aria-label={id} defaultValue="Name" /> : "Name"}
      </span>
    );
  }
  const { container, getByTestId } = render(
    <table>
      <thead>
        <tr>
          <th>
            <Text id="header" />
          </th>
        </tr>
      </thead>
      <tbody>
        <tr aria-hidden="true" style={{ height: 0 }}>
          <td>
            <div style={{ height: 0, overflow: "hidden" }}>
              <Text id="measure" />
            </div>
          </td>
        </tr>
      </tbody>
    </table>,
  );
  const tpl = mkTplTagX("span", { type: TplTagType.Text });
  assert(isTplTextBlock(tpl), "Expected a text template");
  const vals = ["header", "measure"].map(
    (id) =>
      new ValTextTag({
        tpl,
        key: "table.title",
        fullKey: "table.title",
        frameUid: 2,
        valOwner: undefined,
        parent: undefined,
        slotInfo: undefined,
        className: "title",
        children: [],
        fibers: [domFiber(getByTestId(id))],
        handle: handles.get(id),
      }),
  );
  const state = createRenderState(2);
  return {
    state,
    vals,
    container,
    getByTestId,
    canvas: { win: () => window } as CanvasCtx,
  };
}

it.each([false, true])(
  "edits the actual text instead of its clipped measurement copy (reverse=%s)",
  async (reverse) => {
    const { state, vals, container, getByTestId, canvas } = textCopies();
    try {
      (reverse ? vals.slice().reverse() : vals).forEach((val) =>
        state.registerVal(val),
      );
      const current = state.tryGetUpdatedVal(vals[0]);
      expect(
        state.sel2dom(ensure(current, "Expected the registered text"), canvas),
      ).toEqual([getByTestId("header")]);
      await act(() => current?.handle?.enterEdit());
      expect(getByTestId("header").querySelector("input")).not.toBeNull();
      expect(getByTestId("measure").querySelector("input")).toBeNull();
      expect(
        container.querySelector('tr[aria-hidden="true"]')?.textContent,
      ).toBe("Name");
    } finally {
      state.dispose();
    }
  },
);

it("does not let a clipped copy take over editing when the visible instance unmounts", () => {
  const { state, vals, getByTestId, canvas } = textCopies();
  try {
    vals.forEach((val) => state.registerVal(val));
    getByTestId("header").remove();
    state.recomputeCachedVal(vals[0].fullKey);
    expect(state.tryGetUpdatedVal(vals[0])?.handle).toBeUndefined();
    expect(state.sel2dom(vals[0], canvas)).toEqual([]);
  } finally {
    state.dispose();
  }
});

it("retains both genuinely rendered copies and their existing edit behavior", async () => {
  const { state, vals, getByTestId, canvas } = textCopies();
  try {
    const parent = ensure(
      getByTestId("measure").parentElement,
      "Expected the measurement container",
    );
    parent.style.overflow = "visible";
    vals.forEach((val) => state.registerVal(val));
    expect(state.sel2dom(vals[0], canvas)).toEqual([
      getByTestId("header"),
      getByTestId("measure"),
    ]);
    await act(() => state.tryGetUpdatedVal(vals[0])?.handle?.enterEdit());
    expect(getByTestId("measure").querySelector("input")).not.toBeNull();
  } finally {
    state.dispose();
  }
});
