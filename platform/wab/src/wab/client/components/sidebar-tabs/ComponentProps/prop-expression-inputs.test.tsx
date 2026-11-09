import { usePropExpressionValue } from "@/wab/client/components/sidebar-tabs/ComponentProps/prop-expression-inputs";
import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { ModelSnapshots } from "@/wab/client/studio-ctx/model-snapshots";
import { codeLit } from "@/wab/shared/core/exprs";
import { ChangeRecorder } from "@/wab/shared/core/observable-model";
import { createSite } from "@/wab/shared/core/sites";
import { instUtil } from "@/wab/shared/model/InstUtil";
import { ensureKnownCustomCode } from "@/wab/shared/model/classes";
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
