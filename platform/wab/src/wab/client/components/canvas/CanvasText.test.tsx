import { mkCanvasText, mkReadOnlyCanvasText, mkSlateChildren } from "@/wab/client/components/canvas/CanvasText";
import type { RenderingCtx } from "@/wab/client/components/canvas/canvas-rendering";
import type { SubDeps } from "@/wab/client/components/canvas/subdeps";
import { globalHookCtx } from "@/wab/client/react-global-hook/globalHook";
import { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { mkBaseVariant } from "@/wab/shared/Variants";
import { ensure } from "@/wab/shared/common";
import { ComponentType, mkComponent } from "@/wab/shared/core/components";
import { ChangeRecorder } from "@/wab/shared/core/observable-model";
import { ensureKnownRawText } from "@/wab/shared/model/classes";
import { mkTplInlinedText } from "@/wab/shared/core/tpls";
import { EffectiveVariantSetting } from "@/wab/shared/effective-variant-setting";
import type { CanvasEnv } from "@/wab/shared/eval";
import { instUtil } from "@/wab/shared/model/InstUtil";
import { act, cleanup, render } from "@testing-library/react";
import React from "react";
import * as ReactDOM from "react-dom";
import { mock } from "vitest-mock-extended";

afterEach(() => {
  cleanup();
  globalHookCtx.frames.get(409)?.dispose();
  vi.clearAllTimers(); vi.useRealTimers(); vi.unstubAllGlobals();
});

it("retains each public component type for the same real canvas React module", () => {
  const editing = mkCanvasText(React), readOnly = mkReadOnlyCanvasText(React), children = mkSlateChildren(React);
  expect(mkCanvasText(React)).toBe(editing);
  expect(mkReadOnlyCanvasText(React)).toBe(readOnly);
  expect(mkSlateChildren(React)).toBe(children);
  expect(editing).not.toBe(readOnly);
  expect(readOnly).not.toBe(children);
});

it("preserves native text DOM and the existing model observer in the read-only canvas component", async () => {
  vi.useFakeTimers();
  vi.stubGlobal("requestAnimationFrame", (fn: FrameRequestCallback) => setTimeout(() => fn(performance.now()), 16));
  vi.stubGlobal("cancelAnimationFrame", clearTimeout);
  const lifetime = new AbortController();
  const frame = globalHookCtx.createFrameState({ uid: 409, objectPrototype: {} });
  const sub = Object.assign(mock<SubDeps>(), { React, ReactDOM });
  const view: ViewCtx = Object.assign(Object.create(ViewCtx.prototype), {
    _isDisposed: false, disposeSignal: lifetime.signal,
    frameState: frame, arenaFrame: () => ({ uid: 409 }),
    canvasObservers: new Set(), uncommittedCanvasObservers: new Map(),
    canvasErrorObservers: new Set(), _canvasRerenderQueue: new Set(),
    canvasCtx: { Sub: sub }, syncQueue: { idle: () => true },
    studioCtx: { hasPendingModelChanges: () => false }, updateCtxPostChange: vi.fn(),
  });
  const base = mkBaseVariant(), node = mkTplInlinedText("First", [base]);
  const raw = ensureKnownRawText(node.vsettings[0].text);
  const component = mkComponent({ name: "Rich text", type: ComponentType.Plain, variants: [base], tplTree: node });
  const recorder = new ChangeRecorder({ inst: component, _instUtil: instUtil });
  const effectiveVs = new EffectiveVariantSetting(node, node.vsettings);
  const ctx = Object.assign(mock<RenderingCtx>(), { sub, viewCtx: view, env: Object.assign(mock<CanvasEnv>(), { $ctx: {} }) });
  const detached = vi.spyOn(view, "disposeCanvasObserver");
  const Text = mkReadOnlyCanvasText(React);
  const mounted = render(<React.StrictMode><Text node={node} inline ctx={ctx} effectiveVs={effectiveVs} /></React.StrictMode>);
  try {
    const root = ensure(mounted.container.firstElementChild, "Read-only text root");
    expect(root.textContent).toBe("First");
    expect(view.canvasObservers.size).toBe(1);
    mounted.rerender(<React.StrictMode><Text node={node} inline ctx={ctx} effectiveVs={effectiveVs} /></React.StrictMode>);
    expect(mounted.container.firstElementChild).toBe(root);
    await act(async () => {
      recorder.withRecording(() => { raw.text = "Model update"; });
      view.flushRerenderQueue();
    });
    expect(mounted.container.firstElementChild).toBe(root);
    expect(root.textContent).toBe("Model update");
    mounted.unmount();
    expect(view.canvasObservers.size).toBe(0);
    expect(detached).toHaveBeenCalled();
    expect(detached.mock.calls.every(([reaction]) => reaction.isDisposed)).toBe(true);
  } finally { mounted.unmount(); lifetime.abort(); recorder.dispose(); }
});
