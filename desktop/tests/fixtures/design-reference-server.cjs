const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { ListToolsRequestSchema, CallToolRequestSchema } = require('@modelcontextprotocol/sdk/types.js');
const server = new Server({name:'reference-fixture',version:'1.0.0'},{capabilities:{tools:{}}});
server.setRequestHandler(ListToolsRequestSchema,async()=>({tools:[{name:'execute',inputSchema:{type:'object',properties:{filePath:{type:'string'},input:{type:'string'}}}}]}));
server.setRequestHandler(CallToolRequestSchema,async()=>({content:[{type:'text',text:'PLASMIC_REF:{"items":[],"total":0}'}]}));
server.connect(new StdioServerTransport());
