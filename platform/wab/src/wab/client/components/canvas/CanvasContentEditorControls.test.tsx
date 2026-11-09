import { ChangeRecorder } from "@/wab/shared/core/observable-model";
import { instUtil } from "@/wab/shared/model/InstUtil";
import { CanvasFrameInfoOwner } from "@/wab/client/components/canvas/canvas-frame-info";
import { StudioCtx as ActualStudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { ViewCtx as ActualViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { ComponentType, mkComponent } from "@/wab/shared/core/components";
import { mkArenaFrame } from "@/wab/shared/Arenas";
import { createSite } from "@/wab/shared/core/sites";
import { CanvasRenderOwner } from "@/wab/client/components/canvas/canvas-cache";
import { CanvasSessionState } from "@/wab/client/components/canvas/canvas-session-state";
import { StudioRenderPolicy } from "@/wab/client/studio-ctx/studio-render-policy";
import { AntdConfigProvider, productTheme } from "@/wab/client/antd-theme";
import { createViewportFixture } from "@/wab/client/__testonly__/viewport";
import { createStudioModeFixture } from "@/wab/client/__testonly__/studio-mode";
import { CanvasContentEditorControls } from "@/wab/client/components/canvas/CanvasContentEditorControls";
import { setLanguagePreference } from "@/wab/client/i18n";
import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { ModelSnapshots } from "@/wab/client/studio-ctx/model-snapshots";
import { ViewSelection } from "@/wab/client/studio-ctx/view-selection";
import { StudioSelection } from "@/wab/client/studio-ctx/studio-selection";
import { CanvasContentEditor, CanvasContentEditorIndex, type ContentEditorTarget, getContentEditorTarget } from "@/wab/client/studio-ctx/canvas-content-editor";
import { setAppearancePreference } from "@/wab/client/ui-theme";
import { mkTplTagX } from "@/wab/shared/core/tpls";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { theme as AntdTheme } from "antd";
import * as React from "react";
import { vi } from "vitest";

vi.mock("@/wab/client/studio-ctx/canvas-content-editor", async (original) => ({
  ...await original<typeof import("@/wab/client/studio-ctx/canvas-content-editor")>(),
  getContentEditorTarget: vi.fn(),
}));
const selectionDisposals: (() => void)[] = [];
function installSelectionSources(studio: StudioCtx) {
  const view = studio.focusedViewCtx();
  const models = new ModelSnapshots(), selection = new ViewSelection(() => models), focused = new StudioSelection(() => models);
  const lifetime = new AbortController();
  Object.defineProperties(view, {
    selection: { value: selection }, selectionStore: { value: selection.store },
    disposeSignal: { value: lifetime.signal },
    focusedTplAncestorsThroughComponents: { value: () => [] },
  });
  Object.defineProperties(studio, { selection: { value: focused }, selectionStore: { value: focused.store }, modelSnapshots: { value: models } });
  focused.set(view, []);
  selectionDisposals.push(() => { lifetime.abort(); selection.dispose(); focused.dispose(); models.dispose(); });
}
function installContentEditor(studio: StudioCtx, initial?: ContentEditorTarget) {
  const view = studio.focusedViewCtx();
  if (!view) { throw new Error("UI editor fixture view"); }
  const session = new CanvasSessionState(), cache = new CanvasRenderOwner(session);
  const index = new CanvasContentEditorIndex(() => [view]);
  Object.defineProperties(studio, { activeContentEditorStore: { value: index.store } });
  studio.withContentEditorPublication = (command) => index.deferPublication(command);
  studio.publishContentEditorInputs = (publish) => index.queue(publish);
  Object.defineProperty(view, "canvasRenderOwner", { value: cache });
  const editor = new CanvasContentEditor(view);
  Object.defineProperty(view, "contentEditor", { value: editor });
  const site = createSite(), component = mkComponent({ name: "Controls", type: ComponentType.Plain, tplTree: mkTplTagX("div") });
  site.components.push(component);
  const frame = mkArenaFrame({ site, component, name: "Controls", width: 800, height: 600 });
  Object.defineProperties(view, {
    site: { value: site }, arenaFrame: { value: () => frame },
    _canvasExporting: { value: false, writable: true },
    canvasExporting: { get: () => Reflect.get(ActualViewCtx.prototype, "canvasExporting", view) },
  });
  view.setCanvasExporting = (value) => ActualViewCtx.prototype.setCanvasExporting.call(view, value);
  studio.hasPendingModelChanges = () => false;
  studio.subscribeModelChanges = () => () => undefined;
  Object.defineProperties(studio, { pendingArenaViewDisposals: { value: new Set() }, currentArena: { value: null } });
  Object.setPrototypeOf(studio, ActualStudioCtx.prototype);
  const info = new CanvasFrameInfoOwner(view);
  Object.assign(view.canvasCtx, { frameInfo: () => info.store, prepareFrameInfo: () => info.prepare() });
  selectionDisposals.unshift(() => info.dispose());
  const install = (target?: ContentEditorTarget) => editor["commitSession"]({ target, size: undefined, ready: !!target, expandedAncestors: Object.freeze([]) });
  vi.spyOn(editor, "enter").mockImplementation(async (target) => install(target));
  vi.spyOn(editor, "exit").mockImplementation(() => install());
  vi.spyOn(editor, "containsElement").mockImplementation((element) => editor.target?.element.contains(element) ?? false);
  if (initial) { install(initial); }
  selectionDisposals.unshift(() => { editor.dispose(); index.dispose(); cache.dispose(); session.dispose(); });
  return editor;
}
afterEach(async () => {
  cleanup();
  selectionDisposals.splice(0).forEach((dispose) => dispose());
  vi.restoreAllMocks();
  await act(async () => {
    await setLanguagePreference("en");
  });
  setAppearancePreference("dark");
});

test("entry names its owner and keeps a visible generic exit independent of the selected child", async () => {
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
    x: 0, y: 0, left: 0, top: 0, right: 1200, bottom: 800,
    width: 1200, height: 800, toJSON: () => ({}),
  });
  vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockReturnValue(240);
  vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockReturnValue(28);
  const tpl = mkTplTagX("div");
  tpl.name = "ActivityFeed";
  const element = document.createElement("div");
  document.body.append(element);
  const panel = document.createElement("div");
  panel.className = "canvas-editor__left-pane";
  document.body.append(panel);
  const padding = { left: 80, right: 320, bottom: 80 };
  const target = { tpl, element, fullKey: "feed[0]" };
  const vc = { focusedDomElts: () => [], canvasCtx: { viewport: () => element } };
  const studioCtx = {
    viewCtxs: [vc],
    focusedViewCtx: () => vc,
    zoom: 1,
    ...createViewportFixture(),
    ...createStudioModeFixture(),
    canvasZoomPadding: () => padding,
    renderPolicy: new StudioRenderPolicy({ isLive: () => false, isDragging: () => false }),
    isInteractiveMode: false,
    isLiveMode: false,
  } as unknown as StudioCtx;
  Object.assign(vc, { studioCtx });
  installSelectionSources(studioCtx);
  const editor = installContentEditor(studioCtx);
  vi.mocked(getContentEditorTarget).mockReturnValue(target);
  render(
    <div>
      <CanvasContentEditorControls studioCtx={studioCtx} />
    </div>,
  );
  expect(screen.getByText("ActivityFeed")).toBeTruthy();
  const recorder = new ChangeRecorder({ inst: tpl, _instUtil: instUtil });
  selectionDisposals.push(() => recorder.dispose());
  act(() => { studioCtx.modelSnapshots.sync(recorder.withRecording(() => { tpl.name = "UpdatedFeed"; }).changes); });
  expect(screen.getByText("UpdatedFeed")).toBeTruthy();
  expect(screen.getByRole("toolbar", { name: "Edit content" }).style.width).toBe("");
  fireEvent.click(screen.getByRole("button", { name: "Edit content" }));
  expect(editor.enter).toHaveBeenCalledWith(target);
  const mode = screen.getByRole("toolbar", { name: "Content editing" });
  expect(mode.style.left).toBe("640px");
  expect(mode.style.top).toBe("60px");
  expect(mode.style.maxWidth).toBe("800px");
  expect(mode.style.width).toBe("");
  expect(getComputedStyle(mode).height).toBe("28px");
  expect(getComputedStyle(mode).flexWrap).toBe("nowrap");
  expect(screen.getByRole("button", { name: /Exit content editing/ }).classList.contains("ant-btn-primary")).toBe(false);
  const label = document.createElement("div");
  label.className = "node-outline-tag";
  label.setAttribute("role", "toolbar");
  label.getBoundingClientRect = () => new DOMRect(640, 60, 240, 28);
  const tree = label.appendChild(document.createElement("div"));
  tree.setAttribute("data-canvas-node-tree", "");
  tree.getBoundingClientRect = () => new DOMRect(640, 40, 240, 200);
  await act(async () => { mode.parentElement?.appendChild(label); });
  expect(mode.style.left).toBe("640px");
  expect(mode.style.top).toBe("60px");
  label.remove();
  padding.left = 320;
  fireEvent.transitionEnd(panel);
  expect(mode.style.left).toBe("640px");
  expect(mode.style.maxWidth).toBe("560px");
  padding.left = 80;
  fireEvent.transitionEnd(panel);
  expect(mode.style.left).toBe("640px");
  expect(mode.style.maxWidth).toBe("800px");
  // Reduced-motion panels update their open state without a transition event.
  await act(async () => {
    padding.left = 320;
    panel.setAttribute("data-open", "true");
  });
  expect(mode.style.left).toBe("640px");
  expect(mode.style.maxWidth).toBe("560px");
  fireEvent.click(screen.getByRole("button", { name: /Exit content editing/ }));
  expect(editor.exit).toHaveBeenCalledOnce();
  expect(screen.getByRole("button", { name: "Edit content" })).toBeTruthy();
  act(() => editor.viewCtx.setCanvasExporting(true));
  expect(screen.queryByRole("toolbar", { name: "Edit content" })).toBeNull();
  act(() => editor.viewCtx.setCanvasExporting(false));
  expect(screen.getByRole("toolbar", { name: "Edit content" })).toBeTruthy();
  element.remove();
  panel.remove();
});

test("nested entry switches the single target while exit remains available and no parent navigation is added", () => {
  const outerTpl = mkTplTagX("div");
  outerTpl.name = "Panel";
  const innerTpl = mkTplTagX("div");
  innerTpl.name = "List";
  const outerElement = document.createElement("div");
  const innerElement = outerElement.appendChild(document.createElement("div"));
  document.body.append(outerElement);
  const outer = { tpl: outerTpl, element: outerElement, fullKey: "panel[0]" };
  const inner = {
    tpl: innerTpl,
    element: innerElement,
    fullKey: "panel[0].list[0]",
  };
  const vc = { focusedDomElts: () => [], canvasCtx: { viewport: () => outerElement } };
  const studioCtx = {
    viewCtxs: [vc],
    focusedViewCtx: () => vc,
    zoom: 1,
    ...createViewportFixture(),
    ...createStudioModeFixture(),
    canvasZoomPadding: () => ({ left: 20, right: 20, bottom: 80 }),
    renderPolicy: new StudioRenderPolicy({ isLive: () => false, isDragging: () => false }),
    isInteractiveMode: false,
    isLiveMode: false,
  } as unknown as StudioCtx;
  Object.assign(vc, { studioCtx });
  installSelectionSources(studioCtx);
  const editor = installContentEditor(studioCtx, outer);
  vi.mocked(getContentEditorTarget).mockReturnValue(inner);
  render(
    <div>
      <CanvasContentEditorControls studioCtx={studioCtx} />
    </div>,
  );
  const mode = screen.getByRole("toolbar", { name: "Content editing" });
  const entry = screen.getByRole("toolbar", { name: "Edit content" });
  expect(mode.textContent).toContain("Panel");
  expect(entry.textContent).toContain("List");
  expect(editor.enter).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Edit content" }));
  expect(editor.enter).toHaveBeenCalledWith(inner);
  expect(
    screen.getByRole("toolbar", { name: "Content editing" }).textContent,
  ).toContain("List");
  expect(screen.queryByRole("toolbar", { name: "Edit content" })).toBeNull();
  expect(screen.queryByText("Panel")).toBeNull();
  expect(
    screen.queryByRole("button", { name: /back|parent|level/i }),
  ).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: /Exit content editing/ }));
  expect(editor.exit).toHaveBeenCalledOnce();
  outerElement.remove();
});

test("entry and mode controls follow all Studio languages and live light/dark theme changes", async () => {
  const tpl = mkTplTagX("div");
  tpl.name = "Panel";
  const nestedTpl = mkTplTagX("div");
  nestedTpl.name = "List";
  const element = document.createElement("div");
  const nested = element.appendChild(document.createElement("div"));
  document.body.append(element);
  const current = { tpl, element, fullKey: "panel[0]" };
  const candidate = {
    tpl: nestedTpl,
    element: nested,
    fullKey: "panel[0].list[0]",
  };
  const vc = {
    focusedDomElts: () => [],
    canvasCtx: { viewport: () => element },
  };
  const studioCtx = {
    viewCtxs: [vc],
    focusedViewCtx: () => vc,
    zoom: 1,
    ...createViewportFixture(),
    ...createStudioModeFixture(),
    canvasZoomPadding: () => ({ left: 20, right: 20, bottom: 80 }),
    renderPolicy: new StudioRenderPolicy({ isLive: () => false, isDragging: () => false }),
    isInteractiveMode: false,
    isLiveMode: false,
  } as unknown as StudioCtx;
  Object.assign(vc, { studioCtx });
  installSelectionSources(studioCtx);
  installContentEditor(studioCtx, current);
  vi.mocked(getContentEditorTarget).mockReturnValue(candidate);
  render(
    <AntdConfigProvider productUI>
      <div>
        <CanvasContentEditorControls studioCtx={studioCtx} />
      </div>
    </AntdConfigProvider>,
  );
  for (const [locale, entry, mode, exit] of [
    ["en", "Edit content", "Content editing", "Exit content editing"],
    ["zh-CN", "编辑内容", "内容编辑", "退出内容编辑"],
    ["zh-TW", "編輯內容", "內容編輯", "退出內容編輯"],
    ["ja", "コンテンツを編集", "コンテンツを編集中", "コンテンツ編集を終了"],
    ["ko", "콘텐츠 편집", "콘텐츠 편집 중", "콘텐츠 편집 종료"],
  ] as const) {
    await act(async () => {
      await setLanguagePreference(locale);
    });
    expect(screen.getByRole("toolbar", { name: mode })).toBeTruthy();
    expect(screen.getByRole("button", { name: entry })).toBeTruthy();
    expect(screen.getByRole("button", { name: `${exit} Esc` })).toBeTruthy();
    expect(screen.getByText("Panel")).toBeTruthy();
    expect(screen.getByText("List")).toBeTruthy();
  }
  const mode = screen.getByRole("toolbar", { name: "콘텐츠 편집 중" });
  const entry = screen.getByRole("toolbar", { name: "콘텐츠 편집" });
  const probe = document.createElement("span");
  document.body.append(probe);
  for (const appearance of ["light", "dark", "light"] as const) {
    act(() => setAppearancePreference(appearance));
    const token = AntdTheme.getDesignToken(productTheme(appearance));
    probe.style.backgroundColor = token.colorBgContainer;
    probe.style.color = token.colorText;
    for (const toolbar of [mode, entry]) {
      expect(getComputedStyle(toolbar).backgroundColor).toBe(
        getComputedStyle(probe).backgroundColor,
      );
      expect(getComputedStyle(toolbar).color).toBe(
        getComputedStyle(probe).color,
      );
    }
    expect(document.documentElement.dataset.uiAppearance).toBe(appearance);
  }
  probe.remove();
  element.remove();
});
