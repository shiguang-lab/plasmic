import { CanvasObserver } from "../../../../../../canvas-packages/src/canvas-observer";
import { CanvasTextEditor, CanvasSlateChildren, CanvasStoreProjection } from "../../../../../../canvas-packages/src/canvas-text";
import { CanvasRenderOwner } from "@/wab/client/components/canvas/canvas-cache";
import { CanvasSessionState } from "@/wab/client/components/canvas/canvas-session-state";
import { ModelSnapshots } from "@/wab/client/studio-ctx/model-snapshots";
import { ViewSelection } from "@/wab/client/studio-ctx/view-selection";
import { ViewVariantState } from "@/wab/client/studio-ctx/view-variant-state";
import { createSite } from "@/wab/shared/core/sites";
import { mkArenaFrame } from "@/wab/shared/Arenas";
import { createStore } from "zustand/vanilla";
import { renderReadOnlyCanvasText } from "@/wab/client/components/canvas/CanvasText";
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

it("preserves native text DOM and committed model inputs in the read-only canvas component", async () => {
  vi.useFakeTimers();
  vi.stubGlobal("requestAnimationFrame", (fn: FrameRequestCallback) => setTimeout(() => fn(performance.now()), 16));
  vi.stubGlobal("cancelAnimationFrame", clearTimeout);
  const lifetime = new AbortController();
  const frame = globalHookCtx.createFrameState({ uid: 409, objectPrototype: {} });
  const sub = Object.assign(mock<SubDeps>(), { React, ReactDOM, CanvasObserver, CanvasTextEditor, CanvasSlateChildren, CanvasStoreProjection });
  const models = new ModelSnapshots(), session = new CanvasSessionState(), owner = new CanvasRenderOwner(session);
  const selection = new ViewSelection(() => models), commits = new Set<(event: { type: "commit" }) => void>();
  const site = createSite();
  const base = mkBaseVariant(), node = mkTplInlinedText("First", [base]);
  const component = mkComponent({ name: "Rich text", type: ComponentType.Plain, variants: [base], tplTree: node }); site.components.push(component);
  const arenaFrame = mkArenaFrame({ site, component, name: "Text", width: 800, height: 600 });
  const variants = new ViewVariantState(() => models, () => arenaFrame, () => site, () => false, () => false);
  const view: ViewCtx = Object.create(ViewCtx.prototype);
  const fields = {
    _isDisposed: false, disposeSignal: lifetime.signal, canvasRenderOwner: owner,
    site, component, selectionStore: selection.store, variantStore: variants.store,
    currentComponent: () => component, valComponentStack: () => [], componentStackFrames: () => [], showDefaultSlotContents: () => false,
    frameState: frame, arenaFrame: () => ({ uid: 409 }),
    canvasObservers: new Set(), uncommittedCanvasObservers: new Map(),
    canvasErrorObservers: new Set(), _canvasRerenderQueue: new Set(),
    canvasCtx: { Sub: sub }, syncQueue: { idle: () => true },
    studioCtx: { modelSnapshots: models, hasPendingModelChanges: () => false,
      draggingObjectStore: createStore(() => false),
      subscribeModelChanges: (listener: (event: { type: "commit" }) => void) => { commits.add(listener); return () => commits.delete(listener); } },
    updateCtxPostChange: vi.fn(),
  };
  Object.defineProperties(view, Object.fromEntries(
    Object.entries(fields).map(([key, value]) => [key, { value, configurable: true, writable: true }]),
  ));
  const raw = ensureKnownRawText(node.vsettings[0].text);
  const recorder = new ChangeRecorder({ inst: component, _instUtil: instUtil });
  const effectiveVs = new EffectiveVariantSetting(node, node.vsettings);
  const ctx = Object.assign(mock<RenderingCtx>(), { sub, viewCtx: view, site, ownersStack: [], valKey: node.uuid, ownerComponent: component, env: Object.assign(mock<CanvasEnv>(), { $ctx: {} }) });
  const detached = vi.spyOn(view, "disposeCanvasObserver");
  const mounted = render(<React.StrictMode>{renderReadOnlyCanvasText({ node, inline: true, ctx, effectiveVs })}</React.StrictMode>);
  try {
    const root = ensure(mounted.container.firstElementChild, "Read-only text root");
    expect(root.textContent).toBe("First");
    expect(view.canvasObservers.size).toBe(1);
    mounted.rerender(<React.StrictMode>{renderReadOnlyCanvasText({ node, inline: true, ctx, effectiveVs })}</React.StrictMode>);
    expect(mounted.container.firstElementChild).toBe(root);
    await act(async () => {
      const changed = recorder.withRecording(() => { raw.text = "Model update"; });
      models.sync(changed.changes); commits.forEach((listener) => listener({ type: "commit" }));
      view.flushRerenderQueue();
    });
    expect(mounted.container.firstElementChild).toBe(root);
    expect(root.textContent).toBe("Model update");
    mounted.unmount();
    expect(view.canvasObservers.size).toBe(0);
    expect(detached).toHaveBeenCalled();
    expect(detached.mock.calls.every(([reaction]) => reaction.isDisposed)).toBe(true);
  } finally { mounted.unmount(); lifetime.abort(); owner.dispose(); session.dispose(); selection.dispose(); variants.dispose(); models.dispose(); recorder.dispose(); }
});
