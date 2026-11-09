import { useComponentParamInputs } from "@/wab/client/components/sidebar-tabs/ComponentProps/component-param-inputs";
import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { ModelSnapshots } from "@/wab/client/studio-ctx/model-snapshots";
import { TplMgr } from "@/wab/shared/TplMgr";
import { ComponentType } from "@/wab/shared/core/components";
import { mkParam } from "@/wab/shared/core/lang";
import { ChangeRecorder } from "@/wab/shared/core/observable-model";
import { createSite } from "@/wab/shared/core/sites";
import { codeLit } from "@/wab/shared/core/exprs";
import { ensureKnownCustomCode, ensureKnownTplTag } from "@/wab/shared/model/classes";
import { instUtil } from "@/wab/shared/model/InstUtil";
import { typeFactory } from "@/wab/shared/model/model-util";
import { act, renderHook } from "@testing-library/react";

it("tracks prop membership, labels, types and default expression edits without subscribing to component contents", () => {
  const site = createSite(), manager = new TplMgr({ site });
  const component = manager.addComponent({ type: ComponentType.Plain, name: "Definitions" });
  const param = mkParam({ name: "original", type: typeFactory.text(), paramType: "prop", defaultExpr: codeLit("First") }); component.params.push(param);
  const models = new ModelSnapshots(), lifetime = new AbortController(), recorder = new ChangeRecorder({ inst: site, _instUtil: instUtil });
  const studio = { site, modelSnapshots: models, arenaState: { lifetime: () => lifetime.signal } } as unknown as StudioCtx;
  const hook = renderHook(() => { useComponentParamInputs(studio, component); return component.params.map((value) => `${value.variable.name}:${value.type.name}:${ensureKnownCustomCode(value.defaultExpr).code}`); });
  try {
    const before = hook.result.current;
    act(() => models.sync(recorder.withRecording(() => { ensureKnownTplTag(component.tplTree).name = "Canvas change"; }).changes));
    expect(hook.result.current).toBe(before);
    act(() => models.sync(recorder.withRecording(() => { param.variable.name = "renamed"; ensureKnownCustomCode(param.defaultExpr).code = '"Second"'; }).changes));
    expect(hook.result.current[0]).toContain("renamed:text:"); expect(hook.result.current[0]).toContain("Second");
    act(() => models.sync(recorder.withRecording(() => { component.params = []; }).changes));
    expect(hook.result.current).toEqual([]);
  } finally { hook.unmount(); recorder.dispose(); models.dispose(); }
});
