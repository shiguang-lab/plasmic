import { fakeStudioCtx } from "@/wab/client/__testonly__/fake-init-ctx";
import { useProjectData } from "@/wab/client/studio-ctx/project-data-react";
import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { TplMgr } from "@/wab/shared/TplMgr";
import { ensure } from "@/wab/shared/common";
import { ComponentType } from "@/wab/shared/core/components";
import { createSite } from "@/wab/shared/core/sites";
import { ensureKnownTplTag } from "@/wab/shared/model/classes";
import { act, cleanup, render, screen } from "@testing-library/react";
import * as React from "react";

const studios = new Set<StudioCtx>();
afterEach(async () => {
  cleanup();
  for (const studio of studios) { await studio.awaitEval(); studio.dispose(); }
  studios.clear(); vi.restoreAllMocks();
});

it("subscribes to directory names, membership and routes without recomputing on content edits", async () => {
  vi.spyOn(ViewCtx.prototype, "isVisible").mockReturnValue(false);
  vi.spyOn(ViewCtx.prototype, "awaitSync").mockResolvedValue();
  const site = createSite(), mgr = new TplMgr({ site });
  const page = mgr.addComponent({ type: ComponentType.Page, name: "Customers" });
  const component = mgr.addComponent({ type: ComponentType.Plain, name: "Card" });
  const { studioCtx: studio } = fakeStudioCtx({ site }); studios.add(studio);
  studio.observeComponents([page, component]);
  const compute = vi.spyOn(studio, "getProjectData"), rendered = vi.fn();
  function Picker() {
    const data = useProjectData(studio); rendered();
    return <output>{JSON.stringify(data)}</output>;
  }
  const { unmount } = render(<Picker />);
  const count = rendered.mock.calls.length;
  compute.mockClear();
  await act(async () => { await studio.changeUnsafe(() => { ensureKnownTplTag(component.tplTree).name = "Content edit"; }); });
  expect(rendered).toHaveBeenCalledTimes(count);
  expect(compute).not.toHaveBeenCalled();
  await act(async () => { await studio.changeUnsafe(() => {
    page.name = "Clients"; ensure(page.pageMeta, "Page metadata").path = "/clients";
  }); });
  expect(screen.getByRole("status").textContent).toContain("Clients");
  expect(screen.getByRole("status").textContent).toContain("/clients");
  expect(compute).toHaveBeenCalledTimes(1);
  await act(async () => { await studio.changeUnsafe(() => { mgr.addComponent({ type: ComponentType.Plain, name: "Badge" }); }); });
  expect(screen.getByRole("status").textContent).toContain("Badge");
  const data = studio.getProjectData();
  expect(data.components.some((c) => c.name === "Badge")).toBe(true);
  unmount(); compute.mockClear();
  await act(async () => { await studio.changeUnsafe(() => { component.name = "After unmount"; }); });
  expect(compute).not.toHaveBeenCalled();
});
