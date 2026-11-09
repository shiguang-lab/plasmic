import React from "react";
import * as compilerRuntime from "react/compiler-runtime";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { createTranspiler } from "../../../src/wab/client/components/live/preview-transpiler";
import { createLiveRuntime } from "../../../../live-frame/src/runtime";
import { lowerFunctionVars } from "../../../src/wab/shared/eval/lower-function-vars";
import { lowerConditionalTests } from "../../../src/wab/shared/eval/lower-conditional-tests";
import * as reactWeb from "@plasmicapp/react-web";

export async function runBrowserPreviewCompilerContract() {
  const transpile = createTranspiler();
  let opaqueRefCommits = 0;
  let rowHandler: (() => Promise<unknown>) | undefined;
  const ActionButton = (props: React.ButtonHTMLAttributes<HTMLButtonElement>) => {
    rowHandler = props.onClick as unknown as typeof rowHandler;
    return React.createElement("button", props);
  };
  const OpaqueRefLibrary = React.forwardRef<{ label: string }, { label: string }>(function OpaqueRefLibrary({ label }, ref) {
    React.useImperativeHandle(ref, () => { opaqueRefCommits++; return { label }; });
    return null;
  });
  const runtime = createLiveRuntime({ react: React, "react/compiler-runtime": compilerRuntime, "@plasmicapp/react-web": reactWeb, "opaque-ref-library": { OpaqueRefLibrary }, "row-action-library": { ActionButton } });
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  const render = (file: string, props = {}) => flushSync(() => root.render(React.createElement(runtime.require(file).default, props)));
  const source = `import React from "react";
    import {label} from "./label";
    export default function GeneratedCounter({prefix}: {prefix:string}) {
      const [count,setCount] = React.useState(0);
      return <button onClick={() => setCount(count+1)}>{prefix}:{label}:{count}</button>;
    }`;
  const module = { name: "./root.tsx", lang: "tsx", source };
  const label = await transpile({ name: "./label.ts", lang: "ts", source: 'export const label: string = "First";' });
  const compiled = await transpile(module);
  if (compiled.type !== "code") { throw new Error("Generated source must compile to a code module"); }
  const errors: string[] = [];
  try {
    runtime.update([label, compiled]); render("./root.tsx", { prefix: "Original" });
    const button = container.querySelector("button");
    if (!button) { throw new Error("Compiled counter must mount in the browser renderer"); }
    flushSync(() => button.click());
    const incremented = button.textContent;
    const firstType = runtime.require("./root.tsx").default;
    const same = await transpile(module);
    runtime.update([same]); render("./root.tsx", { prefix: "Updated" });
    const retainedSameSource = runtime.require("./root.tsx").default === firstType && container.querySelector("button") === button;
    const retainedText = container.textContent;
    runtime.update([await transpile({ name: "./label.ts", lang: "ts", source: 'export const label: string = "Second";' })]);
    render("./root.tsx", { prefix: "Updated" });
    const evictedImporter = runtime.require("./root.tsx").default !== firstType;
    const dependencyEditText = container.textContent;
    const secondType = runtime.require("./root.tsx").default;
    runtime.update([await transpile({ ...module, source: source.replace("count+1", "count+2") })]);
    render("./root.tsx", { prefix: "Edited" });
    const evictedSource = runtime.require("./root.tsx").default !== secondType;
    const editedButton = container.querySelector("button");
    if (!editedButton) { throw new Error("Edited generated source must remount"); }
    flushSync(() => editedButton.click());
    const sourceEditText = container.textContent;

    const authoredExpression = lowerFunctionVars(`(function(){var before=typeof value;var read=()=>value+input;var value=3;var value;return [before,read(),read()];})()`);
    runtime.update([await transpile({name:"./authored-data.tsx",lang:"tsx",source:`import React from "react";export default function GeneratedAuthoredData({input}){const data=(${authoredExpression});return <output>{JSON.stringify(data)}</output>;}`} )]);
    render("./authored-data.tsx", {input:1});
    const authoredVarInitial = container.textContent;
    render("./authored-data.tsx", {input:2});
    const authoredVarUpdated = container.textContent;

    const conditional = lowerConditionalTests('($state.selectedReview || {}).updatedAt + ((($state.selectedReview || {}).submitAt === ($state.selectedReview || {}).updatedAt) ? "（未修改过）" : "（被用户修改过）")');
    runtime.update([await transpile({name:"./authored-conditional.tsx",lang:"tsx",source:`import React from "react";export default function GeneratedConditional({$state}){return <output>{${conditional}}</output>;}`} )]);
    render("./authored-conditional.tsx", {$state:{selectedReview:{submitAt:"first",updatedAt:"first"}}});
    const authoredConditionalInitial = container.textContent;
    render("./authored-conditional.tsx", {$state:{selectedReview:{submitAt:"first",updatedAt:"second"}}});
    const authoredConditionalUpdated = container.textContent;

    runtime.update([await transpile({name:"./ref-commands.tsx",lang:"tsx",source:`import React from "react";
      import {usePlasmicRefs,createStateEventHandler} from "@plasmicapp/react-web";
      import {OpaqueRefLibrary} from "opaque-ref-library";
      export default function GeneratedRefCommands({label,wait,onDone}){
        const {registerRef,getRefs}=usePlasmicRefs();
        return <><OpaqueRefLibrary label={label} ref={registerRef("target")}/><button onClick={createStateEventHandler(()=>[],()=>{
          const $refs=getRefs();
          return async()=>{const captured=$refs.target;await wait();onDone(captured.label,$refs.target.label);};
        })}>Read refs</button></>;
      }`} )]);
    let resumeRefs: (() => void) | undefined;
    const refWait = new Promise<void>((resolve) => { resumeRefs = resolve; });
    let refCommandResult: string[] = [];
    const refProps = { wait: () => refWait, onDone: (before: string, after: string) => { refCommandResult = [before, after]; } };
    render("./ref-commands.tsx", { ...refProps, label: "first" });
    const refButton = container.querySelector("button");
    if (!refButton) { throw new Error("Compiled refs owner must mount"); }
    flushSync(() => refButton.click());
    render("./ref-commands.tsx", { ...refProps, label: "second" });
    if (!resumeRefs) { throw new Error("Generated refs event must reach await"); }
    resumeRefs();
    await refWait;
    await Promise.resolve();

    runtime.update([await transpile({ name: "./coupon-actions.tsx", lang: "tsx", source: `import React from "react";
      import {createStateEventHandler} from "@plasmicapp/react-web";
      import {ActionButton} from "row-action-library";
      export default function CouponActions({$state,request,cleanup}) {
        return <ActionButton onClick={createStateEventHandler(()=>[$state],$state=>async()=>{
          if($state.rowActionBusy)return;
          $state.rowActionBusy=true;
          try {
            if(!$state.pendingId)return "denied";
            return await request();
          } catch(error) { $state.error=error.message; throw error; }
          finally { $state.rowActionBusy=false; cleanup(); }
        })}>下线</ActionButton>;
      }` })]);
    let finishRow: ((value: string) => void) | undefined;
    const rowRequest = new Promise<string>(resolve => { finishRow = resolve; });
    const rowState = { rowActionBusy: false, pendingId: "coupon-1", error: "" };
    let requests = 0, cleanups = 0, rejectRow = false;
    render("./coupon-actions.tsx", { $state: rowState,
      request: () => { requests++; return rejectRow ? Promise.reject(new Error("request failed")) : rowRequest; },
      cleanup: () => { cleanups++; },
    });
    if (!rowHandler || !finishRow) {throw new Error("Compiled row action must mount");}
    const pendingRow = rowHandler();
    const busyDuringRequest = rowState.rowActionBusy;
    finishRow("done");
    const rowResult = await pendingRow;
    rowState.pendingId = "";
    const deniedRow = await rowHandler();
    rowState.pendingId = "coupon-1";
    rejectRow = true;
    let rejectedRow = "";
    try { await rowHandler(); } catch (error) { rejectedRow = (error as Error).message; }
    const rowActions = { busyDuringRequest, result: rowResult, denied: deniedRow, rejected: rejectedRow,
      busyAfter: rowState.rowActionBusy, error: rowState.error, requests, cleanups };

    // An unrelated native-JS construct proves the boundary is not a finally
    // rewrite. Registered event factories may contain classes and generators.
    runtime.update([await transpile({ name: "./native-event.tsx", lang: "tsx", source: `import React from "react";
      import {createStateEventHandler as event} from "@plasmicapp/react-web";
      import {ActionButton} from "row-action-library";
      export default function NativeEvent({value}) {
        return <ActionButton onClick={event(()=>[value], value=>()=>{
          class Result { constructor(value){this.value=value;} }
          function* values(){yield new Result(value).value;yield value+1;}
          return [...values()];
        })}>Run</ActionButton>;
      }` })]);
    render("./native-event.tsx", { value: 4 });
    if (!rowHandler) {throw new Error("Native event must mount");}
    const nativeEventSyntax = await rowHandler();

    const custom = { name: "./custom.tsx", lang: "tsx", source: `import React from "react";
      function customElement(type,props,...children) { return React.createElement(type,{...props,"data-preview-pragma":"custom"},...children); }
      export default function GeneratedCustom() { return <span>Custom JSX</span>; }` };
    runtime.update([await transpile(custom)]); render("./custom.tsx");
    const defaultPragma = container.querySelector("[data-preview-pragma]") === null;
    runtime.update([await transpile({ ...custom, jsxPragma: "customElement" })]); render("./custom.tsx");
    const customPragma = container.querySelector("[data-preview-pragma=custom]")?.textContent;

    for (const rejected of [
      'import React from "react"; export default function Conditional({enabled}) { if(enabled) { React.useState(0); } return <span/>; }',
      'import React from "react"; export function createComponent() { return function() { const [value]=React.useState(0); return <span>{value}</span>; }; }',
      'import React from "react"; export default function Skipped() { "use no memo"; return <span/>; }',
      'import {Component as C} from "react"; export default class AliasedBoundary extends C { render() { return <span/>; } }',
    ]) {
      try { await transpile({ name: "./rejected.tsx", lang: "tsx", source: rejected }); }
      catch (error) { errors.push(String(error)); }
    }
    const css = await transpile({ name: "./styles.css", lang: "css", source: "button { color: red }" });
    return {
      compilerRuntimeImport: compiled.code.includes("react/compiler-runtime"),
      incremented, retainedSameSource, retainedText, evictedImporter, dependencyEditText,
      evictedSource, sourceEditText, defaultPragma, customPragma, errors,
      authoredVarInitial, authoredVarUpdated,
      authoredConditionalInitial, authoredConditionalUpdated,
      refCommandResult, opaqueRefCommits,
      rowActions,
      nativeEventSyntax,
      cssAsset: css.type === "asset" && css.source === "button { color: red }",
      nodeGlobals: { require: typeof (globalThis as { require?: unknown }).require, process: typeof (globalThis as { process?: unknown }).process },
    };
  } finally { flushSync(() => root.unmount()); container.remove(); }
}
