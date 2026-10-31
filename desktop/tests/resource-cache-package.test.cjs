const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const { createRequire } = require("node:module");
const { createHash } = require("node:crypto");

test("the desktop file backend resolves its shared dependency from a standalone app layout", async t => {
  const root = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), "resource-cache-package-")));
  t.after(() => fs.rm(root, {recursive:true,force:true}));
  const module = path.join(root, "node_modules/@plasmic-shared/resource-cache");
  await fs.mkdir(module, {recursive:true});
  const source = path.dirname(require.resolve("@plasmic-shared/resource-cache/package.json"));
  await fs.copyFile(path.join(source,"package.json"),path.join(module,"package.json"));
  await fs.cp(path.join(source,"src"),path.join(module,"src"),{recursive:true});
  await fs.cp(path.dirname(require.resolve("semver/package.json")),path.join(root,"node_modules/semver"),{recursive:true});
  await fs.mkdir(path.join(root,"src"));
  const entry = path.join(root,"src/library-cache.cjs");
  await fs.copyFile(path.join(__dirname,"../src/library-cache.cjs"),entry);
  const packaged = createRequire(entry);
  assert.equal(packaged.resolve("@plasmic-shared/resource-cache"),path.join(module,"src/index.cjs"));
  const {LibraryCache} = packaged(entry);
  const body = '{"version":"schema","map":{}}';
  let downloads = 0;
  const identity = {epoch:0,value:{user:{id:"account"}},async read(){return this.value},invalidate(){this.epoch++}};
  const cache = new LibraryCache({directory:path.join(root,"cache"),studioOrigin:"https://studio.test",buildId:"build",identity,
    remoteFetch:async()=>{
      downloads++;
      return new Response(body,{headers:{"Content-Type":"application/json","X-Plasmic-Model-Resource":JSON.stringify({id:"model",digest:createHash("sha256").update(body).digest("hex")})}});
    },
  });
  for(let visit=0;visit<2;visit++) assert.equal(await(await cache.fetch(new Request("https://studio.test/api/v1/dependency-models/model"))).text(),body);
  assert.equal(downloads,1);
});
