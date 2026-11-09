import { serializeStateCommandHandler } from "@/wab/shared/codegen/react-p/data-reps";
import { ComponentType, mkComponent } from "@/wab/shared/core/components";
import { mkTplTagX } from "@/wab/shared/core/tpls";
import { ensure } from "@/wab/shared/common";
import { transformSync } from "@babel/core";
import { cleanup, fireEvent, render, screen, act } from "@testing-library/react";
import * as React from "react";
import * as compilerRuntime from "react/compiler-runtime";
import * as reactWeb from "@plasmicapp/react-web";
import { reactCompilerOptions } from "../../../../../../tools/react-compiler.mjs";

afterEach(cleanup);

it("uses the current command table after await and preserves an intentionally captured handle", async () => {
  const node = mkTplTagX("button");
  const component = mkComponent({name:"RefsOwner",type:ComponentType.Plain,tplTree:node});
  const handler = serializeStateCommandHandler({component}, node, `async () => {
    const captured = $refs.target;
    await wait();
    onDone(captured.label, $refs.target.label);
  }`);
  expect(handler).toContain("const $refs = getRefs()");
  const compiled = transformSync(`import React from "react";
    import { usePlasmicRefs, createStateEventHandler, getStateCommandEnv } from "@plasmicapp/react-web";
    export function Owner({label,wait,onDone}) {
      const {registerRef,getRefs}=usePlasmicRefs();
      const $props={}; const $ctx={};
      return <><Legacy label={label} ref={registerRef("target")}/><button onClick={${handler}}>Run</button></>;
    }`, {
    filename:"RefsOwner.tsx",babelrc:false,configFile:false,
    presets:[["@babel/preset-react",{runtime:"classic"}]],
    plugins:[["babel-plugin-react-compiler",reactCompilerOptions()],"@babel/plugin-transform-modules-commonjs"],
  });
  const source=ensure(compiled?.code,"Compiled real generated ref handler");
  expect(source).toContain("react/compiler-runtime");
  let commits=0;
  const Legacy=React.forwardRef<{label:string},{label:string}>(function Legacy({label},ref){
    // A legal opaque library component deliberately returns a fresh imperative
    // handle on every commit. Its identity must never schedule Owner rendering.
    React.useImperativeHandle(ref,()=>{commits++;return {label};});
    return null;
  });
  const exports: {Owner?:React.ComponentType<{label:string;wait:()=>Promise<void>;onDone:(before:string,after:string)=>void}>}={};
  new Function("require","Legacy","exports",source)((name: string) => {
    if (name === "react") { return React; }
    if (name === "react/compiler-runtime") { return compilerRuntime; }
    if (name === "@plasmicapp/react-web") { return reactWeb; }
    throw new Error(`Unexpected generated dependency ${name}`);
  },Legacy,exports);
  const Owner=ensure(exports.Owner,"Generated command owner");
  let resume: (()=>void)|undefined;
  const wait=()=>new Promise<void>(resolve=>{resume=resolve;});
  const done=vi.fn();
  const mounted=render(<React.StrictMode><Owner label="first" wait={wait} onDone={done}/></React.StrictMode>);
  expect(commits).toBeLessThan(8);
  fireEvent.click(screen.getByRole("button",{name:"Run"}));
  mounted.rerender(<React.StrictMode><Owner label="second" wait={wait} onDone={done}/></React.StrictMode>);
  await act(async()=>{ensure(resume,"Event reached await")();});
  expect(done).toHaveBeenCalledExactlyOnceWith("first","second");
  expect(commits).toBeLessThan(12);
});
