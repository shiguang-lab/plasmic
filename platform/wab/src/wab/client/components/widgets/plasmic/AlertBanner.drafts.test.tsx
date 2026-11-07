import {
  AlertBanner,
  AlertSpec,
} from "@/wab/client/components/widgets/plasmic/AlertBanner";
import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import {
  DesktopDraftController,
  DesktopDraftState,
  initialDesktopDraftState,
} from "@/wab/client/studio-ctx/desktop-drafts";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ensure } from "@/wab/shared/common";
import { fakeStudioCtx } from "@/wab/client/__testonly__/fake-init-ctx";
import React from "react";
import { mock } from "vitest-mock-extended";
import { createStore } from "zustand/vanilla";

let active: StudioCtx;
afterEach(async () => { cleanup(); await active.awaitEval(); active.dispose(); document.querySelectorAll(".dark-mask").forEach(node => node.remove()); });
function draftController(status: DesktopDraftState["status"]) {
  const store = createStore<DesktopDraftState>(() => ({
    ...initialDesktopDraftState,
    enabled: true,
    initializing: false,
    status,
  }));
  return mock<DesktopDraftController>({
    store,
    setDialogOpen: (open) => store.setState({ dialogOpen: open }),
  });
}

it("keeps the draft review entry accessible while conflicting edits are blocked", async () => {
  const desktopDraft = draftController({ state: "conflict", pendingDrafts: 1 });
  const {studioCtx} = fakeStudioCtx({devFlagOverrides:{ccStubs:true}});
  active = studioCtx;
  await waitFor(() => expect(studioCtx.initialRouteReady).toBe(true));
  studioCtx.desktopDraft = desktopDraft;
  studioCtx.alertBannerState.set(AlertSpec.ConcurrentEdit);
  studioCtx.isAtTip = false;
  studioCtx.blockChanges = true;
  const mask = document.createElement("div");
  mask.className = "dark-mask";
  document.body.append(mask);
  render(<AlertBanner studioCtx={studioCtx} />);
  expect(screen.getByRole("alert").textContent).toContain(
    "Drafts need attention",
  );
  expect(document.querySelector(".dark-mask")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Local drafts" }));
  expect(desktopDraft.store.getState().dialogOpen).toBe(true);
});

it("keeps exact conflict identity and reads the current action when equal banner scalars do not republish", async () => {
  const {studioCtx} = fakeStudioCtx({devFlagOverrides:{ccStubs:true}});
  active = studioCtx;
  await waitFor(() => expect(studioCtx.initialRouteReady).toBe(true));
  studioCtx.desktopDraft = draftController({state:"conflict",pendingDrafts:1});
  studioCtx.alertBannerState.set({...AlertSpec.ConcurrentEdit});
  render(<AlertBanner studioCtx={studioCtx} />);
  expect(screen.queryByRole("button", {name:"Local drafts"})).toBeNull();
  act(() => { studioCtx.alertBannerState.set(AlertSpec.ConcurrentEdit); });
  expect(screen.getByRole("button", {name:"Local drafts"})).toBeTruthy();
  const first = vi.fn(); const current = vi.fn();
  act(() => { studioCtx.alertBannerState.set({stateVariant:"permError",actionFn:first}); });
  const banner = studioCtx.saveState.store.getState().banner;
  act(() => { studioCtx.alertBannerState.set({stateVariant:"permError",actionFn:current}); });
  expect(studioCtx.saveState.store.getState().banner).toBe(banner);
  fireEvent.click(screen.getByRole("button", {name:"Reload Project"}));
  expect(first).not.toHaveBeenCalled();
  expect(current).toHaveBeenCalledExactlyOnceWith(studioCtx);
  fireEvent.click(ensure(document.querySelector('[data-test-id="alert-banner-dismiss"]'), "Missing dismiss control"));
  expect(studioCtx.alertBannerState.get()).toBeNull();
  expect(screen.queryByRole("button", {name:"Reload Project"})).toBeNull();
});
