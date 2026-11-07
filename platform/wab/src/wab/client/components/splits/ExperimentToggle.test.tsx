import { fakeStudioCtx } from "@/wab/client/__testonly__/fake-init-ctx";
import ExperimentToggle from "@/wab/client/components/splits/ExperimentToggle";
import { StudioCtxContext } from "@/wab/client/contexts/StudioContexts";
import { ensure } from "@/wab/shared/common";
import { SplitStatus, SplitType } from "@/wab/shared/core/splits";
import { ComponentType } from "@/wab/shared/core/components";
import { createSite } from "@/wab/shared/core/sites";
import { TplMgr } from "@/wab/shared/TplMgr";
import { Split } from "@/wab/shared/model/classes";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";

afterEach(cleanup);

async function setup(status: SplitStatus) {
  const site = createSite();
  const split = new Split({
    uuid: "split-under-test",
    name: "Checkout experiment",
    splitType: SplitType.Experiment,
    slices: [],
    status,
    targetEvents: [],
    description: null,
    externalId: null,
  });
  site.splits.push(split);
  const component = new TplMgr({ site }).addComponent({
    name: "Page",
    type: ComponentType.Plain,
  });
  const { studioCtx } = fakeStudioCtx({ site });
  await waitFor(() => expect(studioCtx.initialRouteReady).toBe(true));
  return { site, component, split, studioCtx };
}

function toggleRoot(container: HTMLElement) {
  return ensure(
    container.querySelector<HTMLElement>(".root"),
    "Experiment toggle root",
  );
}

function isChecked(container: HTMLElement) {
  const indicator = ensure(
    container.querySelector(".selectionIndicator"),
    "Experiment toggle selection indicator",
  );
  return indicator.classList.contains("selectionIndicatorchecked");
}

it("follows status committed from another Studio entrypoint and undo without replacing the root", async () => {
  const { component, split, studioCtx } = await setup(SplitStatus.New);
  const ref = React.createRef<HTMLDivElement>();
  try {
    const { container } = render(
      <StudioCtxContext.Provider value={studioCtx}>
        <ExperimentToggle ref={ref} split={split} />
      </StudioCtxContext.Provider>,
    );
    const root = toggleRoot(container);
    expect(ref.current).toBe(root);
    expect(screen.getByText("OFF")).toBeTruthy();
    expect(screen.getByText("ON")).toBeTruthy();
    expect(isChecked(container)).toBe(false);

    // The route-load anchor record is absent in this fixture; make one real
    // Studio change so the status commit is an undoable step.
    await act(async () => {
      await studioCtx.changeUnsafe(() => {
        component.name = "Renamed page";
      });
    });
    await act(async () => {
      await studioCtx.changeUnsafe(() => {
        split.status = SplitStatus.Running;
      });
    });
    expect(split.status).toBe(SplitStatus.Running);
    expect(studioCtx.canUndo()).toBe(true);
    expect(isChecked(container)).toBe(true);
    expect(toggleRoot(container)).toBe(root);
    expect(ref.current).toBe(root);

    await act(async () => {
      await studioCtx.undo();
    });
    expect(split.status).toBe(SplitStatus.New);
    expect(isChecked(container)).toBe(false);
    expect(toggleRoot(container)).toBe(root);

    await act(async () => {
      await studioCtx.changeUnsafe(() => {
        split.status = SplitStatus.Stopped;
      });
    });
    expect(isChecked(container)).toBe(false);
    expect(toggleRoot(container)).toBe(root);
    expect(ref.current).toBe(root);
  } finally {
    studioCtx.dispose();
  }
});

it("toggles the current status through the real Studio change command and keeps click/ref semantics", async () => {
  const { split, studioCtx } = await setup(SplitStatus.Stopped);
  const ref = React.createRef<HTMLDivElement>();
  try {
    const { container } = render(
      <StudioCtxContext.Provider value={studioCtx}>
        <ExperimentToggle ref={ref} split={split} />
      </StudioCtxContext.Provider>,
    );
    const root = toggleRoot(container);
    expect(ref.current).toBe(root);
    expect(isChecked(container)).toBe(false);

    await act(async () => {
      fireEvent.click(root);
    });
    await waitFor(() => expect(split.status).toBe(SplitStatus.Running));
    expect(isChecked(container)).toBe(true);
    expect(toggleRoot(container)).toBe(root);
    expect(ref.current).toBe(root);

    await act(async () => {
      fireEvent.click(root);
    });
    await waitFor(() => expect(split.status).toBe(SplitStatus.Stopped));
    expect(isChecked(container)).toBe(false);
    expect(toggleRoot(container)).toBe(root);

    await act(async () => {
      await studioCtx.changeUnsafe(() => {
        split.status = SplitStatus.Running;
      });
      fireEvent.click(root);
    });
    await waitFor(() => expect(split.status).toBe(SplitStatus.Stopped));
    expect(isChecked(container)).toBe(false);
    expect(toggleRoot(container)).toBe(root);
    expect(ref.current).toBe(root);
  } finally {
    studioCtx.dispose();
  }
});
