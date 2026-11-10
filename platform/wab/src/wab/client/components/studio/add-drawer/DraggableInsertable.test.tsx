import { DraggableInsertable } from "@/wab/client/components/studio/add-drawer/DraggableInsertable";
import type { AddTplItem } from "@/wab/client/definitions/insertables";
import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { StudioRenderPolicy } from "@/wab/client/studio-ctx/studio-render-policy";
import type { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import React from "react";
import { mock } from "vitest-mock-extended";
import { createStore } from "zustand/vanilla";

const fixture = vi.hoisted(() => ({
  app: { setIsDragging: vi.fn() },
  manager: undefined as any,
  report: vi.fn(),
}));
vi.mock("@/wab/client/components/top-view", async (original) => ({
  ...(await original<typeof import("@/wab/client/components/top-view")>()),
  useApp: () => fixture.app,
}));
vi.mock("@/wab/client/Dnd", async (original) => ({
  ...(await original<typeof import("@/wab/client/Dnd")>()),
  DragInsertManager: { build: async () => fixture.manager },
}));
vi.mock("@/wab/client/ErrorNotifications", async (original) => ({
  ...(await original<typeof import("@/wab/client/ErrorNotifications")>()),
  handleError: fixture.report,
}));
const hitTestDescriptor = Object.getOwnPropertyDescriptor(
  document,
  "elementsFromPoint",
);
afterEach(() => {
  cleanup();
  if (hitTestDescriptor) {
    Object.defineProperty(document, "elementsFromPoint", hitTestDescriptor);
  } else {
    Reflect.deleteProperty(document, "elementsFromPoint");
  }
  fixture.report.mockClear();
});

function setup(extraInfo?: () => Promise<unknown>) {
  const sc = mock<StudioCtx>();
  sc.changeUnsafe.mockImplementation(async (callback) => callback());
  const policy = new StudioRenderPolicy({
    isLive: () => false,
    isDragging: () => false,
  });
  const arena = createStore(() => ({ current: {} }));
  const lifetime = new AbortController();
  Object.defineProperties(sc, {
    renderPolicy: { value: policy },
    isDevMode: { get: () => policy.devMode },
    isInteractiveMode: { get: () => policy.interactive },
    arenaState: { value: { store: arena, lifetime: () => lifetime.signal } },
  });
  const setInteractive = (value: boolean) =>
    act(() => {
      policy.interactive = value;
      policy.prepareInputs();
      policy.publishCommit();
    });
  const canvas = document.createElement("div");
  const guard = document.createElement("div");
  guard.className = "drag-guard";
  const panel = document.createElement("button");
  const hitTest = vi.fn((x: number) =>
    x >= 200 ? [guard, canvas] : [guard, panel],
  );
  Object.defineProperty(document, "elementsFromPoint", {
    configurable: true,
    value: hitTest,
  });
  sc.canvasClipper.mockReturnValue(canvas);
  const view = mock<ViewCtx>();
  Object.defineProperty(view, "isDisposed", { value: false });
  view.isVisible.mockReturnValue(true);
  sc.tryGetViewCtxForFrame.mockReturnValue(view);
  const manager = {
    tentativeVc: undefined as ViewCtx | undefined,
    clear: vi.fn(() => {
      manager.tentativeVc = undefined;
    }),
    drag: vi.fn((_point: { x: number; y: number }, _event: unknown) => {
      manager.tentativeVc = view;
    }),
    endDrag: vi.fn((spec?: AddTplItem) => (spec ? [{}, {}] : undefined)),
  };
  fixture.manager = manager;
  const spec = {
    key: "component",
    label: "Component",
    asyncExtraInfo: extraInfo,
  } as AddTplItem;
  const ended = vi.fn();
  const ui = render(
    <DraggableInsertable spec={spec} sc={sc} onDragEnd={ended}>
      <div data-testid="component">Component</div>
    </DraggableInsertable>,
  );
  const start = () => {
    fireEvent.mouseDown(screen.getByTestId("component"), {
      clientX: 10,
      clientY: 10,
    });
    fireEvent.mouseMove(document, { clientX: 220, clientY: 100 });
    fireEvent.mouseMove(document, { clientX: 300, clientY: 100 });
  };
  return {
    ...ui,
    sc,
    manager,
    spec,
    ended,
    start,
    hitTest,
    panel,
    canvas,
    guard,
    setInteractive,
    arena,
  };
}

it("inserts from the component panel and recomputes the final canvas drop target", async () => {
  const f = setup();
  f.start();
  fireEvent.mouseUp(document, { clientX: 420, clientY: 120 });
  await waitFor(() => expect(f.ended).toHaveBeenCalledOnce());
  expect(f.manager.drag.mock.lastCall?.[0]).toMatchObject({ x: 420, y: 120 });
  expect(f.manager.endDrag).toHaveBeenCalledWith(f.spec, undefined);
  expect(f.sc.setIsDraggingObject).toHaveBeenLastCalledWith(false);
});

it("does not insert when released outside the canvas after a valid tentative target", async () => {
  const f = setup();
  f.start();
  fireEvent.mouseUp(document, { clientX: 50, clientY: 100 });
  await waitFor(() => expect(f.ended).toHaveBeenCalledOnce());
  expect(f.manager.endDrag).not.toHaveBeenCalled();
  expect(f.sc.setIsDraggingObject).toHaveBeenLastCalledWith(false);
});

it.each(["Escape", "blur", "pointercancel", "unmount"])(
  "cancels component insertion on %s and supports a subsequent drag",
  async (reason) => {
    const f = setup();
    f.start();
    await waitFor(() => expect(f.manager.drag).toHaveBeenCalled());
    if (reason === "Escape") {
      fireEvent.keyDown(window, { key: "Escape", code: "Escape" });
    } else if (reason === "unmount") {
      f.unmount();
    } else {
      fireEvent(reason === "blur" ? window : document, new Event(reason));
    }
    await waitFor(() => expect(f.ended).toHaveBeenCalledOnce());
    expect(f.manager.endDrag).not.toHaveBeenCalled();
    expect(f.manager.clear).toHaveBeenCalled();
    expect(f.sc.setIsDraggingObject).toHaveBeenLastCalledWith(false);
    fireEvent.mouseUp(document, { clientX: 300, clientY: 100 });
    expect(f.manager.endDrag).not.toHaveBeenCalled();
    if (reason !== "unmount") {
      f.start();
      fireEvent.mouseUp(document, { clientX: 350, clientY: 100 });
      await waitFor(() => expect(f.ended).toHaveBeenCalledTimes(2));
      expect(f.manager.endDrag).toHaveBeenLastCalledWith(f.spec, undefined);
    }
  },
);

it("cleans insertion state when extra configuration declines insertion", async () => {
  const f = setup(async () => false);
  f.start();
  fireEvent.mouseUp(document, { clientX: 300, clientY: 100 });
  await waitFor(() => expect(f.ended).toHaveBeenCalledOnce());
  expect(f.manager.endDrag).not.toHaveBeenCalled();
  expect(f.sc.stopUnlogged).toHaveBeenCalledOnce();
  expect(f.sc.setIsDraggingObject).toHaveBeenLastCalledWith(false);
});

it("rejects a drop over UI that covers a valid canvas point", async () => {
  const f = setup();
  f.start();
  await waitFor(() => expect(f.manager.drag).toHaveBeenCalled());
  f.hitTest.mockReturnValue([f.guard, f.panel, f.canvas]);
  fireEvent.mouseUp(document, { clientX: 420, clientY: 120 });
  await waitFor(() => expect(f.ended).toHaveBeenCalledOnce());
  expect(f.manager.endDrag).not.toHaveBeenCalled();
  expect(f.sc.setIsDraggingObject).toHaveBeenLastCalledWith(false);
});

it.each(["interactive", "arena"] as const)(
  "ends the drag as soon as its %s context changes",
  async (reason) => {
    const f = setup();
    f.start();
    await waitFor(() => expect(f.manager.drag).toHaveBeenCalled());
    if (reason === "interactive") {
      f.setInteractive(true);
    } else {
      act(() => f.arena.setState({ current: {} }));
    }
    expect(f.ended).toHaveBeenCalledOnce();
    expect(f.sc.stopUnlogged).toHaveBeenCalledOnce();
    expect(f.sc.setIsDraggingObject).toHaveBeenLastCalledWith(false);
    fireEvent.mouseUp(document, { clientX: 420, clientY: 120 });
    expect(f.manager.endDrag).not.toHaveBeenCalled();
  },
);

it.each(["mode change", "artboard replacement"])(
  "discards a pending configuration result after %s",
  async (reason) => {
    let resolveConfig = (_value: string) => undefined as void;
    const extraInfo = vi.fn(
      () =>
        new Promise<string>((resolve) => {
          resolveConfig = resolve;
        }),
    );
    const f = setup(extraInfo);
    f.start();
    fireEvent.mouseUp(document, { clientX: 420, clientY: 120 });
    await waitFor(() => expect(extraInfo).toHaveBeenCalledOnce());
    if (reason === "mode change") {
      f.setInteractive(true);
      f.setInteractive(false);
    } else {
      f.sc.tryGetViewCtxForFrame.mockReturnValue(undefined);
    }
    await act(async () => resolveConfig("configured"));
    await waitFor(() => expect(f.ended).toHaveBeenCalledOnce());
    expect(f.ended).toHaveBeenCalledExactlyOnceWith(f.spec, undefined);
    expect(f.manager.endDrag).not.toHaveBeenCalled();
    expect(f.sc.setIsDraggingObject).toHaveBeenLastCalledWith(false);
  },
);

it("cleans a failed move and allows the same insertable to start a new drag", async () => {
  const f = setup();
  const failure = new Error("Target no longer available");
  f.manager.drag.mockImplementationOnce(() => {
    throw failure;
  });
  f.start();
  await waitFor(() =>
    expect(fixture.report).toHaveBeenCalledExactlyOnceWith(failure),
  );
  expect(f.ended).toHaveBeenCalledExactlyOnceWith(f.spec, undefined);
  expect(f.sc.stopUnlogged).toHaveBeenCalledOnce();
  expect(f.sc.setIsDraggingObject).toHaveBeenLastCalledWith(false);
  f.start();
  fireEvent.mouseUp(document, { clientX: 420, clientY: 120 });
  await waitFor(() => expect(f.ended).toHaveBeenCalledTimes(2));
  expect(f.manager.endDrag).toHaveBeenCalledExactlyOnceWith(f.spec, undefined);
});
