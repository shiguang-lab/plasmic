import { assert } from "@/wab/shared/common";
import { ChangeRecorder } from "@/wab/shared/core/observable-model";
import { instUtil } from "@/wab/shared/model/InstUtil";
import { PageSettingsDialog } from "@/wab/client/components/PageSettingsDialog";
import { ModelSnapshots } from "@/wab/client/studio-ctx/model-snapshots";
import { StudioArenaState } from "@/wab/client/studio-ctx/studio-arena-state";
import type { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { TplMgr } from "@/wab/shared/TplMgr";
import { mkArenaFrame } from "@/wab/shared/Arenas";
import { ComponentType, isPageComponent, PageComponent } from "@/wab/shared/core/components";
import { createSite } from "@/wab/shared/core/sites";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import React from "react";
import { createStore } from "zustand/vanilla";

const fixture = vi.hoisted(() => ({
  arenaState: undefined as any,
  modelSnapshots: undefined as any,
  site: undefined as any,
}));
vi.mock("@/wab/client/contexts/StudioContexts", () => ({
  useStudioCtx: () => fixture,
}));
vi.mock("@/wab/client/components/PageSettings", () => ({
  default: ({ page, viewCtx }) => (
    <div>
      <input aria-label="Editing page" readOnly value={page.name} />
      <output data-testid="page-context">
        {viewCtx?.component.name ?? "No canvas context"}
      </output>
    </div>
  ),
}));
afterEach(() => {
  cleanup();
  fixture.arenaState?.dispose?.();
  fixture.modelSnapshots?.dispose?.();
  fixture.arenaState = undefined;
  fixture.modelSnapshots = undefined;
  fixture.site = undefined;
});

function setup() {
  const mgr = new TplMgr({ site: createSite() });
  fixture.modelSnapshots = new ModelSnapshots();
  fixture.site = mgr.site();
  fixture.arenaState = new StudioArenaState({
    site: fixture.site,
    modelSnapshots: fixture.modelSnapshots,
  });
  return mgr;
}

function registerView(component: PageComponent): ViewCtx {
  const frame = mkArenaFrame({
    site: fixture.site,
    component,
    name: component.name,
    width: 100,
    height: 100,
  });
  const view = {
    studioCtx: fixture,
    component,
    modelLifetime: fixture.arenaState.lifetime(),
    isDisposed: false,
    arenaFrame: () => frame,
    initialRenderReadyStore: createStore<boolean>(() => false),
  } as unknown as ViewCtx;
  fixture.arenaState.viewRegistry.register(view);
  return view;
}

it("identifies the requested page and excludes another page's canvas context", () => {
  const mgr = setup();
  const current = mgr.addComponent({ name: "Page1", type: ComponentType.Page });
  const page = mgr.addComponent({
    name: "Page2",
    type: ComponentType.Page,
  }) as PageComponent;
  registerView(current as PageComponent);
  const onClose = vi.fn();
  render(<PageSettingsDialog open page={page} onClose={onClose} />);
  expect(
    screen.getByRole("dialog").getAttribute("aria-labelledby"),
  ).toBeTruthy();
  expect(screen.getByText("Page settings: Page2")).toBeTruthy();
  expect(screen.getByTestId("page-context").textContent).toBe(
    "No canvas context",
  );
  let pageView: ViewCtx | undefined;
  act(() => {
    pageView = registerView(page);
  });
  expect(screen.getByTestId("page-context").textContent).toBe("Page2");
  act(() => {
    fixture.arenaState.viewRegistry.remove(pageView!);
  });
  expect(screen.getByTestId("page-context").textContent).toBe(
    "No canvas context",
  );
});

it.each(["Done", "Close"])(
  "keeps page settings mounted after closing through %s and reopening",
  async (buttonName) => {
    const mgr = setup();
    const page = mgr.addComponent({
      name: "Page2",
      type: ComponentType.Page,
    }) as PageComponent;
    const onClose = vi.fn();
    function Dialog() {
      const [open, setOpen] = React.useState(true);
      return (
        <>
          <button onClick={() => setOpen(true)}>Reopen settings</button>
          <PageSettingsDialog
            open={open}
            page={page}
            onClose={() => {
              onClose();
              setOpen(false);
            }}
          />
        </>
      );
    }
    render(<Dialog />);
    const field = screen.getByLabelText("Editing page");
    fireEvent.click(screen.getByRole("button", { name: buttonName }));
    expect(onClose).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(field.isConnected).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Reopen settings" }));
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.getByLabelText("Editing page")).toBe(field);
  },
);


it("updates the title after a model rename and when switching pages", () => {
  const mgr = setup();
  const first = mgr.addComponent({ name: "First", type: ComponentType.Page });
  const second = mgr.addComponent({ name: "Second", type: ComponentType.Page });
  assert(isPageComponent(first) && isPageComponent(second), "Expected pages");
  const { rerender } = render(<PageSettingsDialog open page={first} onClose={vi.fn()} />);
  expect(screen.getByText("Page settings: First")).toBeTruthy();
  const recorder = new ChangeRecorder({ inst: first, _instUtil: instUtil });
  act(() => {
    fixture.modelSnapshots.sync(recorder.withRecording(() => { first.name = "Renamed"; }).changes);
  });
  recorder.dispose();
  expect(screen.getByText("Page settings: Renamed")).toBeTruthy();
  rerender(<PageSettingsDialog open page={second} onClose={vi.fn()} />);
  expect(screen.getByText("Page settings: Second")).toBeTruthy();
});
