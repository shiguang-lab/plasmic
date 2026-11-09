import { stripParensAndMaybeConvertToIife } from "@/wab/shared/core/exprs";
import { lowerFunctionVars } from "@/wab/shared/eval/lower-function-vars";
import { transformSync } from "@babel/core";
import { ensure } from "@/wab/shared/common";
import * as React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { reactCompilerOptions } from "../../../../tools/react-compiler.mjs";

function evaluate(source: string, strict: boolean) {
  return new Function(`${strict ? '"use strict";' : ""} return (${source});`)();
}

const expressions = [
  '(function(){ return typeof value; var value = 2; })()',
  '(function(){ var before = value; if(true){var value=3;} return [before,value]; })()',
  '(function(){var value=1;var value;var value=2;return value;})()',
  '(function(value){var value=7;return [value,arguments[0]];})(2)',
  '(function(value){var value;return value;})(2)',
  '(function(){var value; function value(){return 3;} return value();})()',
  '(function(){try{throw 1;}catch(value){var value=2;}return typeof value;})()',
  '(function(){var callbacks=[];for(var i=0;i<3;i++){callbacks.push(()=>i);}return callbacks.map(fn=>fn());})()',
  '(function(){var values=[];for(var key in {a:1,b:2}){values.push(()=>key);}return values.map(fn=>fn());})()',
  '(function(){var values=[];for(var value of [1,2]){values.push(()=>value);}return values.map(fn=>fn());})()',
  '(function(){var i=3;for(var i;i<4;i++){}return i;})()',
  '(function(){var a=1,b=2;var {x:a,y:b=5,...rest}={x:3,z:6};var [first,,...tail]=[1,2,3,4];return [a,b,rest,first,tail];})()',
  '(function(){var rows=[];for(var {value} of [{value:1},{value:2}]){rows.push(()=>value);}return rows.map(fn=>fn());})()',
  '(function(){var i=0;for(var a=1,b=2;i<1;i++){a+=b;}return [a,b];})()',
  '(function(){var value=1;var read=function(){return value;var value=4;};return [value,read()];})()',
  '(function named(){var named;return typeof named;})()',
  '(function(){var value=1;return (()=>{var value=3;return value;})()+value;})()',
  '(function(){"use strict";var value=1;return (function(){return this;})()===undefined && value;})()',
  '(()=>{var value=1;return {value};})()',
  '(function(){var rows=[];for(/* head */ var key in {a:1,b:2}){rows.push(key);}return rows;})()',
  '(function(){var value;for(/* head */ var value of [1,2]){}return value;})()',
] as const;

it.each(expressions)("preserves function binding semantics: %s", (source) => {
  const lowered = lowerFunctionVars(source);
  expect(lowered).not.toContain("var ");
  for (const strict of [false, true]) {
    expect(evaluate(lowered, strict)).toEqual(evaluate(source, strict));
  }
});

it.each([
  '(function(){var value=1;eval("var value=2");return value;})()',
  '(function(){var value=1;with({value:2}){value++;}return value;})()',
  '(function(){var value;if(true){function value(){}}return typeof value;})()',
  '(function(){var key;for(var key=1 in {}){}return key;})()',
  '(function(){var let=1;return let;})()',
  '(function(){var arguments;return arguments.length;})(1,2)',
  '(function(){var eval;return typeof eval;})()',
])("keeps dynamic scope and legacy syntax available to the existing diagnostics: %s", (source) => {
  expect(lowerFunctionVars(source)).toBe(source);
  expect(evaluate(lowerFunctionVars(source), false)).toEqual(evaluate(source, false));
});

it("does not change invalid expressions or var text in strings", () => {
  for (const source of ['(()=>{var value =})()', '"var value"', '(() => "var value")()']) {
    expect(lowerFunctionVars(source)).toBe(source);
  }
});

it("normalizes authored scripts after the existing implicit IIFE conversion", () => {
  const source = stripParensAndMaybeConvertToIife("(var value=3;var value;value)");
  expect(source).not.toContain("var ");
  expect(evaluate(source, true)).toBe(3);
});

it("retains direct-eval Compiler diagnostics rather than bypassing the compiler", () => {
  const source = lowerFunctionVars('(function(){var value=1;eval("value=2");return value;})()');
  expect(() => transformSync(`function Example(){return <span>{${source}}</span>;}`, {
    filename:"AuthoredEval.tsx", babelrc:false, configFile:false,
    parserOpts:{plugins:["jsx"]}, plugins:[["babel-plugin-react-compiler",reactCompilerOptions()]],
  })).toThrow();
});

afterEach(cleanup);
it("strictly compiles the actual function-wide closure and updates native React inputs", () => {
  const expression = '(function(){var value;var read=()=>value+input;value=3;return [read(),read()].join(",");})()';
  const compiled = transformSync(`function Example({input}) { const data = (${lowerFunctionVars(expression)}); return <output>{data}</output>; }`, {
    filename: "AuthoredVar.tsx", babelrc: false, configFile: false,
    presets: [["@babel/preset-react", { runtime: "classic" }]],
    plugins: [["babel-plugin-react-compiler", reactCompilerOptions()]],
  });
  const source = ensure(compiled?.code, "Compiled authored var fixture");
  expect(source).toContain("react/compiler-runtime");
  const { c } = require("react/compiler-runtime");
  const Example = new Function("React", "_c", `${source.replace(/^import[^\n]+react\/compiler-runtime[^\n]+\n/m, "")}\nreturn Example;`)(React, c);
  const view = render(<Example input={1}/>);
  expect(screen.getByRole("status").textContent).toBe("4,4");
  view.rerender(<Example input={2}/>);
  expect(screen.getByRole("status").textContent).toBe("5,5");
});
