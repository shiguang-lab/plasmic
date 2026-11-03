import fs from "node:fs";
import { beforeAll,beforeEach } from "vitest";
import { geometry } from "./probe";
beforeAll(async()=>{await geometry.init([...fs.readFileSync(process.env.GEOMETRY_WASM!)]);});
beforeEach(()=>{geometry.mode=(process.env.GEOMETRY_VARIANT||"baseline") as any;geometry.samples=[];});
