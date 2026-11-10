import { useVariantsController } from "@/wab/client/studio-ctx/variant-controller-inputs";
import { ModelSnapshots } from "@/wab/client/studio-ctx/model-snapshots";
import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import type { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { TplMgr } from "@/wab/shared/TplMgr";
import { mkArenaFrame } from "@/wab/shared/Arenas";
import { mkVariant } from "@/wab/shared/Variants";
import { ComponentType } from "@/wab/shared/core/components";
import { ChangeRecorder } from "@/wab/shared/core/observable-model";
import { createSite } from "@/wab/shared/core/sites";
import { instUtil } from "@/wab/shared/model/InstUtil";
import { toVarName } from "@/wab/shared/codegen/util";
import { createStore } from "zustand/vanilla";
import { act, renderHook } from "@testing-library/react";

it("invalidates evaluated pins for group contracts and rendered props while ignoring unrelated model styles", () => {
  const site = createSite(), models = new ModelSnapshots(), lifetime = new AbortController();
  const manager = new TplMgr({ site }), component = manager.addComponent({ name: "Owner", type: ComponentType.Plain });
  const group = manager.createVariantGroup({ component, name: "Mode" });
  const variant = mkVariant({ name: "Active", parent: group }); group.variants = [variant];
  const frame = mkArenaFrame({ site, component, name: "Owner", width: 800, height: 600 });
  const studio = { site, modelSnapshots: models, focusedMode: false, currentArena: null,
    selectionStore: createStore(() => ({ view: undefined, frames: [] })),
    arenaState: { lifetime: () => lifetime.signal, store: createStore(() => ({ current: null, focusedMode: false })), viewRegistry: { store: createStore(() => []) } },
    subscribeModelChanges: () => () => {},
  } as unknown as StudioCtx;
  const props: Record<string, string> = { [toVarName(group.param.variable.name)]: toVarName(variant.name) };
  const val = { tpl: { component }, fibers: [{ memoizedProps: props }] };
  const renderStatusStore = createStore(() => ({ renderCount: 0 }));
  const variantStore = createStore(() => ({ frames: [{}], global: {} }));
  const hasVariant = vi.fn((values: Record<string, unknown>, name: string, value: string) => values[name] === value);
  const view = { studioCtx: studio, site, modelLifetime: lifetime.signal, disposeSignal: lifetime.signal, isDisposed: false,
    variantStore, csEvaluator: { renderStatusStore }, currentComponent: () => component, arenaFrame: () => frame,
    currentComponentStackFrame: () => ({ tplComponent: { component }, getTargetVariants: () => [], getPinnedVariants: () => new Map() }),
    globalFrame: { site, getTargetVariants: () => [], getPinnedVariants: () => new Map() },
    valState: () => ({ maybeValSysRoot: () => val }), valComponentStack: () => [val], canvasCtx: { Sub: { reactWeb: { hasVariant } } },
  } as unknown as ViewCtx;
  const recorder = new ChangeRecorder({ inst: site, _instUtil: instUtil });
  const hook = renderHook(() => useVariantsController(studio, view));
  const edit = (run: () => void) => act(() => models.sync(recorder.withRecording(run).changes));
  try {
    expect(hook.result.current?.variants[variant.uid]?.active).toBe(true);
    edit(() => { group.param.variable.name = "ChangedMode"; });
    expect(hook.result.current?.variants[variant.uid]?.active).toBe(false);
    props[toVarName(group.param.variable.name)] = toVarName(variant.name);
    act(() => renderStatusStore.setState({ renderCount: 1 }));
    expect(hook.result.current?.variants[variant.uid]?.active).toBe(true);
    const before = hook.result.current; hasVariant.mockClear();
    edit(() => { component.tplTree.vsettings[0].rs.values.color = "red"; });
    expect(hook.result.current).toBe(before); expect(hasVariant).not.toHaveBeenCalled();
    const commands = hook.result.current?.commands;
    const snapshot = commands?.getSnapshot([variant]);
    expect(snapshot?.variants[0]).toMatchObject({ pinState: commands?.getPinState(variant), active: commands?.isActive(variant), targeted: commands?.isTargeted(variant), canToggle: commands?.canToggleTargeting(variant) });
  } finally { hook.unmount(); lifetime.abort(); recorder.dispose(); models.dispose(); }
});
