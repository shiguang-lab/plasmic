import { AntdConfigProvider, productTheme } from "@/wab/client/antd-theme";
import { CanvasContentEditorControls } from "@/wab/client/components/canvas/CanvasContentEditorControls";
import { setLanguagePreference } from "@/wab/client/i18n";
import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { getContentEditorTarget } from "@/wab/client/studio-ctx/canvas-content-editor";
import { setAppearancePreference } from "@/wab/client/ui-theme";
import { mkTplTagX } from "@/wab/shared/core/tpls";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { theme } from "antd";
import { observable } from "mobx";
import * as React from "react";
import { vi } from "vitest";

vi.mock("@/wab/client/studio-ctx/canvas-content-editor", () => ({
  getContentEditorTarget: vi.fn(),
}));
afterEach(async () => {
  cleanup();
  await act(async () => {
    await setLanguagePreference("en");
  });
  setAppearancePreference("dark");
});

test("entry names its owner and keeps a visible generic exit independent of the selected child", () => {
  const tpl = mkTplTagX("div");
  tpl.name = "ActivityFeed";
  const element = document.createElement("div");
  document.body.append(element);
  const target = { tpl, element, fullKey: "feed[0]" };
  const active = observable.box<typeof target | undefined>();
  const editor = {
    get target() {
      return active.get();
    },
    enter: vi.fn(() => active.set(target)),
    exit: vi.fn(() => active.set(undefined)),
  };
  const vc = { contentEditor: editor, canvasCtx: { viewport: () => element } };
  const studioCtx = {
    viewCtxs: [vc],
    focusedViewCtx: () => vc,
    zoom: 1,
    viewportCtx: { scroll: () => ({ x: 0, y: 0 }) },
    canvasZoomPadding: () => ({ left: 20, right: 20 }),
    isInteractiveMode: false,
    isLiveMode: false,
  } as unknown as StudioCtx;
  Object.assign(vc, { studioCtx });
  vi.mocked(getContentEditorTarget).mockReturnValue(target);
  render(
    <div>
      <CanvasContentEditorControls studioCtx={studioCtx} />
    </div>,
  );
  expect(screen.getByText("ActivityFeed")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Edit content" }));
  expect(editor.enter).toHaveBeenCalledWith(target);
  expect(screen.getByRole("toolbar", { name: "Content editing" })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: /Exit content editing/ }));
  expect(editor.exit).toHaveBeenCalledOnce();
  expect(screen.getByRole("button", { name: "Edit content" })).toBeTruthy();
  element.remove();
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
  const active = observable.box<typeof outer | undefined>(outer, {
    deep: false,
  });
  const editor = {
    get target() {
      return active.get();
    },
    enter: vi.fn((target) => active.set(target)),
    exit: vi.fn(() => active.set(undefined)),
  };
  const vc = {
    contentEditor: editor,
    canvasCtx: { viewport: () => outerElement },
  };
  const studioCtx = {
    viewCtxs: [vc],
    focusedViewCtx: () => vc,
    zoom: 1,
    viewportCtx: { scroll: () => ({ x: 0, y: 0 }) },
    canvasZoomPadding: () => ({ left: 20, right: 20 }),
    isInteractiveMode: false,
    isLiveMode: false,
  } as unknown as StudioCtx;
  Object.assign(vc, { studioCtx });
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
    contentEditor: { target: current },
    canvasCtx: { viewport: () => element },
  };
  const studioCtx = {
    viewCtxs: [vc],
    focusedViewCtx: () => vc,
    zoom: 1,
    viewportCtx: { scroll: () => ({ x: 0, y: 0 }) },
    canvasZoomPadding: () => ({ left: 20, right: 20 }),
    isInteractiveMode: false,
    isLiveMode: false,
  } as unknown as StudioCtx;
  Object.assign(vc, { studioCtx });
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
    const token = theme.getDesignToken(productTheme(appearance));
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
