import { defineConfig } from "vitest/config";
import base from "../../vitest.config";
import path from "node:path";
export default defineConfig({...base,test:{...base.test,
 projects:[{extends:true,test:{name:"acceptance",environment:"node",include:[path.join(__dirname,"server.test.ts")]}}],
 testTimeout:3600000,hookTimeout:120000,
}});
