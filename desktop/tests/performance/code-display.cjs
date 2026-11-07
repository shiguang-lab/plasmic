// Controlled production-leaf benchmark. The caller enables the existing codePreview
// devflag in the isolated startup fixture; no saved project data is modified.
const fs = require("node:fs");
const { createHash } = require("node:crypto");

async function codeDisplayProbe() {
  const assert = (value, message) => {if (!value) throw Error(message);return value;};
  const wait = async (read, message) => {
    for (let i=0;i<600;i++) {const value=read();if(value)return value;await new Promise(resolve=>setTimeout(resolve,20));}
    throw Error(message);
  };
  const fiber = node => node[Object.keys(node).find(key=>key.startsWith('__reactFiber$'))];
  const ancestors = node => {const values=[];for(let current=fiber(node);current;current=current.return) values.push(current);return values;};
  const force = instance => new Promise(resolve=>instance.forceUpdate(resolve));
  const pre=await wait(()=>[...document.querySelectorAll('pre')].find(node=>node.textContent.length>100 && ancestors(node).some(f=>typeof f.stateNode?.props?.code==='string')), 'CodeDisplay never highlighted generated code');
  const tree=ancestors(pre);
  const highlight=assert(tree.map(f=>f.stateNode).find(value=>typeof value?.props?.code==='string' && typeof value.render==='function'),'Missing native Highlight instance');
  const inner=assert(tree.map(f=>f.stateNode).find(value=>value?.state?.loaded && typeof value.state.data==='function' && typeof value.forceUpdate==='function'),'Missing CodeDisplay Loadable');
  const outer=assert(tree.map(f=>f.stateNode).find(value=>value?.state?.loaded && typeof value.state.data==='string' && typeof value.setState==='function'),'Missing formatted code Loadable');
  const initial=outer.state.data;
  const renderedCode=()=>Array.from(pre.children,line=>line.textContent==='\n'?'':line.textContent).join('\n');
  assert(renderedCode()===initial.trim(),'Initial highlighted code differs from input');
  let renders=0;
  const render=highlight.render;
  highlight.render=function(...args){renders++;return render.apply(this,args);};
  try {
    for(let i=0;i<5;i++)await force(inner);
    renders=0;
    const durations=[];
    for(let i=0;i<30;i++) {
      const start=performance.now();
      await force(inner);
      assert(renderedCode()===initial.trim(),'Same-input highlight became stale');
      durations.push(performance.now()-start);
    }
    const repeatedRenderCalls=renders;
    const changed=initial+'\n// Compiler native correctness probe\n';
    await new Promise(resolve=>outer.setState({data:changed},resolve));
    assert(renderedCode()===changed.trim(),'Changed code was cached incorrectly');
    await new Promise(resolve=>outer.setState({data:initial},resolve));
    assert(renderedCode()===initial.trim(),'Restored code was cached incorrectly');
    const sorted=durations.slice().sort((a,b)=>a-b);
    return {kind:'Synthetic repeated same-props updates of the production CodeDisplay Loadable; excludes startup and normal editor interactions',warmups:5,samples:30,characters:initial.trim().length,highlightRenderCalls:repeatedRenderCalls,medianMs:(sorted[14]+sorted[15])/2,p95Ms:sorted[28],durations,changedCodeCorrect:true,restoredCodeCorrect:true};
  } finally {
    if (pre.isConnected && outer.state.data!==initial) {
      await new Promise(resolve=>outer.setState({data:initial},resolve));
    }
    highlight.render=render;
  }
}

exports.run = async frame => ({
  ...await frame.executeJavaScript(`(${codeDisplayProbe.toString()})()`),
  harnessSha256: createHash("sha256").update(fs.readFileSync(__filename)).digest("hex"),
});
