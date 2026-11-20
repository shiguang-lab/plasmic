import { fakeStudioCtx } from "@/wab/client/__testonly__/fake-init-ctx";
import { BottomModalsProvider } from "@/wab/client/components/BottomModal";
import { PopoverFrameProvider } from "@/wab/client/components/sidebar/PopoverFrame";
import { RightPane } from "@/wab/client/components/studio/RightPane";
import { AppContext } from "@/wab/client/components/top-view";
import { AppCtxContext } from "@/wab/client/contexts/AppContexts";
import {
  StudioCtxContext,
  ViewCtxContext,
} from "@/wab/client/contexts/StudioContexts";
import { RightTabKey } from "@/wab/client/studio-ctx/StudioCtx";
import { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { mkArenaFrame, mkMixedArena } from "@/wab/shared/Arenas";
import { TplMgr } from "@/wab/shared/TplMgr";
import { mkCodeComponent } from "@/wab/shared/code-components/code-components";
import { ensure } from "@/wab/shared/common";
import { ComponentType } from "@/wab/shared/core/components";
import { codeLit } from "@/wab/shared/core/exprs";
import { mkParam } from "@/wab/shared/core/lang";
import { createSite } from "@/wab/shared/core/sites";
import { initBuiltinActions, mkInteraction } from "@/wab/shared/core/states";
import { mkTplComponentX } from "@/wab/shared/core/tpls";
import {
  EventHandler,
  FunctionExpr,
  ensureKnownTplTag,
} from "@/wab/shared/model/classes";
import { typeFactory } from "@/wab/shared/model/model-util";
import { act, fireEvent, render, waitFor } from "@testing-library/react";
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
  const meta = {
    name: "Field",
    importPath: "./Field",
    props: {
      label: "string" as const,
      items: {
        type: "array" as const,
        itemType: {
          type: "object" as const,
          nameFunc: () => "Item details",
          fields: { note: "string" as const },
        },
      },
    },
  };
  const field = mkCodeComponent("Field", meta, {});
  field.params.push(
    mkParam({ name: "items", type: typeFactory.any(), paramType: "prop" }),
    mkParam({ name: "label", type: typeFactory.text(), paramType: "prop" }),
  );
  site.components.push(field);
  const root = ensureKnownTplTag(page.tplTree);
  const handler = new EventHandler({ interactions: [] });
  handler.interactions.push(
    mkInteraction(handler, "customFunction", "First action", {
      customFunction: new FunctionExpr({
        argNames: [],
        bodyExpr: codeLit("first"),
      }),
    }),
  );
  root.vsettings[0].attrs.onClick = handler;
  const fields = ["Address", "City"].map((name) => {
    const node = mkTplComponentX({
      name,
      component: field,
      baseVariant: page.variants[0],
      args: {
        label: codeLit(name + " label"),
        items: codeLit([{ note: name + " detail" }]),
      },
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
  const {
    studioCtx: studio,
    app,
    appCtx,
  } = fakeStudioCtx({
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
  vi.spyOn(view, "getCodeComponentMeta").mockReturnValue(meta);
  initBuiltinActions({
    projectId: studio.siteInfo.id,
    platform: "react",
    projectFlags: studio.projectFlags(),
    inStudio: true,
  });
  studio.setStudioFocusOnFrameContents(frame);
  view.setStudioFocusByTpl(fields[0]);
  studio.switchRightTab(RightTabKey.props);
  const { container, getByRole, unmount } = render(
    <AppContext.Provider value={app}>
      <AppCtxContext.Provider value={appCtx}>
        <StudioCtxContext.Provider value={studio}>
          <ViewCtxContext.Provider value={view}>
            <BottomModalsProvider>
              <PopoverFrameProvider containerSelector="body">
                <RightPane studioCtx={studio} canvasLoading={false} />
              </PopoverFrameProvider>
            </BottomModalsProvider>
          </ViewCtxContext.Provider>
        </StudioCtxContext.Provider>
      </AppCtxContext.Provider>
    </AppContext.Provider>,
  );
  try {
    await waitFor(() =>
      expect(container.textContent).toContain("Address label"),
    );
    expect(getByRole("tab", { name: "Design" })).toBeTruthy();
    expect(getByRole("tab", { name: "Interactions" })).toBeTruthy();
    expect(
      container.querySelector(
        '[data-test-id="items-add-btn"], [data-test-id="drag-handle"], [data-test-id="items-0-remove"]',
      ),
    ).toBeNull();
    fireEvent.click(getByRole("button", { name: "Item details" }));
    await waitFor(() =>
      expect(document.body.textContent).toContain("Address detail"),
    );
    expect(
      document.querySelector("input, textarea, [contenteditable=true]"),
    ).toBeNull();
    act(() => view.setStudioFocusByTpl(fields[1]));
    await waitFor(() => expect(container.textContent).toContain("City label"));
    expect(container.textContent).not.toContain("Address label");
    expect(
      container.querySelector("input, textarea, [contenteditable=true]"),
    ).toBeNull();
    fireEvent.click(getByRole("tab", { name: "Design" }));
    expect(
      getByRole("tab", { name: "Design" }).getAttribute("aria-selected"),
    ).toBe("true");
    act(() => view.setStudioFocusByTpl(root));
    fireEvent.click(getByRole("tab", { name: "Interactions" }));
    await waitFor(() =>
      expect(
        container.querySelector('[data-plasmic-prop="onClick"]'),
      ).toBeTruthy(),
    );
    fireEvent.click(
      ensure(
        container.querySelector('[data-plasmic-prop="onClick"]'),
        "On click handler",
      ),
    );
    await waitFor(() =>
      expect(document.body.textContent).toContain("First action"),
    );
    expect(
      document.querySelector(
        '[data-test-id="add-interaction"], [aria-label="Rename"], [aria-label="Remove"], [aria-label="Move"]',
      ),
    ).toBeNull();
    expect(
      document.querySelector(
        'input:not([type="hidden"]), textarea, [contenteditable="true"]',
      ),
    ).toBeNull();
    fireEvent.click(
      ensure(
        document.querySelector('[data-test-id="close-popover-frame"]'),
        "Close handler details",
      ),
    );
    const editorFields: string[] = [];
    for (const tab of ["Design", "Data"]) {
      fireEvent.click(getByRole("tab", { name: tab }));
      await waitFor(() =>
        expect(
          getByRole("tab", { name: tab }).getAttribute("aria-selected"),
        ).toBe("true"),
      );
      for (const field of container.querySelectorAll(
        'input:not([type="hidden"]), textarea, select, [contenteditable="true"]',
      )) {
        editorFields.push(tab + " / " + field.outerHTML);
      }
    }
    expect(editorFields).toEqual([]);
    expect(studio.hasUnsavedChanges()).toBe(false);
  } finally {
    unmount();
    studio.dispose();
  }
});
