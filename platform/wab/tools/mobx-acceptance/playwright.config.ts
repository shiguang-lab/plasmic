import { defineConfig } from "../../playwright/node_modules/@playwright/test";
import base from "../../playwright/playwright.config";
import path from "node:path";
export default defineConfig({...base,testDir:path.join(__dirname,"../../playwright/e2e"),use:{...base.use,ignoreHTTPSErrors:true}});
