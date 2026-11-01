const test = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const path = require('node:path');
test('contracts, image API and reference construction do not initialize SDKs or sharp', () => {
  const result = execFileSync(process.execPath, ['-e', `
    const {tools,assertToolRouting,EDITOR_METHODS}=require('./src/mcp-contract.cjs');
    require('./src/image-preview.cjs');
    const {DesignReference}=require('./src/design-reference.cjs');new DesignReference('/unused');
    if(!tools.length||!EDITOR_METHODS.length)throw Error('Missing contracts');
    try{assertToolRouting('execute',{name:'list_projects'});throw Error('Routing accepted');}catch(e){if(e.context?.code!=='INVALID_TOOL_ROUTE')throw e;}
    console.log(JSON.stringify(Object.keys(require.cache).filter(p=>/modelcontextprotocol|node_modules\\/sharp|node_modules\\/ajv/.test(p))));
  `], {cwd:path.join(__dirname,'..'),encoding:'utf8'});
  assert.deepEqual(JSON.parse(result), []);
});
