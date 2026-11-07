import { fakeStudioCtx } from "@/wab/client/__testonly__/fake-init-ctx";
import { NewScreenVariantForm } from "@/wab/client/components/sidebar-tabs/ResponsivenessPanel/NewScreenVariantForm";
import { StudioCtxContext } from "@/wab/client/contexts/StudioContexts";
import { ModelSnapshots } from "@/wab/client/studio-ctx/model-snapshots";
import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { mkScreenVariantGroup } from "@/wab/shared/SpecialVariants";
import { mkVariant } from "@/wab/shared/Variants";
import { ensure } from "@/wab/shared/common";
import { ChangeRecorder } from "@/wab/shared/core/observable-model";
import { createSite } from "@/wab/shared/core/sites";
import { instUtil } from "@/wab/shared/model/InstUtil";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { mock } from "vitest-mock-extended";

afterEach(cleanup);

it("selects one native strategy through group/variant/media-query changes and detaches previous fields", () => {
  const site = createSite();
  const group = ensure(site.activeScreenVariantGroup, "Expected initial screen group");
  const models = new ModelSnapshots();
  const recorder = new ChangeRecorder({ inst: site, _instUtil: instUtil });
  const studio = mock<StudioCtx>();
  Object.defineProperties(studio, { site: { value: site }, modelSnapshots: { value: models } });
  const commit = (fn: () => void) => act(() => { models.sync(recorder.withRecording(fn).changes); });
  const commits = vi.fn();
  const view = render(<StudioCtxContext.Provider value={studio}><React.Profiler id="Form" onRender={commits}><NewScreenVariantForm onSubmit={vi.fn()} /></React.Profiler></StudioCtxContext.Provider>);
  try {
    expect(screen.getByPlaceholderText("Min W")).toBeTruthy();
    expect(screen.getByPlaceholderText("Max W")).toBeTruthy();
    const variant = mkVariant({ name: "Mobile", parent: group, mediaQuery: "(min-width: 768px)" });
    commit(() => { group.variants.push(variant); });
    expect(screen.getByPlaceholderText("Min W")).toBeTruthy();
    expect(screen.queryByPlaceholderText("Max W")).toBeNull();
    const before = commits.mock.calls.length;
    commit(() => { variant.name = "Renamed"; variant.mediaQuery = "(min-width: 900px)"; });
    expect(commits).toHaveBeenCalledTimes(before);
    commit(() => { variant.mediaQuery = "(max-width: 900px)"; });
    expect(screen.queryByPlaceholderText("Min W")).toBeNull();
    expect(screen.getByPlaceholderText("Max W")).toBeTruthy();
    const nextGroup = mkScreenVariantGroup();
    const nextVariant = mkVariant({ name: "Next", parent: nextGroup, mediaQuery: "(min-width: 1100px)" });
    nextGroup.variants.push(nextVariant);
    commit(() => { site.globalVariantGroups.push(nextGroup); site.activeScreenVariantGroup = nextGroup; });
    expect(screen.queryByPlaceholderText("Max W")).toBeNull();
    const detached = commits.mock.calls.length;
    commit(() => { variant.mediaQuery = "(min-width: 1200px)"; });
    expect(commits).toHaveBeenCalledTimes(detached);
    const max = mkVariant({ name: "Max", parent: nextGroup, mediaQuery: "(max-width: 1400px)" });
    commit(() => { nextGroup.variants.push(max); });
    expect(screen.getByPlaceholderText("Max W")).toBeTruthy();
    commit(() => { nextGroup.variants.splice(nextGroup.variants.indexOf(max), 1); });
    expect(screen.queryByPlaceholderText("Max W")).toBeNull();
    commit(() => { site.activeScreenVariantGroup = null; });
    expect(screen.getByPlaceholderText("Min W")).toBeTruthy();
    expect(screen.getByPlaceholderText("Max W")).toBeTruthy();
  } finally { view.unmount(); recorder.dispose(); models.dispose(); }
});

it("creates a real screen variant through the unchanged form command", async () => {
  const { studioCtx } = fakeStudioCtx();
  await waitFor(() => expect(studioCtx.initialRouteReady).toBe(true));
  const submitted = vi.fn();
  const view = render(<StudioCtxContext.Provider value={studioCtx}><NewScreenVariantForm onSubmit={submitted} /></StudioCtxContext.Provider>);
  try {
    fireEvent.change(screen.getByPlaceholderText("Name"), { target: { value: "Tablet" } });
    fireEvent.change(screen.getByPlaceholderText("Min W"), { target: { value: "768" } });
    await act(async () => { fireEvent.submit(ensure(screen.getByRole("button", { name: "Add" }).closest("form"), "Expected screen variant form")); });
    await waitFor(() => expect(submitted).toHaveBeenCalledOnce());
    const variants = ensure(studioCtx.site.activeScreenVariantGroup, "Expected active screen group").variants;
    const created = ensure(variants.find((variant) => variant.name === "Tablet"), "Expected saved screen variant");
    expect(created.mediaQuery).toBe("(min-width:768px)");
    expect(screen.queryByPlaceholderText("Max W")).toBeNull();
    expect(screen.getByPlaceholderText("Name")).toHaveProperty("value", "");
  } finally { view.unmount(); studioCtx.dispose(); }
});
