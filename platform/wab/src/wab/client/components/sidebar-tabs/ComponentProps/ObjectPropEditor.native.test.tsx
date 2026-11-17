import paintStyles from "@/wab/client/components/style-controls/PaintRows.module.scss";
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
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
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

vi.mock("@/wab/client/components/sidebar/PopoverFrame", () => ({
  PopoverFrame: ({ show, onClose }: { show: boolean; onClose: () => void }) =>
    show ? <button onClick={onClose}>Close editor</button> : null,
}));

it("uses Design row styles and keeps the edit highlight until the item editor closes", () => {
  const context = { componentPropValues: {}, ccContextData: {}, paramOwnerNames: [], env: undefined,
    exprCtx: { component: null, projectFlags: DEVFLAGS, inStudio: true } };
  const props = {
    compositeValue: { name: "First" }, evaluatedValue: { name: "First" },
    fields: { name: "string" as const }, propType: { type: "object" as const, fields: { name: "string" as const } },
    objectNameFunc: () => "First", modalKey: "items", ccContextData: {}, componentPropValues: {},
    controlExtras: { path: ["items", 0] }, onChange: vi.fn(), onClose: vi.fn(), listItem: true,
  };
  const editor = (disabled = false) => <PropValueEditorContext.Provider value={context}>
    <ObjectPropEditor {...props} disabled={disabled} />
  </PropValueEditorContext.Provider>;
  const { rerender } = render(editor());
  const button = screen.getByRole("button", { name: "First" });
  expect(button.classList.contains(paintStyles.fillEdit)).toBe(true);
  expect(button.parentElement?.classList.contains(paintStyles.fillValue)).toBe(true);
  expect(button.getAttribute("aria-expanded")).toBe("false");
  fireEvent.click(button);
  expect(button.getAttribute("aria-expanded")).toBe("true");
  fireEvent.click(screen.getByRole("button", { name: "Close editor" }));
  expect(props.onClose).toHaveBeenCalledOnce();
  expect(button.getAttribute("aria-expanded")).toBe("false");
  rerender(editor(true));
  expect(button.hasAttribute("disabled")).toBe(true);
  fireEvent.click(button);
  expect(button.getAttribute("aria-expanded")).toBe("false");
});
