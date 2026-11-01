// Fill unchanged runtime assets from the matching installed build; never replace
// compiled Studio outputs or pretend this diagnostic build is a release build.
const fs = require("node:fs"), path = require("node:path"), crypto = require("node:crypto");
const [output, installed, source, variant] = process.argv.slice(2);
if (!output || !installed || !source || !variant) throw Error("Required: output, matching runtime assets, frozen source root, variant");
function fill(from,to) {
  for (const item of fs.readdirSync(from,{withFileTypes:true})) {
    const a=path.join(from,item.name), b=path.join(to,item.name);
    if (item.name==='desktop-assets.json') continue;
    if (item.isDirectory()) { fs.mkdirSync(b,{recursive:true}); fill(a,b); }
    else if (!fs.existsSync(b)) fs.copyFileSync(a,b);
  }
}
fill(installed,output);
const digest=crypto.createHash('sha256');
function fingerprint(directory) {
  for (const item of fs.readdirSync(directory,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name))) {
    const file=path.join(directory,item.name);
    if (item.isDirectory()) fingerprint(file);
    else if (item.name!=='desktop-assets.json') digest.update(path.relative(output,file)).update(fs.readFileSync(file));
  }
}
fingerprint(output);
const manifest=JSON.parse(fs.readFileSync(path.join(installed,'desktop-assets.json')));
manifest.build={kind:'diagnostic',variant,sourceRoot:source,runtimeRevision:manifest.build.revision,rendererHash:digest.digest('hex')};
fs.writeFileSync(path.join(output,'desktop-assets.json'),JSON.stringify(manifest));
console.log(JSON.stringify(manifest.build));
