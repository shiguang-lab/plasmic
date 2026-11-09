import { AppContext } from "@/wab/client/components/top-view";
import { StudioCtxContext } from "@/wab/client/contexts/StudioContexts";
import { fakeStudioCtx } from "@/wab/client/__testonly__/fake-init-ctx";
import LeftPane from "@/wab/client/components/studio/LeftPane";
import { TplMgr } from "@/wab/shared/TplMgr";
import { ComponentType } from "@/wab/shared/core/components";
import { createSite } from "@/wab/shared/core/sites";
import { mkTplComponent } from "@/wab/shared/core/tpls";
import { ensureKnownTplTag } from "@/wab/shared/model/classes";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import * as React from "react";

vi.mock("@/wab/client/components/studio/LeftTabStrip", () => ({ default: () => null }));
vi.mock("@/wab/client/components/sidebar/LeftComponentsPanel", () => ({ default: () => null }));
vi.mock("@/wab/client/components/sidebar-tabs/versions-tab/useVersionsPublishNotice", () => ({
  useVersionsPublishNotice: () => ({ useVersionsCTA: false, dismissVersionsCTA: () => undefined }),
}));
vi.mock("@/wab/client/components/sidebar/FindReferencesModal", () => ({
  FindReferencesModal: ({ displayName, usageSummary, onClose }) => (
    <section aria-label="References">
      <strong>{displayName}</strong>
      <output>{usageSummary.components.map((component) => component.name).join(", ")}</output>
      <button onClick={onClose}>Close references</button>
    </section>
  ),
}));

afterEach(cleanup);

it("refreshes an active reference query after committed model edits and target switches", async () => {
  const site = createSite(), manager = new TplMgr({ site });
  const target = manager.addComponent({ name: "Badge", type: ComponentType.Plain });
  const consumer = manager.addComponent({ name: "Customer", type: ComponentType.Plain });
  const { studioCtx: studio } = fakeStudioCtx({ site });
  await waitFor(() => expect(studio.initialRouteReady).toBe(true));
  // Match an actual canvas edit: the incremental recorder demands that component tree.
  studio.dbCtx().maybeObserveComponents([target, consumer]);
  studio.switchLeftTab(undefined);
  studio.setFindReferencesComponent(target);
  const mounted = render(<AppContext.Provider value={studio.app}><StudioCtxContext.Provider value={studio}><LeftPane studioCtx={studio} /></StudioCtxContext.Provider></AppContext.Provider>);
  try {
    expect(screen.getByText("Badge")).toBeTruthy();
    expect(screen.getByRole("status").textContent).toBe("");
    await act(async () => {
      await studio.changeUnsafe(() => {
        ensureKnownTplTag(consumer.tplTree).children.push(mkTplComponent(target, target.variants[0]));
      });
    });
    expect(screen.getByRole("status").textContent).toBe("Customer");
    await act(async () => { await studio.changeUnsafe(() => { target.name = "Renamed badge"; }); });
    expect(screen.getByText("Renamed badge")).toBeTruthy();
    act(() => { studio.setFindReferencesComponent(consumer); });
    expect(screen.getByText("Customer")).toBeTruthy();
    expect(screen.getByRole("status").textContent).toBe("");
  } finally { mounted.unmount(); await studio.awaitEval(); studio.dispose(); }
});
