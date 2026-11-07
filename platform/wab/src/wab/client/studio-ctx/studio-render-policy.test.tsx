import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { mock } from "vitest-mock-extended";
import { StudioRenderPolicy, subscribeStudioRenderPolicy } from "@/wab/client/studio-ctx/studio-render-policy";
import { describe, expect, it, vi } from "vitest";

describe("StudioRenderPolicy publication", () => {
  it("installs the effective snapshot before existing sources publish, then releases all prepared outputs", () => {
    let live = false, dragging = false;
    const policy = new StudioRenderPolicy({ isLive: () => live, isDragging: () => dragging });
    const selected = vi.fn();
    const studio = mock<StudioCtx>();
    Object.defineProperty(studio, "renderPolicy", { value: policy });
    const stopSelected = subscribeStudioRenderPolicy(studio, (state) => state.autoOpen, selected);
    const output = { cachedAutoOpen: true, cachedDevMode: true };
    const reads: unknown[] = [];
    policy.store.subscribe((snapshot) => reads.push([snapshot, { ...output }]));
    const publish = vi.fn(() => reads.push([policy.store.getState(), { ...output }]));
    policy.deferPublication(() => {
      const snapshot = policy.prepareInputs({ draggingOverride: true, liveOverride: true });
      output.cachedAutoOpen = snapshot.autoOpen;
      output.cachedDevMode = snapshot.devMode;
      policy.queuePublication(publish);
      dragging = true; live = true;
      expect(policy.autoOpen).toBe(false);
      expect(policy.devMode).toBe(false);
      expect(policy.store.getState()).toBe(snapshot);
      expect(reads).toEqual([]);
    });
    expect(publish).toHaveBeenCalledOnce();
    expect(selected).toHaveBeenCalledExactlyOnceWith(false, true);
    stopSelected();
    expect(reads).toEqual([
      [policy.store.getState(), { cachedAutoOpen: false, cachedDevMode: false }],
      [policy.store.getState(), { cachedAutoOpen: false, cachedDevMode: false }],
    ]);
    policy.dispose();
  });

  it("retains preference semantics across overrides and suppresses final equal outputs", () => {
    const policy = new StudioRenderPolicy({ isLive: () => false, isDragging: () => false });
    const changed = vi.fn(); policy.store.subscribe(changed);
    const original = policy.store.getState();
    policy.deferPublication(() => {
      policy.setFullPageHeightOverride(true); policy.prepareInputs();
      policy.deferPublication(() => { policy.setFullPageHeightOverride(false); policy.prepareInputs(); });
    });
    expect(policy.store.getState()).toBe(original);
    expect(changed).not.toHaveBeenCalled();
    policy.deferPublication(() => {
      policy.installStoredFullPageHeight(true);
      policy.setFullPageHeightOverride(false);
      policy.prepareInputs();
    });
    // Installing a preference retains the existing session override.
    policy.deferPublication(() => { policy.installStoredFullPageHeight(false); policy.prepareInputs(); });
    expect(policy.fullPageHeight).toBe(false);
    policy.deferPublication(() => { expect(policy.toggleFullPageHeight()).toBe(true); policy.prepareInputs(); });
    expect(policy.fullPageHeight).toBe(true);
    policy.deferPublication(() => { policy.setFullPageHeightOverride(false); policy.prepareInputs(); });
    expect(policy.fullPageHeight).toBe(false);
    policy.deferPublication(() => { policy.setFullPageHeightOverride(true); policy.prepareInputs(); });
    expect(policy.fullPageHeight).toBe(true);
    policy.dispose();
  });

  it("seals UI and releases pending publishers on disposal while commands read their current values", () => {
    let live = true;
    const policy = new StudioRenderPolicy({ isLive: () => live, isDragging: () => false });
    expect(policy.store.getInitialState().devMode).toBe(false);
    const terminal = policy.store.getState();
    const changed = vi.fn(), prepared = vi.fn();
    policy.store.subscribe(changed);
    policy.deferPublication(() => {
      policy.queuePublication(prepared);
      policy.dispose();
      live = false; policy.docs = true; policy.interactive = true;
      policy.prepareInputs();
    });
    policy.store.subscribe(changed);
    policy.publishCommit();
    expect(policy.store.getState()).toBe(terminal);
    expect(changed).not.toHaveBeenCalled(); expect(prepared).not.toHaveBeenCalled();
    expect(policy.interactive).toBe(true); expect(policy.devMode).toBe(false);
    policy.docs = false; expect(policy.devMode).toBe(true);
  });
});
