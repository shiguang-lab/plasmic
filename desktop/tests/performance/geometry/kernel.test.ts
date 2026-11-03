import { expect,it } from "vitest";
import { Box } from "@/wab/shared/geom";
import { geometry,geometryQuery,readRect,readStyle } from "./probe";
it("matches actual Box semantics for 12000 finite fractional, degenerate and negative rectangles",()=>{
  let seed=23917;
  const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  const w=geometry.wasm,ptr=w.scratch_ptr(),count=12000,out=ptr+count*32;
  const data=new Float64Array(w.memory.buffer,ptr,count*4);
  const boxes=Array.from({length:count},(_,i)=>{
    const b=new Box((random()-.3)*900,(random()-.3)*1200,i%17===0?0:random()*200-10,i%19===0?0:random()*150-5);
    data.set([b.left(),b.top(),b.right(),b.bottom()],i*4);return b;
  });
  for(const frame of [new Box(0,0,1000,800),new Box(12.25,-9.75,530.5,210.25)])
    for(const query of [frame,new Box(0,0,0,0),new Box(-100,-100,400,400),new Box(800,1000,20,20)]){
      w.contains(ptr,count,out,frame.left(),frame.top(),frame.right(),frame.bottom(),query.left(),query.top(),query.right(),query.bottom());
      const flags=new Uint8Array(w.memory.buffer,out,count);
      for(let i=0;i<count;i++)expect(!!flags[i]).toBe(frame.intersects(boxes[i])&&query.containsBox(boxes[i]));
    }
});
it("shares measurements only within a synchronous query and rereads after mutations",()=>{
  const el=document.createElement('div');document.body.append(el);el.style.visibility='visible';
  let reads=0;
  el.getBoundingClientRect=()=>{reads++;return new DOMRect(0,0,20,10);};
  geometry.mode='cached-js';
  geometryQuery(null,undefined,()=>{readRect(el);readRect(el);readStyle(window,el);readStyle(window,el);return [];});
  expect(reads).toBe(1);expect(geometry.samples.at(-1)?.styleReads).toBe(1);
  el.style.visibility='hidden';
  geometryQuery(null,undefined,()=>{readRect(el);expect(readStyle(window,el).visibility).toBe('hidden');return [];});
  expect(reads).toBe(2);el.remove();
});
