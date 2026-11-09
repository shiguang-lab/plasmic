import { parseSync, transformFromAstSync } from "@babel/core";
import { ensure } from "@/wab/shared/common";
import { expect, it } from "vitest";
import { reactComponentBases, reactCompilerCandidates, uncompiledCandidates } from "../react-compiler-coverage.mjs";
import { isReactRequiredErrorBoundary, reactCompilerOptions } from "../react-compiler.mjs";

it("reports factory-owned components and Hook callbacks that inference never visits", () => {
  const filename = "/tmp/CanvasCoverage.tsx";
  const code = `
    import * as React from "react";
    export function Visible() { return <span />; }
    export function useValue() { return React.useState(0); }
    function makeComponent(sub) {
      return function CanvasText() { return sub.React.createElement("span"); };
    }
    function makeObserver(sub) {
      return sub.React.forwardRef((props, ref) => observer(() => {
        const value = sub.React.useState(0);
        return sub.React.createElement("span", {ref}, value[0]);
      }));
    }
    const ReactComponent = React.Component;
    class ErrorBoundary extends ReactComponent { render() { return this.props.children; } }
    class DerivedBoundary extends ErrorBoundary {}
    function compute() { return 1; }
    const useStyles = createStyles(() => ({ root: { color: "red" } }));
  `;
  const ast = ensure(parseSync(code, { filename, babelrc: false, configFile: false, parserOpts: { plugins: ["typescript", "jsx"] } }), "Parsed coverage fixture");
  const candidates = reactCompilerCandidates(ast);
  const compiled: Array<{ loc: unknown }> = [];
  const diagnostics: unknown[] = [];
  transformFromAstSync(ast, code, {
    filename, babelrc: false, configFile: false, parserOpts: { plugins: ["typescript", "jsx"] },
    plugins: [["babel-plugin-react-compiler", reactCompilerOptions({ logEvent: (_file, event) => {
      if (event.kind === "CompileSuccess") { compiled.push({ loc: event.fnLoc }); }
      else if (event.kind === "CompileError" || event.kind === "CompileSkip") { diagnostics.push(event); }
    } })]],
  });
  expect(candidates.some((entry) => entry.name === "compute")).toBe(false);
  expect(candidates.some((entry) => entry.name === "useStyles")).toBe(false);
  expect(reactCompilerCandidates(ast)).toEqual(candidates);
  const missing = uncompiledCandidates(candidates, compiled, diagnostics);
  expect(missing.some((entry) => entry.name === "Visible" || entry.name === "useValue")).toBe(false);
  expect(missing.find((entry) => entry.name === "CanvasText")).toMatchObject({ nested: true, rejected: false });
  expect(missing.filter((entry) => entry.kind === "class").map((entry) => entry.name)).toEqual(["ErrorBoundary", "DerivedBoundary"]);
  expect(missing.filter((entry) => entry.name === "<anonymous>" && entry.nested).length).toBe(2);
});

it("tracks React subclasses across imported and aliased base classes", () => {
  const sources = [
    { filename: "StyleComponent.tsx", code: `import * as React from "react"; export class StyleComponent extends React.Component {}` },
    { filename: "SpacingControl.tsx", code: `import { StyleComponent as BaseStyle } from "./StyleComponent"; class SpacingControl extends BaseStyle { render() { return <div/>; } }` },
  ];
  const asts = sources.map(({code, filename}) => ensure(parseSync(code, { filename, babelrc: false, configFile: false, parserOpts: { plugins: ["typescript", "jsx"] } }), "Parsed cross-module fixture"));
  const bases = reactComponentBases(asts);
  expect(reactCompilerCandidates(asts[1], bases)).toMatchObject([{ name: "SpacingControl", kind: "class" }]);
});

it("keeps rejected components visible as uncompiled candidates", () => {
  const filename = "/tmp/RejectedCoverage.tsx";
  const code = `import {useState} from "react"; function Conditional({enabled}) { if (enabled) { useState(0); } return <span/>; }`;
  const ast = ensure(parseSync(code, { filename, babelrc: false, configFile: false, parserOpts: { plugins: ["typescript", "jsx"] } }), "Parsed coverage fixture");
  const candidates = reactCompilerCandidates(ast);
  expect(uncompiledCandidates(candidates, [], [{ fnLoc: candidates[0].loc }])).toMatchObject([{ name: "Conditional", rejected: true }]);
});

it("counts only the agreed native React capture classes as required boundaries", () => {
  const boundary = { file: "../canvas-packages/src/canvas-error.tsx", name: "CanvasErrorBoundary", kind: "class", errorCapture: true };
  expect(isReactRequiredErrorBoundary(boundary)).toBe(true);
  expect(isReactRequiredErrorBoundary({...boundary, file: "../live-frame/src/render.tsx", name: "PreviewErrorBoundary"})).toBe(true);
  expect(isReactRequiredErrorBoundary({ ...boundary, errorCapture: false })).toBe(false);
  expect(isReactRequiredErrorBoundary({ ...boundary, name: "BusinessPanel" })).toBe(false);
  expect(isReactRequiredErrorBoundary({ ...boundary, file: "src/wab/client/BusinessPanel.tsx" })).toBe(false);
});

it("does not mistake a JSX value's pure render callback for a component", () => {
  const code = `const EditableTitle = <Label render={props => <span {...props}/>} />;
    const WithHooks = <Label render={() => { useState(0); return <span/>; }} />;`;
  const ast = ensure(parseSync(code, { filename: "/tmp/RenderCallbacks.tsx", babelrc: false, configFile: false, parserOpts: { plugins: ["typescript", "jsx"] } }), "Parsed render callback fixture");
  const candidates = reactCompilerCandidates(ast);
  expect(candidates).toHaveLength(1);
  expect(candidates[0]).toMatchObject({name: "<anonymous>", kind: "component"});
});

it("counts anonymous fibers returned by explicitly React-typed factories without treating ordinary render factories as fibers", () => {
  const code = `import React, {ComponentType as EmailComponent} from "react";
    type Props = {name: string};
    function email(): React.ComponentType<Props> { return props => <p>{props.name}</p>; }
    const card = (): React.FC<Props> => props => <p>{props.name}</p>;
    function alias(): EmailComponent<Props> { return props => <p>{props.name}</p>; }
    function renderer() { return props => <p>{props.name}</p>; }
    const renderValue = <Label render={props => <p>{props.name}</p>} />;`;
  const ast = ensure(parseSync(code, { filename: "/tmp/TypedEmailFactory.tsx", babelrc: false, configFile: false, parserOpts: { plugins: ["typescript", "jsx"] } }), "Parsed typed factory fixture");
  const candidates = reactCompilerCandidates(ast);
  expect(candidates).toHaveLength(3);
  expect(candidates.every(entry => entry.name === "<anonymous>" && entry.kind === "component" && entry.nested)).toBe(true);
});

it("collects same-module React aliases from a shared unmodified AST", () => {
  const code = `import {Component as ReactBase} from "react";
    const LocalBase = ReactBase;
    class SharedBoundary extends LocalBase { render() { return <span/>; } }`;
  const ast = ensure(parseSync(code, { filename: "/tmp/AliasedBoundary.tsx", babelrc: false, configFile: false, parserOpts: { plugins: ["typescript", "jsx"] } }), "Parsed alias fixture");
  const original = JSON.stringify(ast);
  const bases = reactComponentBases([ast]);
  expect(reactCompilerCandidates(ast, bases)).toMatchObject([{ name: "SharedBoundary", kind: "class" }]);
  expect(JSON.stringify(ast)).toBe(original);
});

it("keeps strict coverage and emitted code identical when consuming the locally owned AST", () => {
  const filename = "/tmp/OwnedPreviewAst.tsx";
  const fixtures = [
    `import React, {useState} from "react";
      export function Preview({initial}: {initial: number}) {
        const [value, setValue] = useState(initial);
        return <button onClick={() => setValue(value + 1)}>{value}</button>;
      }`,
    `import React from "react";
      export function Preview({component, componentProps}) {
        const Component = componentsMap[component];
        return <Component {...componentProps}/>;
      }`,
    `import React from "react";
      export function Preview(props) { return React.createElement("span", props); }`,
  ];
  for (const code of fixtures) {
    const compile = (cloneInputAst: boolean) => {
      const ast = ensure(parseSync(code, { filename, babelrc: false, configFile: false, parserOpts: { plugins: ["typescript", "jsx"] } }), "Parsed owned AST fixture");
      const candidates = reactCompilerCandidates(ast, reactComponentBases([ast]));
      const compiled: Array<{ loc: unknown }> = [];
      const diagnostics: unknown[] = [];
      const result = transformFromAstSync(ast, code, {
        filename, babelrc: false, configFile: false, cloneInputAst, retainLines: true,
        plugins: [["babel-plugin-react-compiler", {
          ...reactCompilerOptions({ logEvent: (_file, event) => {
            if (event.kind === "CompileSuccess") { compiled.push({ loc: event.fnLoc }); }
            else if (event.kind === "CompileError" || event.kind === "CompileSkip") { diagnostics.push(event); }
          } }),
          environment: { enableResetCacheOnSourceFileChanges: false },
        }]],
      });
      return { code: result?.code, candidates, compiled, diagnostics, missing: uncompiledCandidates(candidates, compiled, diagnostics) };
    };
    const cloned = compile(true);
    expect(compile(false)).toEqual(cloned);
    expect(cloned.candidates).toHaveLength(1);
    if (code.includes("React.createElement")) {
      expect(cloned.missing).toMatchObject([{ name: "Preview", rejected: false }]);
    } else {
      expect(cloned.missing).toEqual([]);
      expect(cloned.compiled).toHaveLength(1);
    }
  }
});
