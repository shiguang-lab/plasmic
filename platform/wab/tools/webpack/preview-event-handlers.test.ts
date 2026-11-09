import { parseSync, transformFromAstSync } from "@babel/core";
import { outlineEventHandlers } from "../preview-event-handlers.mjs";
import { reactCompilerCandidates } from "../react-compiler-coverage.mjs";
import { expect, it } from "vitest";

function evaluate(body: string) {
  const source = `function create() { ${body} }`;
  const ast = parseSync(source, { babelrc: false, configFile: false, parserOpts: { plugins: ["jsx"] } });
  expect(ast).toBeTruthy();
  outlineEventHandlers(ast, reactCompilerCandidates(ast));
  const result = transformFromAstSync(ast, source, { babelrc: false, configFile: false, presets: [["@babel/preset-react", { runtime: "classic" }]] });
  expect(result?.code).toBeTruthy();
  return new Function("React", `${result?.code};return create();`)({ createElement: (type: any, props: any) => type === "button" ? props.onClick : type(props) });
}

it("retains live captured bindings, assignment values, and shorthand keys", () => {
  const read = evaluate(`
    let count = 1;
    const action = () => { try { return {count, previous: count++}; } finally { count += 2; } };
    const event = <button onClick={action}/>;
    return () => [event(), count];
  `);
  expect(read()).toEqual([{ count: 1, previous: 1 }, 4]);
  expect(read()).toEqual([{ count: 4, previous: 4 }, 7]);
});

it("does not give a bare function call or tag the capture object's receiver", () => {
  const read = evaluate(`
    const receiver = function() { "use strict"; return this; };
    return <button onClick={() => { try { return [receiver(), receiver?.(), receiver\`tag\`]; } finally {} }}/>;
  `);
  expect(read()).toEqual([undefined, undefined, undefined]);
});

it("preserves an ordinary handler's this/arguments and an arrow's lexical this/arguments", () => {
  const result = evaluate(`
    function owner(value) {
      const arrow = () => { try { return [this.name, arguments[0]]; } finally {} };
      const normal = function(value) { try { return [this.name, arguments[0]]; } finally {} };
      return [(<button onClick={arrow}/>).call({name:"wrong"}), (<button onClick={normal}/>).call({name:"normal"}, "argument")];
    }
    return owner.call({name:"lexical"}, "captured");
  `);
  expect(result).toEqual([["lexical", "captured"], ["normal", "argument"]]);
});

it("preserves declaration hoisting, defaults and recursion", () => {
  expect(evaluate(`
    let defaults = 0;
    const result = (<button onClick={action}/>)();
    function action(n = (++defaults, 2)) { try { return n ? 1 + action(n - 1) : 0; } finally {} }
    return [result, defaults];
  `)).toEqual([2, 1]);
});

it("keeps declaration self-references live after reassignment and outlines sibling handlers", () => {
  expect(evaluate(`
    const original = <button onClick={first}/>;
    const other = <button onClick={second}/>;
    function first() { try { return first; } finally {} }
    function second() { try { return first(); } finally {} }
    first = () => "replacement";
    return [original() === first, other()];
  `)).toEqual([true, "replacement"]);
});

it("retains labelled break/continue and nested finalizer completion order", () => {
  expect(evaluate(`
    const log = [];
    const action = () => {
      outer: for (let i=0;i<3;i++) {
        try {
          try { if (i===0) continue outer; if (i===1) break outer; }
          finally { log.push("inner"+i); }
        } finally { log.push("outer"+i); }
      }
      try { return "initial"; } finally { return "final"; }
    };
    return [(<button onClick={action}/>)(),log];
  `)).toEqual(["final", ["inner0", "outer0", "inner1", "outer1"]]);
});

it("keeps the current lexical binding after an asynchronous pause", async () => {
  const { run, change } = evaluate(`
    let value = "before";
    let release;
    const wait = new Promise(resolve => {release=resolve});
    const run = async () => { try { await wait; return value; } finally { value += ":cleaned"; } };
    return {run: <button onClick={run}/>, change: () => {value="after";release()}};
  `);
  const pending = run();
  change();
  await expect(pending).resolves.toBe("after");
});

it("preserves local JSX component bindings used inside an event", () => {
  const run = evaluate(`
    const Dialog = ({value}) => value;
    const value = "current";
    return <button onClick={() => <Dialog value={value}/>}/>;
  `);
  expect(run()).toBe("current");
});

it("leaves React candidates nested in handlers visible to strict compilation", () => {
  const source = `function Root(){return <button onClick={()=>{try {function useInvalid(){return React.useState(0)}}finally{cleanup()}}}/>}`;
  const ast = parseSync(source, { babelrc: false, configFile: false, parserOpts: { plugins: ["jsx"] } });
  const candidates = reactCompilerCandidates(ast);
  outlineEventHandlers(ast, candidates);
  const result = transformFromAstSync(ast, source, { babelrc: false, configFile: false });
  expect(result?.code).not.toContain("createEventHandler");
  expect(reactCompilerCandidates(ast)).toEqual(candidates);
});
