// Tests the real production components in an isolated Studio document only.
exports.run = (frame) => frame.executeJavaScript(`(async()=>{
  const assert=(ok,message)=>{if(!ok)throw Error(message)};
  const wait=async(fn)=>{const deadline=performance.now()+15000;while(!fn()){if(performance.now()>deadline)throw Error('Renderer probe timed out');await new Promise(r=>setTimeout(r,16))}};
  const result={cases:[]},start=performance.now();
  const probe=await window.__rendererFirstUse();result.probeModuleMs=performance.now()-start;
  const host=document.querySelector('[data-renderer-probe]');
  const originalExec=document.execCommand;let copied;
  document.execCommand=function(command,...args){if(command==='copy'){copied=window.getSelection().toString();return true}return originalExec.call(this,command,...args)};
  try {
    const cold=performance.now();
    probe.render({markdown:'# Heading\\n\\n- One\\n- Two\\n\\n| Name | Value |\\n| --- | --- |\\n| Count | 1 |\\n\\nInline $x^2$\\n\\nUpdated \\u0060StatusFilter\\u0060.\\n\\n\\u0060\\u0060\\u0060typescript\\nconst title: string = "Studio";\\n\\u0060\\u0060\\u0060\\n\\n<script>window.rendererUnsafe=true</script>\\n\\n![Reference](https://example.test/image.png)'});
    await wait(()=>host.querySelector('.katex')&&host.querySelector('pre code .token'));
    result.markdownFirstUseMs=performance.now()-cold;
    assert(host.querySelector('table')&&host.querySelectorAll('li').length===2,'Markdown structure changed');
    assert(!host.querySelector('script,img')&&!window.rendererUnsafe,'Unsafe Markdown became active');
    host.querySelector('button[data-node-uuid]').click();assert(probe.located[0]?.uuid==='probe-node','Node locate failed');
    const block=host.querySelector('[data-test-id="ai-code-block"]');
    const copy=[...block.querySelectorAll('button')].find(b=>/Copy|复制|複製/.test(b.textContent));assert(copy,'Copy action missing');copy.click();
    assert(copied?.trim()==='const title: string = "Studio";','Copied code selection changed');
    block.querySelector('button[aria-label]').click();await wait(()=>document.querySelector('[role="dialog"]'));
    await wait(()=>document.querySelector('[role="dialog"] [data-overlayscrollbars]'));
    document.querySelector('.ant-modal-close').click();await wait(()=>!document.querySelector('[role="dialog"]'));
    result.cases.push('markdown-table-math-safety-locate-copy-fullscreen');
    probe.render({markdown:'\\u0060\\u0060\\u0060json\\n{"stream":',running:true});
    await wait(()=>host.querySelector('pre code')?.textContent.includes('stream'));
    probe.render({markdown:'\\u0060\\u0060\\u0060json\\n{"stream":true}\\n\\u0060\\u0060\\u0060'});
    await wait(()=>host.querySelector('pre code')?.textContent.includes('{"stream":true}'));
    result.cases.push('streaming-finalization');
    const codeStart=performance.now();probe.render({code:'const title = "Example";'});
    await wait(()=>host.querySelector('[data-probe-code] pre .token'));
    result.codeFirstUseMs=performance.now()-codeStart;
    const pre=()=>host.querySelector('[data-probe-code] pre');
    probe.theme('dark');await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));const dark=pre().style.backgroundColor;
    probe.theme('light');await wait(()=>pre().style.backgroundColor!==dark);
    assert(pre().textContent==='const title = "Example";','Theme change lost code');
    await wait(()=>host.querySelector('[data-probe-code] [data-overlayscrollbars]'));
    result.cases.push('code-theme-content-scrollbar');
    probe.render({});await wait(()=>!host.querySelector('pre'));
    const warm=performance.now();probe.render({markdown:'\\u0060\\u0060\\u0060js\\nconst warm = true;\\n\\u0060\\u0060\\u0060'});
    await wait(()=>host.querySelector('pre code .token'));result.markdownWarmUseMs=performance.now()-warm;
    probe.render({code:'const snippet = true;',snippet:true});await wait(()=>host.querySelector('[data-probe-code] pre .token'));
    assert(host.querySelector('[data-probe-code] pre').textContent==='const snippet = true;','CodeSnippet content changed');
    result.cases.push('warm-reopen-and-snippet');return result;
  } finally { document.execCommand=originalExec;probe.close(); }
})()`);
