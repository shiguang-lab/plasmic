import { fakeStudioCtx } from "@/wab/client/__testonly__/fake-init-ctx";
import {
  DesktopDraftController,
  DesktopDraftState,
  initialDesktopDraftState,
} from "@/wab/client/studio-ctx/desktop-drafts";
import {
  useDesktopDraftController,
  useDesktopDraftSelector,
} from "@/wab/client/studio-ctx/desktop-drafts-react";
import { act, cleanup, render, screen } from "@testing-library/react";
import React from "react";
import { mock } from "vitest-mock-extended";
import { createStore } from "zustand/vanilla";

afterEach(cleanup);

function controller() {
  const store = createStore<DesktopDraftState>(() => ({
    ...initialDesktopDraftState,
    enabled: true,
  }));
  const active = new Set<unknown>();
  const subscribe = store.subscribe;
  vi.spyOn(store, "subscribe").mockImplementation((listener) => {
    active.add(listener);
    const stop = subscribe(listener);
    return () => {
      active.delete(listener);
      stop();
    };
  });
  return {
    store,
    active,
    instance: mock<DesktopDraftController>({ store, dispose: vi.fn() }),
  };
}

it("switches the real editor's draft owner without retaining obsolete subscriptions", () => {
  const { studioCtx } = fakeStudioCtx();
  const first = controller();
  const second = controller();
  const publish = vi.fn();
  const stop = studioCtx.desktopDraftStore.subscribe(publish);
  const committed = vi.fn();
  function Status() {
    const current = useDesktopDraftController(studioCtx);
    const open = useDesktopDraftSelector(current, (state) => state.dialogOpen);
    return (
      <React.Profiler id="draft-owner" onRender={committed}>
        <output>{current ? String(open) : "inactive"}</output>
      </React.Profiler>
    );
  }
  const view = render(
    <React.StrictMode>
      <Status />
    </React.StrictMode>,
  );
  expect(screen.getByRole("status").textContent).toBe("inactive");
  act(() => {
    studioCtx.desktopDraft = first.instance;
  });
  expect(first.active.size).toBe(1);
  expect(screen.getByRole("status").textContent).toBe("false");
  const count = committed.mock.calls.length;
  act(() => {
    studioCtx.desktopDraft = first.instance;
  });
  expect(publish).toHaveBeenCalledTimes(1);
  expect(committed).toHaveBeenCalledTimes(count);
  act(() => first.store.setState({ dialogOpen: true }));
  expect(screen.getByRole("status").textContent).toBe("true");
  act(() => {
    studioCtx.desktopDraft = second.instance;
  });
  expect(first.active.size).toBe(0);
  expect(second.active.size).toBe(1);
  expect(screen.getByRole("status").textContent).toBe("false");
  const switched = committed.mock.calls.length;
  act(() => first.store.setState({ dialogOpen: false }));
  expect(committed).toHaveBeenCalledTimes(switched);
  act(() => studioCtx.dispose());
  expect(second.instance.dispose).toHaveBeenCalledOnce();
  expect(studioCtx.desktopDraftStore.getState()).toBeUndefined();
  expect(second.active.size).toBe(0);
  expect(screen.getByRole("status").textContent).toBe("inactive");
  view.unmount();
  stop();
});

it("keeps draft ownership separate for two editors", () => {
  const first = fakeStudioCtx().studioCtx;
  const second = fakeStudioCtx().studioCtx;
  const current = controller();
  first.desktopDraft = current.instance;
  expect(first.desktopDraftStore.getState()).toBe(current.instance);
  expect(second.desktopDraftStore.getState()).toBeUndefined();
});
