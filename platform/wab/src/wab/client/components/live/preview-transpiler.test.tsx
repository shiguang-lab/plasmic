import { createTranspiler } from "@/wab/client/components/live/preview-transpiler";
import { ensure } from "@/wab/shared/common";
import { createStateEventHandler } from "@plasmicapp/react-web";
import { cleanup as cleanupReact, render, screen } from "@testing-library/react";
import * as React from "react";
import * as compilerRuntime from "react/compiler-runtime";

afterEach(cleanupReact);

async function compile(source: string, imports: Record<string, unknown> = {}) {
  const module = await createTranspiler()({ name: "./row-actions.tsx", lang: "tsx", source });
  if (module.type !== "code") {throw new Error("Expected code module");}
  expect(module.code).toContain("react/compiler-runtime");
  expect(module.code).toContain("finally");
  const exports: Record<string, any> = {};
  new Function("require", "exports", "module", module.code)((name: string) => {
    if (name === "react") {return React;}
    if (name === "react/compiler-runtime") {return compilerRuntime;}
    if (name === "@plasmicapp/react-web") {return { createStateEventHandler };}
    if (Object.hasOwn(imports, name)) {return imports[name];}
    throw new Error(`Unexpected Preview import ${name}`);
  }, exports, { exports });
  return exports;
}

const rowSource = `import React from "react";
import {createStateEventHandler} from "@plasmicapp/react-web";
import {ActionButton} from "row-action-library";
export function RowActions({$state,request,cleanup}) {
  return <ActionButton disabled={$state.rowActionBusy} onClick={createStateEventHandler(
    () => [$state], ($state) => async () => {
      if ($state.rowActionBusy) return;
      $state.rowActionBusy = true;
      try {
        const viewer = JSON.parse(localStorage.getItem("req018.viewer") || "null");
        const records = JSON.parse(localStorage.getItem("req018.coupons") || "[]");
        const record = records.find(item => item.id === $state.pendingId);
        if (!record || viewer?.role !== "operator" || record.status !== "已上线") return "denied";
        const result = await request(record, $state.pendingAction);
        record.status = "已下线";
        localStorage.setItem("req018.coupons", JSON.stringify(records));
        return result;
      } catch (error) {
        $state.error = error.message;
        throw error;
      } finally {
        $state.rowActionBusy = false;
        await cleanup();
      }
    }
  )}>下线</ActionButton>;
}
`;

// Capture handlers outside React's DOM dispatch so rejected promises can be
// asserted directly, without turning expected request failures into page errors.
async function rowAction({ role = "operator", stored = "valid" } = {}) {
  localStorage.clear();
  localStorage.setItem("req018.viewer", JSON.stringify({ id: "operator-1", role }));
  localStorage.setItem("req018.coupons", stored === "valid" ? JSON.stringify([{ id: "coupon-1", status: "已上线" }]) : "invalid json");
  let handler: (() => Promise<unknown>) | undefined;
  const { RowActions } = await compile(rowSource, { "row-action-library": {
    ActionButton: (props: React.ButtonHTMLAttributes<HTMLButtonElement>) => {
      handler = props.onClick as unknown as typeof handler;
      return React.createElement("button", props);
    },
  } });
  const request = vi.fn(), cleanup = vi.fn();
  const state = { rowActionBusy: false, pendingId: "coupon-1", pendingAction: "offline", error: "" };
  render(<RowActions $state={state} request={request} cleanup={cleanup} />);
  expect((screen.getByRole("button", { name: "下线" }) as HTMLButtonElement).disabled).toBe(false);
  return { run: ensure(handler, "Compiled row action"), state, request, cleanup };
}

it("compiles an async row action and clears busy only after the request settles", async () => {
  const action = await rowAction();
  let resolve: ((value: string) => void) | undefined;
  action.request.mockImplementation(() => new Promise<string>(done => { resolve = done; }));
  const pending = action.run();
  expect(action.state.rowActionBusy).toBe(true);
  expect(action.request).toHaveBeenCalledExactlyOnceWith({ id: "coupon-1", status: "已上线" }, "offline");
  expect(action.cleanup).not.toHaveBeenCalled();
  ensure(resolve, "Request started")("done");
  await expect(pending).resolves.toBe("done");
  expect(action.state.rowActionBusy).toBe(false);
  expect(action.cleanup).toHaveBeenCalledOnce();
  expect(JSON.parse(ensure(localStorage.getItem("req018.coupons"), "Stored coupons"))[0].status).toBe("已下线");
});

it("runs finally on validation's early return without sending a request", async () => {
  const action = await rowAction({ role: "reviewer" });
  await expect(action.run()).resolves.toBe("denied");
  expect(action.request).not.toHaveBeenCalled();
  expect(action.state.rowActionBusy).toBe(false);
  expect(action.cleanup).toHaveBeenCalledOnce();
});

it.each(["request", "parse"])("preserves %s failures and clears busy exactly once", async (kind) => {
  const action = await rowAction({ stored: kind === "parse" ? "invalid" : "valid" });
  const failure = new Error("request failed");
  action.request.mockRejectedValue(failure);
  const pending = action.run();
  if (kind === "request") {await expect(pending).rejects.toBe(failure);}
  else {await expect(pending).rejects.toBeInstanceOf(SyntaxError);}
  expect(action.state.error).toBeTruthy();
  expect(action.state.rowActionBusy).toBe(false);
  expect(action.cleanup).toHaveBeenCalledOnce();
});

it("preserves a failure thrown by finally instead of returning the request result", async () => {
  const action = await rowAction();
  action.request.mockResolvedValue("done");
  const failure = new Error("cleanup failed");
  action.cleanup.mockRejectedValue(failure);
  await expect(action.run()).rejects.toBe(failure);
  expect(action.state.rowActionBusy).toBe(false);
  expect(action.cleanup).toHaveBeenCalledOnce();
});
