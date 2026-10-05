import { CanvasOverlayToolbar } from "@/wab/client/components/canvas/CanvasOverlayToolbar";
import { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { mkBaseVariant } from "@/wab/shared/Variants";
import { mkCodeComponent } from "@/wab/shared/code-components/code-components";
import { ComponentType, mkComponent } from "@/wab/shared/core/components";
import { mkParam } from "@/wab/shared/core/lang";
import { mkTplComponent, mkTplTagX } from "@/wab/shared/core/tpls";
import { ValComponent } from "@/wab/shared/core/val-nodes";
import { typeFactory } from "@/wab/shared/model/model-util";
import { fireEvent, render, screen } from "@testing-library/react";
import { observable } from "mobx";
import * as React from "react";
import { vi } from "vitest";

test("one icon toggles effective auto-open state per instance without writing component props", () => {
  const base = mkBaseVariant();
  const label = mkTplTagX("span", { baseVariant: base });
  const wrapperComponent = mkCodeComponent(
    "Dropdown",
    { name: "Dropdown", importPath: "overlay-test", props: {} },
    {},
  );
  wrapperComponent.params.push(
    mkParam({
      name: "children",
      paramType: "slot",
      type: typeFactory.renderable(),
    }),
    mkParam({
      name: "previewOpen",
      paramType: "prop",
      type: typeFactory.any(),
    }),
  );
  const wrapper = mkTplComponent(wrapperComponent, base, {}, [label]);
  const component = mkComponent({
    type: ComponentType.Plain,
    tplTree: mkTplTagX("div", { baseVariant: base }, [wrapper]),
  });
  const savedArgs = wrapper.vsettings[0].args.slice();
  const selectedKey = observable.box("wrapper[0]");
  const studioCtx = observable({ isInteractiveMode: false });
  const dom = observable.box(true);
  const viewCtx = Object.assign(Object.create(ViewCtx.prototype), {
    _canvasOverlayStates: observable.map(),
    _autoOpenedUuid: observable.box<string | undefined>(),
    scheduleSync: vi.fn(),
    currentComponent: () => component,
    getCodeComponentMeta: () => ({
      canvasOverlay: { triggerSlot: "children" },
    }),
    effectiveCurrentVariantSetting: (tpl: typeof wrapper) => tpl.vsettings[0],
    studioCtx,
    focusedTpls: () => [label],
    focusedDomElts: () => [{ length: dom.get() ? 1 : 0 }],
    focusedTplAncestorsThroughComponents: () => [
      { node: label },
      { node: wrapper },
    ],
    maybeTpl2ValsInContext: () => [
      Object.assign(Object.create(ValComponent.prototype), {
        fullKey: selectedKey.get(),
      }),
    ],
  }) as ViewCtx;
  viewCtx.syncCanvasOverlayState("wrapper[0]", true, false);
  const view = render(<CanvasOverlayToolbar viewCtx={viewCtx} />);
  expect(screen.getAllByRole("button")).toHaveLength(1);
  expect(screen.getByRole("button").textContent).toBe("");
  expect(screen.getByRole("button").getAttribute("aria-pressed")).toBe("true");
  fireEvent.click(screen.getByRole("button", { name: "收起 Dropdown 内容" }));
  expect(viewCtx.canvasOverlayOpen("wrapper[0]")).toBe(false);
  expect(screen.getByRole("button").getAttribute("aria-pressed")).toBe("false");
  fireEvent.click(screen.getByRole("button", { name: "展开 Dropdown 内容" }));
  expect(viewCtx.canvasOverlayOpen("wrapper[0]")).toBe(true);

  viewCtx.syncCanvasOverlayState("wrapper[1]", false, false);
  selectedKey.set("wrapper[1]");
  view.rerender(<CanvasOverlayToolbar viewCtx={viewCtx} />);
  expect(screen.getByRole("button").getAttribute("aria-pressed")).toBe("false");
  viewCtx.syncCanvasOverlayState("wrapper[1]", true, true);
  view.rerender(<CanvasOverlayToolbar viewCtx={viewCtx} />);
  expect(screen.getByRole("button").getAttribute("aria-pressed")).toBe("true");
  fireEvent.click(screen.getByRole("button", { name: "收起 Dropdown 内容" }));
  expect(viewCtx.canvasOverlayOpen("wrapper[1]")).toBe(false);
  expect(viewCtx.canvasOverlayOpen("wrapper[0]")).toBe(true);
  expect(wrapper.vsettings[0].args).toEqual(savedArgs);

  view.rerender(<CanvasOverlayToolbar viewCtx={viewCtx} fallback />);
  expect(screen.queryByRole("toolbar")).toBeNull();
  dom.set(false);
  view.rerender(<CanvasOverlayToolbar viewCtx={viewCtx} fallback />);
  expect(screen.getByRole("toolbar")).toBeTruthy();
  studioCtx.isInteractiveMode = true;
  view.rerender(<CanvasOverlayToolbar viewCtx={viewCtx} fallback />);
  expect(screen.queryByRole("toolbar")).toBeNull();
});
