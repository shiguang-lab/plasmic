import { setupComponentWithTplTree } from "@/wab/client/operations/__testonly__/utils";
import { createComponent } from "@/wab/client/operations/create-component";
import { unwrap } from "@/wab/commons/neverthrow-utils";
import { ComponentType } from "@/wab/shared/core/components";
import { codeLit, tryExtractJson } from "@/wab/shared/core/exprs";
import * as Tpls from "@/wab/shared/core/tpls";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { vi } from "vitest";
import { VariableEditingModal } from "./VariableEditingModal";
vi.mock("@/wab/client/components/sidebar/SidebarModal", () => ({ SidebarModal: ({ children }: any) => <div>{children}</div> }));
vi.mock("./VariableEditingForm", () => ({ default: ({ state, onDraftChange, onConfirm, onCancel }: any) => <div>
  <span>{state.param.variable.name}</span>
  <button onClick={() => onDraftChange({ name: "count", variableType: "number", initialValue: codeLit(5), accessType: "writable" })}>draft</button>
  <button onClick={onConfirm}>confirm</button><button onClick={onCancel}>cancel</button>
</div> }));
function setup() {
  const { site, tplMgr } = setupComponentWithTplTree(Tpls.mkTplTagX("div", {}));
  const component = unwrap(createComponent({ tplMgr, name: "DraftTest", type: ComponentType.Plain }));
  const change = vi.fn(async (fn) => fn());
  const close = vi.fn();
  const props = { show: true, mode: "new" as const, component, studioCtx: { site, tplMgr: () => tplMgr, change } as any, viewCtx: {} as any, onClose: close };
  return { component, change, close, props };
}
it("opening, editing and cancelling a draft never touch the model or undo transactions", () => {
  const { component, props, change, close } = setup();
  const before = [...component.params];
  const view = render(<VariableEditingModal {...props} />);
  fireEvent.click(screen.getByText("draft"));
  expect(screen.getByText("count")).toBeTruthy();
  expect(component.states).toHaveLength(0);
  expect(component.params).toEqual(before);
  fireEvent.click(screen.getByText("cancel"));
  expect(close).toHaveBeenCalledOnce();
  view.unmount();
  expect(change).not.toHaveBeenCalled();
  expect(component.states).toHaveLength(0);
});
it("confirmation adds the entire configured state in one transaction", async () => {
  const { component, props, change, close } = setup();
  render(<VariableEditingModal {...props} />);
  fireEvent.click(screen.getByText("draft"));
  fireEvent.click(screen.getByText("confirm"));
  await waitFor(() => expect(close).toHaveBeenCalledOnce());
  expect(change).toHaveBeenCalledOnce();
  expect(component.states).toHaveLength(1);
  const state = component.states[0];
  expect(state.param.variable.name).toBe("count");
  expect(state.variableType).toBe("number");
  expect(state.accessType).toBe("writable");
  expect(tryExtractJson(state.param.defaultExpr!)).toBe(5);
});
