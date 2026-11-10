import { usePropExpressionInputs, usePropExpressionValue } from "@/wab/client/components/sidebar-tabs/ComponentProps/prop-expression-inputs";
import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { ModelSnapshots } from "@/wab/client/studio-ctx/model-snapshots";
import { codeLit } from "@/wab/shared/core/exprs";
import { ChangeRecorder } from "@/wab/shared/core/observable-model";
import { createSite } from "@/wab/shared/core/sites";
import { instUtil } from "@/wab/shared/model/InstUtil";
import { ensureKnownCustomCode } from "@/wab/shared/model/classes";
import { ComponentDataQuery } from "@/wab/shared/model/classes";
import { mkComponent, ComponentType } from "@/wab/shared/core/components";
import { mkTplTagX } from "@/wab/shared/core/tpls";
import { act, renderHook } from "@testing-library/react";

it("publishes in-place expression edits and stops reading a retired model", () => {
  const site = createSite(), models = new ModelSnapshots(), lifetime = new AbortController();
  const expr = ensureKnownCustomCode(codeLit("First"));
  const recorder = new ChangeRecorder({ inst: expr, _instUtil: instUtil });
  const studio = { site, modelSnapshots: models, arenaState: { lifetime: () => lifetime.signal } } as unknown as StudioCtx;
  const select = vi.fn(() => expr.code);
  const hook = renderHook(() => usePropExpressionValue(studio, expr, expr, undefined, select));
  try {
    expect(hook.result.current).toBe('"First"');
    act(() => models.sync(recorder.withRecording(() => { expr.code = '"Updated"'; }).changes));
    expect(hook.result.current).toBe('"Updated"');
    act(() => lifetime.abort());
    expect(hook.result.current).toBeUndefined();
    select.mockClear();
    hook.rerender();
    expect(select).not.toHaveBeenCalled();
  } finally { hook.unmount(); recorder.dispose(); models.dispose(); }
});

it("shares query rosters while following additions, replacement, edits and selected component changes", () => {
  const site = createSite(), models = new ModelSnapshots(), lifetime = new AbortController();
  const first = mkComponent({ name: "First", type: ComponentType.Plain, tplTree: mkTplTagX("div") });
  const second = mkComponent({ name: "Second", type: ComponentType.Plain, tplTree: mkTplTagX("div") });
  const query = (name: string) => new ComponentDataQuery({ uuid: name, name, op: undefined });
  first.dataQueries.push(query("One")); second.dataQueries.push(query("Other")); site.components.push(first, second);
  const recorder = new ChangeRecorder({ inst: site, _instUtil: instUtil });
  const studio = { site, modelSnapshots: models, arenaState: { lifetime: () => lifetime.signal } } as unknown as StudioCtx;
  const originalRoster = first.dataQueries;
  const retained = renderHook(() => usePropExpressionValue(studio, first, originalRoster, first, () => first.dataQueries.map((item) => item.name)));
  const retainedInputs = renderHook(() => usePropExpressionInputs(studio, first, originalRoster, first));
  const liveInputs = renderHook(() => usePropExpressionInputs(studio, first, first.dataQueries, first));
  const hook = renderHook(({ component }) => {
    usePropExpressionInputs(studio, component, component.dataQueries, component);
    return usePropExpressionValue(studio, component, component.dataQueries, component, () => component.dataQueries.map((item) => item.name));
  }, { initialProps: { component: first } });
  const edit = (run: () => void) => act(() => models.sync(recorder.withRecording(run).changes));
  try {
    expect(hook.result.current).toEqual(["One"]);
    edit(() => { first.dataQueries.push(query("Two")); });
    expect(hook.result.current).toEqual(["One", "Two"]);
    edit(() => { first.dataQueries[1].name = "Updated"; });
    expect(hook.result.current).toEqual(["One", "Updated"]);
    edit(() => { first.dataQueries = [query("Replacement")]; });
    expect(hook.result.current).toEqual(["Replacement"]);
    expect(retained.result.current).toEqual(["Replacement"]);
    expect(retainedInputs.result.current).toBe(liveInputs.result.current);
    edit(() => { first.dataQueries[0].name = "Replacement updated"; });
    expect(retained.result.current).toEqual(["Replacement updated"]);
    hook.rerender({ component: second });
    expect(hook.result.current).toEqual(["Other"]);
    edit(() => { first.dataQueries[0].name = "Old selection changed"; });
    expect(hook.result.current).toEqual(["Other"]);
    edit(() => { second.dataQueries.splice(0, 1); });
    expect(hook.result.current).toEqual([]);
  } finally { hook.unmount(); retained.unmount(); retainedInputs.unmount(); liveInputs.unmount(); lifetime.abort(); recorder.dispose(); models.dispose(); }
});
