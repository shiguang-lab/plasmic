import { ObjectPropEditor } from "@/wab/client/components/sidebar-tabs/ComponentProps/ObjectPropEditor";
import type { PropValueEditorContextData } from "@/wab/client/components/sidebar-tabs/PropEditorRow";
import { PropValueEditorContext } from "@/wab/client/components/sidebar-tabs/PropEditorRow";
import { StudioCtxContext } from "@/wab/client/contexts/StudioContexts";
import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { ModelSnapshots } from "@/wab/client/studio-ctx/model-snapshots";
import { TplMgr } from "@/wab/shared/TplMgr";
import { ComponentType } from "@/wab/shared/core/components";
import { ChangeRecorder } from "@/wab/shared/core/observable-model";
import { createSite } from "@/wab/shared/core/sites";
import { CustomCode } from "@/wab/shared/model/classes";
import { instUtil } from "@/wab/shared/model/InstUtil";
import { DEVFLAGS } from "@/wab/shared/devflags";
import { act, cleanup, render, screen } from "@testing-library/react";
import * as React from "react";

vi.mock("@/wab/client/components/sidebar-tabs/PropEditorRow", async () => {
  const ReactModule = await import("react");
  const context = ReactModule.createContext<PropValueEditorContextData>({ componentPropValues: {}, ccContextData: {}, paramOwnerNames: [], env: undefined });
  return {
    PropValueEditorContext: context,
    usePropValueEditorContext: () => ReactModule.useContext(context),
    isPropShown: () => true,
    InnerPropEditorRow: ({ definedIndicator }: { definedIndicator: { source: string; value?: string } }) => <output>{definedIndicator.value}</output>,
  };
});
afterEach(cleanup);
it("refreshes nested model-expression summaries without replacing command values", () => {
  const site = createSite(), manager = new TplMgr({ site });
  const component = manager.addComponent({ type: ComponentType.Plain, name: "Object value" });
  const code = new CustomCode({ code: "(firstValue)", fallback: undefined });
  // Register the expression through a real persisted model field so the recorder
  // admits its edits; the composite editor value keeps this same Expr identity.
  const group = manager.createVariantGroup({ component, name: "Mode" });
  group.param.defaultExpr = code;
  const models = new ModelSnapshots(), lifetime = new AbortController();
  const recorder = new ChangeRecorder({ inst: site, _instUtil: instUtil });
  const studio = { site, modelSnapshots: models, arenaState: { lifetime: () => lifetime.signal } } as unknown as StudioCtx;
  const compositeValue = { field: code }, change = vi.fn();
  const context = { componentPropValues: {}, ccContextData: {}, paramOwnerNames: [], env: undefined, exprCtx: { component, projectFlags: DEVFLAGS, inStudio: true } };
  const mounted = render(<StudioCtxContext.Provider value={studio}><PropValueEditorContext.Provider value={context}><ObjectPropEditor compositeValue={compositeValue} evaluatedValue={{ field: "value" }} fields={{ field: "string" }} propType={{ type: "object", fields: { field: "string" } }} display="inline" modalKey="object" ccContextData={{}} onChange={change} componentPropValues={{}} controlExtras={{ path: ["object"] }} /></PropValueEditorContext.Provider></StudioCtxContext.Provider>);
  try {
    expect(screen.getByRole("status").textContent).toBe("firstValue");
    act(() => models.sync(recorder.withRecording(() => { code.code = "(secondValue)"; }).changes));
    expect(screen.getByRole("status").textContent).toBe("secondValue");
    expect(compositeValue.field).toBe(code);
    act(() => lifetime.abort());
    expect(mounted.container.textContent).toBe("");
  } finally { mounted.unmount(); recorder.dispose(); models.dispose(); }
});
