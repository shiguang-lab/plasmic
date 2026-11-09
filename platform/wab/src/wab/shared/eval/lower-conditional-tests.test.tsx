import { lowerConditionalTests } from "@/wab/shared/eval/lower-conditional-tests";
import { stripParensAndMaybeConvertToIife } from "@/wab/shared/core/exprs";
import { transformSync } from "@babel/core";
import { reactCompilerOptions } from "../../../../tools/react-compiler.mjs";

const realExpression = '($state.selectedReview || {}).updatedAt + ((($state.selectedReview || {}).submitAt === ($state.selectedReview || {}).updatedAt) ? "（未修改过）" : "（被用户修改过）")';

function evaluate(source: string) {
  return new Function('"use strict";return (' + source + ');')();
}

it.each([
  '(()=>{let reads=0;const source={get value(){reads++;return {a:1,b:1};}};const result=(source.value||{}).a===(source.value||{}).b?"same":"different";return [result,reads];})()',
  '(()=>{const log=[];const read=(name,value)=>{log.push(name);return value;};const result=(read("left",false)&&read("skipped",true))===read("right",false)?read("yes",1):read("no",2);return [result,log];})()',
  '(()=>{const log=[];const read=(name,value)=>{log.push(name);return value;};const result=(read("left",true)||read("skipped",false))?read("yes",1):read("no",2);return [result,log];})()',
  '(()=>{let reads=0;try{return (({get value(){reads++;throw Error("stop");}}).value||false)?1:2;}catch(error){return [error.message,reads];}})()',
  '(()=>{const value=null;return (value??{a:1}).a ? ((value||{}).a?1:2) : 3;})()',
  '(function(value){return (this.value||arguments[0])?this.value:arguments[0];}).call({value:2},1)',
  '(function(){let result=1;return (false||eval("result=2"))?result:0;})()',
  '(()=>{const __plasmicTest=3;return (false||__plasmicTest)?__plasmicTest:0;})()',
  '(()=>{let value=1;return (value||2)?()=>value:()=>0;})()()',
  '(()=>{const log=[];const read=(name,value)=>{log.push(name);return value;};const result=read("before",1)+((read("test",true)||false)?read("yes",2):read("no",3))+read("after",4);return [result,log];})()',
  '(true ? false || true : false) ? 1 : 2',
])("preserves native evaluation: %s", (source) => {
  const lowered = lowerConditionalTests(source);
  expect(lowered).not.toBe(source);
  expect(evaluate(lowered)).toEqual(evaluate(source));
  expect(lowerConditionalTests(lowered)).toBe(lowered);
});

it("keeps await and yield in their original function scope", async () => {
  const asyncSource = '(async()=>{let value=0;return (false||await Promise.resolve(++value))?value:0;})()';
  expect(await evaluate(lowerConditionalTests(asyncSource))).toBe(await evaluate(asyncSource));
  const generatorSource = '(function*(){return (false||(yield 1))?2:3;})()';
  for (const source of [generatorSource, lowerConditionalTests(generatorSource)]) {
    const iterator = evaluate(source);
    expect(iterator.next()).toEqual({value:1,done:false});
    expect(iterator.next(true)).toEqual({value:2,done:true});
  }
});

it("leaves ordinary tests, nested function bodies and invalid syntax unchanged", () => {
  for (const source of ['value?1:2', 'read(()=>left||right)?1:2', '(invalid?']) {
    expect(lowerConditionalTests(source)).toBe(source);
  }
});

it("normalizes actual authored code before strict compilation without adding a function", () => {
  expect(() => transformSync(`function Example({$state}){return <output>{${realExpression}}</output>;}`, {
    filename:"AuthoredConditional.tsx", babelrc:false, configFile:false,
    parserOpts:{plugins:["jsx"]}, plugins:[["babel-plugin-react-compiler",reactCompilerOptions()]],
  })).toThrow(/Unexpected terminal kind `logical` for ternary test block/);
  const source = `function Example({$state}){return <output>{${stripParensAndMaybeConvertToIife(`(${realExpression})`)}}</output>;}`;
  const events: string[] = [];
  const compiled = transformSync(source, {
    filename:"AuthoredConditional.tsx", babelrc:false, configFile:false,
    parserOpts:{plugins:["jsx"]},
    plugins:[["babel-plugin-react-compiler",reactCompilerOptions({logEvent:(_file,event)=>events.push(event.kind)})]],
  });
  expect(events).toContain("CompileSuccess");
  expect(compiled?.code).toContain("react/compiler-runtime");
  expect(source).not.toContain("=>");
});
