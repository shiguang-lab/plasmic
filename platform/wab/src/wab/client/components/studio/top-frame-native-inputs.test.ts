import { observeTopFramePrimitiveValues } from "@/wab/client/components/studio/TopFrameObserver";
import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { ModelSnapshots } from "@/wab/client/studio-ctx/model-snapshots";
import { ChangeRecorder } from "@/wab/shared/core/observable-model";
import { createSite } from "@/wab/shared/core/sites";
import { instUtil } from "@/wab/shared/model/InstUtil";
import { createStore } from "zustand/vanilla";

it("publishes admitted host primitives and releases field leases on retirement", () => {
  const site = createSite();
  const models = new ModelSnapshots();
  const recorder = new ChangeRecorder({ inst: site, _instUtil: instUtil });
  const lifetime = new AbortController();
  const versionListeners = new Set<() => void>();
  const flags = models.field(site, "flags");
  const role = models.field(site, "defaultPageRoleId");
  const stopFlags = vi.fn();
  const stopRole = vi.fn();
  const subscribeFlags = flags.subscribe.bind(flags);
  const subscribeRole = role.subscribe.bind(role);
  vi.spyOn(flags, "subscribe").mockImplementation((listener) => {
    const stop = subscribeFlags(listener);
    return () => { stopFlags(); stop(); };
  });
  vi.spyOn(role, "subscribe").mockImplementation((listener) => {
    const stop = subscribeRole(listener);
    return () => { stopRole(); stop(); };
  });
  let revisionNum = 3;
  const studio = {
    site, modelSnapshots: models, get revisionNum() { return revisionNum; },
    arenaState: { lifetime: () => lifetime.signal, readinessStore: createStore(() => true) },
    dbCtx: () => ({ subscribeVersionInputs: (listener: () => void) => {
      versionListeners.add(listener); return () => { versionListeners.delete(listener); };
    } }),
    subscribeModelChanges: () => () => undefined,
  } as unknown as StudioCtx;
  const publish = vi.fn();
  const stop = observeTopFramePrimitiveValues(studio, publish);
  try {
    expect(publish).toHaveBeenLastCalledWith({ revisionNum: 3, isLocalizationEnabled: false, defaultPageRoleId: site.defaultPageRoleId, localizationScheme: undefined });
    models.sync(recorder.withRecording(() => { site.flags.usePlasmicTranslation = true; site.defaultPageRoleId = "role-1"; }).changes);
    expect(publish).toHaveBeenLastCalledWith(expect.objectContaining({ isLocalizationEnabled: true, defaultPageRoleId: "role-1" }));
    publish.mockClear();
    models.sync(recorder.withRecording(() => { site.flags.unrelatedFlag = true; }).changes);
    expect(publish).not.toHaveBeenCalled();
    revisionNum = 4;
    versionListeners.forEach((listener) => listener());
    expect(publish).toHaveBeenLastCalledWith(expect.objectContaining({ revisionNum: 4 }));
    publish.mockClear();
    lifetime.abort();
    expect(stopFlags).toHaveBeenCalledOnce();
    expect(stopRole).toHaveBeenCalledOnce();
    models.sync(recorder.withRecording(() => { site.defaultPageRoleId = "retired-role"; }).changes);
    versionListeners.forEach((listener) => listener());
    expect(publish).not.toHaveBeenCalled();
  } finally {
    stop(); recorder.dispose(); models.dispose();
  }
  expect(versionListeners.size).toBe(0);
});
