// Copy sources, then instrument only that copy. No product implementation edits.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const repo = path.resolve(__dirname, '../../../..'), task = path.resolve(process.argv[2]);
if (!process.argv[2] || task.startsWith(repo + '/')) throw Error('Use a private directory outside repository');
fs.mkdirSync(task, {recursive:true,mode:0o700});
const src = path.join(task,'source/platform/wab/src');
if (fs.existsSync(src)) throw Error('Frozen source already exists');
fs.cpSync(path.join(repo,'platform/wab/src'),src,{recursive:true});
fs.cpSync(path.join(repo,'platform/wab/public'),path.join(task,'source/platform/wab/public'),{recursive:true});
for(const directory of ['','platform','platform/wab']) {
  const link=path.join(task,'source',directory,'node_modules');
  fs.mkdirSync(path.dirname(link),{recursive:true});
  fs.symlinkSync(path.join(repo,directory,'node_modules'),link,'dir');
}
const probe = JSON.stringify(path.join(__dirname,'probe'));
function edit(name, fn) {
  const p = path.join(src,'wab/client',name), original = fs.readFileSync(p,'utf8');
  fs.writeFileSync(p,fn(original));
  return {path:name,before:crypto.createHash('sha256').update(original).digest('hex'),after:crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex')};
}
function once(s,a,b) { if(s.split(a).length!==2)throw Error('Unexpected source: '+a);return s.replace(a,b); }
const hashes=[];
hashes.push(edit('components/canvas/marquee-selection.ts',s=>{
  s=`import { readRect, readStyle, clipQuery, geometryQuery, geometryMatches, finishGeometryCandidates, startGeometryCollect, finishGeometryPrune } from ${probe};\n`+s;
  s=once(s,'export function getSelectableLayers(vc: ViewCtx, box?: Box): ValNode[] {',`export function getSelectableLayers(vc: ViewCtx, box?: Box): ValNode[] { return geometryQuery(vc, box, () => querySelectableLayers(vc, box)); }\nfunction querySelectableLayers(vc: ViewCtx, box?: Box): ValNode[] {`);
  if(!s.includes('vc.canvasCtx.viewport().getBoundingClientRect()'))throw Error('Missing frame measurement');
  s=s.replaceAll('vc.canvasCtx.viewport().getBoundingClientRect()','readRect(vc.canvasCtx.viewport())');
  s=once(s,'const candidates = SQ(owner, valState)','startGeometryCollect();\n  const rawCandidates = SQ(owner, valState)');
  s=once(s,'element.ownerDocument.defaultView?.getComputedStyle(element)','(element.ownerDocument.defaultView ? readStyle(element.ownerDocument.defaultView, element) : undefined)');
  s=once(s,'Box.fromRect(element.getBoundingClientRect())','Box.fromRect(readRect(element))');
  s=once(s,'computeClipBounds(element),','clipQuery(() => computeClipBounds(element)),');
  s=once(s,`visibleBounds.length > 0 &&\n        visibleBounds.every(\n          (bounds) => frameBox.intersects(bounds) && box.containsBox(bounds),\n        )`,`geometryMatches(val, visibleBounds, frameBox, box)`);
  s=once(s,'  const enclosed = new Set(candidates);','  const candidates = finishGeometryCandidates(rawCandidates);\n  const enclosed = new Set(candidates);');
  s=once(s,'  return candidates.filter(','  const result = candidates.filter(');
  s=once(s,'\n}\n\nexport function selectMarquee','\n  finishGeometryPrune(); return result;\n}\n\nexport function selectMarquee');
  return s;
}));
hashes.push(edit('components/canvas/HoverBox/visible-bounds.ts',s=>{
  s=`import { readRect, readStyle } from ${probe};\n`+s;
  s=s.replaceAll('elt.getBoundingClientRect()','readRect(elt)').replaceAll('win.getComputedStyle(elt)','readStyle(win, elt)').replaceAll('win.getComputedStyle(ancestor)','readStyle(win, ancestor)');
  return s;
}));
hashes.push(edit('coords.ts',s=>`import { readRect } from ${probe};\n`+s.replaceAll('vc.canvasCtx.viewport().getBoundingClientRect()','readRect(vc.canvasCtx.viewport())')));
fs.writeFileSync(path.join(task,'source-hashes.json'),JSON.stringify(hashes,null,2),{mode:0o600});
console.log(JSON.stringify({task,source:src,hashes}));
