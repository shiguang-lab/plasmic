// Diagnostic hooks only. Release entries never import this file.
import { geometry } from "./probe";
import { getSelectableLayers } from "@/wab/client/components/canvas/marquee-selection";
import { getArenaFrames } from "@/wab/shared/Arenas";
import { Box, Pt } from "@/wab/shared/geom";
import { assertSiteInvariants } from "@/wab/shared/site-invariants";

const s = () => (window as any).studioCtx;
let vc: any, queryBox: Box;
const raf = () => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
const ids = (values: any[]) => values.map(v => v.fullKey).sort();
let inputSequence = 0, pendingInput: any, inputResult: any;
const watched = new WeakSet<Document>();
function watch(doc: Document) {
  if (watched.has(doc)) return;
  watched.add(doc);
  doc.defaultView!.addEventListener("pointerup", event => {
    // Studio forwards synthetic outside-interaction events between frames.
    // Time only the trusted source event, before document capture handlers.
    if (!pendingInput || !event.isTrusted) return;
    const p = pendingInput;
    pendingInput = undefined;
    const at = performance.now();
    setTimeout(async () => {
      try {
        await s().awaitEval(); await raf();
        inputResult = {id:p.id, trusted:event.isTrusted, feedbackMs:performance.now()-at,
          query:geometry.samples.slice(p.start), selected:ids(vc.focusedSelectables()),
          changed:s()._changeCounter !== p.counter};
      } catch (e) { inputResult = {id:p.id,error:String(e)}; }
    },0);
  },true);
}
async function ready() { await s().awaitEval(); await s().awaitStudioReady(); await raf(); }
function frameRect() { return vc.canvasCtx.viewport().getBoundingClientRect(); }
function boxes() {
  const r = frameRect(), w = r.width, h = r.height;
  return Array.from({length:24},(_,i) => new Box(r.top+h*(i%4)*.06, r.left+w*(i%3)*.08,
    w*(.3+(i%5)*.12), h*(.25+(i%6)*.12)));
}
function compare(label: string) {
  (window as any).__geometryStage=label;
  const result = [];
  const oracle=(window as any).__geometryBaseline;
  for (const box of boxes().slice(0,label === "initial" ? 24 : 8)) {
    geometry.mode = "baseline";
    const expected = ids(oracle ? oracle(vc,box) : getSelectableLayers(vc,box));
    const modes=oracle ? ["cached-js"] as const : ["cached-js","cached-wasm"] as const;
    for (const mode of modes) {
      geometry.mode = mode;
      const actual = ids(getSelectableLayers(vc,box));
      if (JSON.stringify(actual)!==JSON.stringify(expected)) throw Error(`Selection differs: ${label}/${mode}`);
    }
    result.push(expected.length);
  }
  return {label,queries:result.length,matches:true,selectedMin:Math.min(...result),selectedMax:Math.max(...result)};
}
(window as any).__geometry = {
  state:geometry,
  async setup(index=0) {
    const editor=s(); clearInterval(editor.asyncSaverTimer);
    const frames=getArenaFrames(editor.currentArena);
    if(!frames[index])throw Error("No requested fixture artboard");
    editor.changeSelection(()=>editor.setStudioFocusOnFrame({frame:frames[index],autoZoom:true}));
    await ready(); vc=editor.tryGetViewCtxForFrame(frames[index]);
    if(!vc)throw Error("Fixture view missing");
    watch(document); watch(vc.canvasCtx.doc());
    const r=frameRect();
    queryBox=new Box(r.top+Math.min(25,r.height*.1),r.left-12,Math.min(r.width*.7,550)+12,Math.min(r.height*.65,340));
    return this.describe();
  },
  describe() {
    const r=frameRect(), old=geometry.mode; geometry.mode="baseline";
    const count=getSelectableLayers(vc).length; geometry.mode=old; geometry.samples=[];
    return {frame:{x:r.x,y:r.y,width:r.width,height:r.height},selectable:count,
      zoom:s().zoom,canvasDom:vc.canvasCtx.doc().querySelectorAll('*').length,
      frames:getArenaFrames(s().currentArena).length,
      query:{x:queryBox.left(),y:queryBox.top(),width:queryBox.width(),height:queryBox.height()}};
  },
  async queries(mode: any, count=72, profile=false) {
    geometry.mode=mode;geometry.profile=profile;geometry.samples=[];
    const bb=boxes(), output=[];
    for(let i=0;i<count;i++) {
      const at=performance.now(), selected=getSelectableLayers(vc,bb[i%bb.length]);
      output.push({ms:performance.now()-at,selected:selected.length});
      // One query per animation frame; do not benchmark a single artificial long loop.
      await new Promise<void>(resolve=>requestAnimationFrame(()=>resolve()));
    }
    const result={output,samples:geometry.samples.slice()};geometry.samples=[];return result;
  },
  arm(mode:any) {
    geometry.mode=mode;geometry.profile=false;
    geometry.samples=[]; inputResult=undefined;
    pendingInput={id:++inputSequence,start:0,counter:s()._changeCounter};
    return {id:inputSequence,start:{x:queryBox.left(),y:queryBox.top()},end:{x:queryBox.right(),y:queryBox.bottom()}};
  },
  inputResult:()=>inputResult,
  async functional() {
    geometry.profile=false; const checks=[compare("initial")];
    const editor=s(), snapshot=editor.getCurrentStudioViewportSnapshot();
    for(const scale of [.5,1,2]) {editor.viewportCtx.scaleAtMidPt(scale);await raf();checks.push(compare(`zoom-${scale}`));}
    editor.viewportCtx.scrollBy(new Pt(35,24));await raf();checks.push(compare("pan"));
    // Exercise actual canvas DOM changes between queries; query-local caches must not survive.
    const doc=vc.canvasCtx.doc(), el=doc.body.querySelector('[class]') as HTMLElement;
    if(!el)throw Error("No fixture DOM element");
    const before=el.getAttribute('style');
    try {
      el.style.visibility='hidden';checks.push(compare("hidden"));
      el.style.visibility='visible';el.style.transform='translate(13.25px,7.5px)';checks.push(compare("transform"));
      el.style.overflow='hidden';el.style.width='90px';el.style.height='45px';checks.push(compare("clip-resize"));
    } finally {if(before===null)el.removeAttribute('style');else el.setAttribute('style',before);}
    const scroller=[...doc.querySelectorAll('*')].find((x:any)=>x.scrollHeight>x.clientHeight+5 && x.clientHeight>0) as HTMLElement;
    if(scroller){const y=scroller.scrollTop;scroller.scrollTop=y+20;checks.push(compare("internal-scroll"));scroller.scrollTop=y;}
    const root=vc.arenaFrame().container.component.tplTree, vs=root.vsettings[0];
    const original=vs.rs.values.opacity;
    await editor.changeUnsafe(()=>{vs.rs.values.opacity='0.83';});await ready();checks.push(compare("model-edit"));
    await editor.undo();await ready();if(vs.rs.values.opacity!==original)throw Error("Undo mismatch");checks.push(compare("undo"));
    await editor.redo();await ready();checks.push(compare("redo"));await editor.undo();await ready();
    assertSiteInvariants(editor.site);
    editor.viewportCtx.scaleAtMidPt(snapshot.scale);await raf();
    geometry.samples=[];return checks;
  },
  async clear() {
    vc.change(()=>vc.setStudioFocusBySelectable(null)); await ready();geometry.samples=[];
  },
};
