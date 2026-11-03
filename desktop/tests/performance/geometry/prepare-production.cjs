// Freeze the product candidate and an explicit Git or saved-source reference.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{execFileSync}=require('node:child_process');
const repo=path.resolve(__dirname,'../../../..'),[output,revision]=process.argv.slice(2);
if(!output||!revision)throw Error('private-output baseline-git-revision-or-source-directory required');
const task=path.resolve(output);
if(task.startsWith(repo+'/')||fs.existsSync(path.join(task,'source')))throw Error('Use a fresh private source directory');
fs.mkdirSync(task,{recursive:true,mode:0o700});
const src=path.join(task,'source/platform/wab/src');
fs.cpSync(path.join(repo,'platform/wab/src'),src,{recursive:true});
fs.cpSync(path.join(repo,'platform/wab/public'),path.join(task,'source/platform/wab/public'),{recursive:true});
for(const dir of ['','platform','platform/wab'])fs.symlinkSync(path.join(repo,dir,'node_modules'),path.join(task,'source',dir,'node_modules'),'dir');
const name='platform/wab/src/wab/client/components/canvas/marquee-selection.ts';
const hash=s=>crypto.createHash('sha256').update(s).digest('hex');
const referenceDirectory=fs.existsSync(revision)&&fs.statSync(revision).isDirectory()?path.resolve(revision):undefined;
const referenceHashes={};
let baseline;
if(referenceDirectory){
  const canvas='platform/wab/src/wab/client/components/canvas';
  for(const file of ['marquee-selection.ts','geometry-snapshot.ts','HoverBox/visible-bounds.ts']){
    const content=fs.readFileSync(path.join(referenceDirectory,canvas,file),'utf8');
    referenceHashes[file]=hash(content);
    const target=path.join(task,'reference',file);
    fs.mkdirSync(path.dirname(target),{recursive:true});
    fs.writeFileSync(target,content,{mode:0o600});
  }
  fs.symlinkSync(path.join(repo,'platform/wab/node_modules'),path.join(task,'reference/node_modules'),'dir');
  baseline=fs.readFileSync(path.join(task,'reference/marquee-selection.ts'),'utf8')
    .replace('"@/wab/client/components/canvas/HoverBox/visible-bounds"',JSON.stringify(path.join(task,'reference/HoverBox/visible-bounds.ts')))
    .replace('"@/wab/client/components/canvas/geometry-snapshot"',JSON.stringify(path.join(task,'reference/geometry-snapshot.ts')));
}else{
  baseline=execFileSync('git',['show',`${revision}:${name}`],{cwd:repo,encoding:'utf8'});
  const expected=JSON.parse(fs.readFileSync(path.join(repo,'docs/performance/2026-11-03/geometry-query-experiment.json'))).verification.productSourceHashesUnchanged.find(x=>x.path.endsWith('marquee-selection.ts')).before;
  if(hash(baseline)!==expected)throw Error('Baseline selection source differs from measured reference');
}
fs.writeFileSync(path.join(task,'baseline-selection.ts'),baseline,{mode:0o600});
const dragName='platform/wab/src/wab/client/Dnd.tsx';
const dragBaseline=referenceDirectory
  ?fs.readFileSync(path.join(referenceDirectory,dragName),'utf8')
  :execFileSync('git',['show',`${revision}:${dragName}`],{cwd:repo,encoding:'utf8'});
fs.writeFileSync(path.join(task,'baseline-drag.tsx'),dragBaseline,{mode:0o600});
fs.symlinkSync(path.join(repo,'platform/wab/node_modules'),path.join(task,'node_modules'),'dir');
const file=path.join(task,'source',name),original=fs.readFileSync(file,'utf8');
const signature='export function getSelectableLayers(vc: ViewCtx, box?: Box): ValNode[] {';
if(original.split(signature).length!==2)throw Error('Selection signature changed');
const wrapped=`import { measureProductionQuery } from ${JSON.stringify(path.join(__dirname,'production-query'))};\n`+original.replace(signature,
  `export function getSelectableLayers(vc: ViewCtx, box?: Box): ValNode[] { return measureProductionQuery(vc, box, () => querySelectableLayers(vc, box)); }\nfunction querySelectableLayers(vc: ViewCtx, box?: Box): ValNode[] {`);
fs.writeFileSync(file,wrapped);
fs.writeFileSync(path.join(task,'production-sources.json'),JSON.stringify({baselineRevision:referenceDirectory?undefined:revision,referenceDirectory,referenceHashes,baselineHash:hash(baseline),dragBaselineHash:hash(dragBaseline),productDragHash:hash(fs.readFileSync(path.join(repo,dragName),'utf8')),productSelectionHash:hash(original),instrumentedHash:hash(wrapped)},null,2));
console.log(task);
