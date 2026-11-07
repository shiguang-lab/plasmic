import { StudioRenderPolicy } from "@/wab/client/studio-ctx/studio-render-policy";
import { CanvasOverlayToolbar } from "@/wab/client/components/canvas/CanvasOverlayToolbar";
import { CanvasSessionState } from "@/wab/client/components/canvas/canvas-session-state";
import { setLanguagePreference } from "@/wab/client/i18n";
import { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { ModelSnapshots } from "@/wab/client/studio-ctx/model-snapshots";
import { ViewSelection } from "@/wab/client/studio-ctx/view-selection";
import { ViewVariantState } from "@/wab/client/studio-ctx/view-variant-state";
import { mkArenaFrame } from "@/wab/shared/Arenas";
import { GlobalVariantFrame, RootComponentVariantFrame } from "@/wab/shared/component-frame";
import { createSite } from "@/wab/shared/core/sites";
import { mkBaseVariant } from "@/wab/shared/Variants";
import { mkCodeComponent } from "@/wab/shared/code-components/code-components";
import { ComponentType, mkComponent } from "@/wab/shared/core/components";
import { mkParam } from "@/wab/shared/core/lang";
import { mkTplComponent, mkTplTagX } from "@/wab/shared/core/tpls";
import { ValComponent } from "@/wab/shared/core/val-nodes";
import { typeFactory } from "@/wab/shared/model/model-util";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { observable } from "mobx";
import * as React from "react";
import { vi } from "vitest";

beforeEach(async () => await act(async () => await setLanguagePreference("zh-CN")));
afterEach(async () => {
  cleanup();
  await act(async () => await setLanguagePreference("en"));
});

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
  const site = createSite(), models = new ModelSnapshots(), selection = new ViewSelection(() => models);
  const frame = mkArenaFrame({ site, component, width: 800, height: 600, name: "Overlay" });
  const variants = new ViewVariantState(() => models, () => frame, () => site, () => false, () => false);
  variants.replaceFrames([new RootComponentVariantFrame(frame)]); variants.setGlobal(new GlobalVariantFrame(site, frame));
  selection.setTpls([label]);
  const selectedKey = observable.box("wrapper[0]");
  const renderPolicy = new StudioRenderPolicy({ isLive: () => false, isDragging: () => false });
  const studioCtx = { renderPolicy };
  const dom = observable.box(true);
  const viewCtx = Object.assign(Object.create(ViewCtx.prototype), {
    selection, variants,
    canvasSessionState: new CanvasSessionState(),
    _autoOpenedUuid: observable.box<string | undefined>(),
    scheduleSync: vi.fn(),
    currentComponent: () => component,
    componentStackFrames: () => [{ component }],
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
      new ValComponent({
        tpl: wrapper, fullKey: selectedKey.get(), key: wrapper.uuid,
        valOwner: undefined, frameUid: 0, fibers: [], parent: undefined,
        className: "", slotInfo: undefined, slotArgs: new Map(), slotCanvasEnvs: new Map(),
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
  act(() => { viewCtx.syncCanvasOverlayState("wrapper[1]", true, true); });
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
  act(() => { renderPolicy.interactive = true; renderPolicy.prepareInputs(); renderPolicy.publishCommit(); });
  view.rerender(<CanvasOverlayToolbar viewCtx={viewCtx} fallback />);
  expect(screen.queryByRole("toolbar")).toBeNull();
  view.unmount(); viewCtx.canvasSessionState.dispose(); renderPolicy.dispose(); variants.dispose(); selection.dispose(); models.dispose();
});
