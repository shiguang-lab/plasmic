import { fakeStudioCtx } from "@/wab/client/__testonly__/fake-init-ctx";
import { RightPane } from "@/wab/client/components/studio/RightPane";
import { StudioCtxContext } from "@/wab/client/contexts/StudioContexts";
import { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { mkArenaFrame, mkMixedArena } from "@/wab/shared/Arenas";
import { TplMgr } from "@/wab/shared/TplMgr";
import { mkCodeComponent } from "@/wab/shared/code-components/code-components";
import { ensure } from "@/wab/shared/common";
import { ComponentType } from "@/wab/shared/core/components";
import { codeLit } from "@/wab/shared/core/exprs";
import { mkParam } from "@/wab/shared/core/lang";
import { createSite } from "@/wab/shared/core/sites";
import { mkTplComponentX } from "@/wab/shared/core/tpls";
import { ensureKnownTplTag } from "@/wab/shared/model/classes";
import { typeFactory } from "@/wab/shared/model/model-util";
import { act, render, waitFor } from "@testing-library/react";
import React from "react";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it("inspects the selected published component's real props and styles without offering edits", async () => {
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  vi.spyOn(ViewCtx.prototype, "isVisible").mockReturnValue(false);
  vi.spyOn(ViewCtx.prototype, "scheduleSync").mockImplementation(
    () => undefined,
  );
  const site = createSite();
  const page = new TplMgr({ site }).addComponent({
    name: "Checkout",
    type: ComponentType.Page,
  });
  const field = mkCodeComponent(
    "Field",
    { name: "Field", importPath: "./Field", props: { label: "string" } },
    {},
  );
  field.params.push(
    mkParam({ name: "label", type: typeFactory.text(), paramType: "prop" }),
  );
  site.components.push(field);
  const root = ensureKnownTplTag(page.tplTree);
  const fields = ["Address", "City"].map((name) => {
    const node = mkTplComponentX({
      name,
      component: field,
      baseVariant: page.variants[0],
      args: { label: codeLit(name + " label") },
    });
    node.parent = root;
    root.children.push(node);
    node.vsettings[0].rs.values.width = "240px";
    return node;
  });
  const frame = mkArenaFrame({
    site,
    component: page,
    name: "Checkout",
    width: 1000,
    height: 800,
  });
  site.arenas.push(mkMixedArena("Checkout", [frame]));
  const { studioCtx: studio } = fakeStudioCtx({
    site,
    siteInfo: { isTemplate: true, publishedTemplateVersion: "1.0.0" },
    initialUrl:
      "/projects/test?arena_type=custom&arena=Checkout&publishedTemplate=true",
  });
  await waitFor(() => expect(studio.initialRouteReady).toBe(true));
  const view = ensure(
    studio.tryGetViewCtxForFrame(frame),
    "Published page view",
  );
  studio.setStudioFocusOnFrameContents(frame);
  view.setStudioFocusByTpl(fields[0]);
  const { container, unmount } = render(
    <StudioCtxContext.Provider value={studio}>
      <RightPane studioCtx={studio} canvasLoading={false} />
    </StudioCtxContext.Provider>,
  );
  try {
    await waitFor(() =>
      expect(container.textContent).toContain("Address label"),
    );
    expect(container.textContent).toContain("240px");
    act(() => view.setStudioFocusByTpl(fields[1]));
    await waitFor(() => expect(container.textContent).toContain("City label"));
    expect(container.textContent).not.toContain("Address label");
    expect(
      container.querySelector("input, textarea, [contenteditable=true]"),
    ).toBeNull();
    expect(studio.hasUnsavedChanges()).toBe(false);
  } finally {
    unmount();
    studio.dispose();
  }
});
