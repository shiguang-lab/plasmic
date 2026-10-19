import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { Server } from "node:http";
const { createProbeServer, fixtureManifest, fixtureIds } = require("./server.cjs");
let directory: string;
let server: Server;
let origin: string;
beforeEach(async () => {
  directory = fs.mkdtempSync(path.join(os.tmpdir(), "preview-server-"));
  fixtureIds.forEach((id: string, index: number) => fs.writeFileSync(path.join(directory, `${id}.json`), JSON.stringify({ project: { id }, rev: { revision: 164 + index, data: "model" } })));
  fs.mkdirSync(path.join(directory, "static/sub/build"), { recursive: true });
  fs.writeFileSync(path.join(directory, "static/sub/build/client.current.js"), "current runtime");
  fs.writeFileSync(path.join(directory, "index.html"), "entry");
  fs.writeFileSync(path.join(directory, "antd-icons@1.0.0.js"), "pinned icons");
  server = createProbeServer({ production: true, fixtureDirectory: directory, rendererDirectory: directory, buildDirectory: directory });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  origin = `http://127.0.0.1:${(server.address() as any).port}`;
});
afterEach(async () => { server.closeAllConnections(); await new Promise<void>((resolve) => server.close(() => resolve())); fs.rmSync(directory, { recursive: true }); });
it("reads revisions from real fixture responses instead of fixed historical versions", async () => {
  expect(await (await fetch(origin + "/fixture/manifest.json")).json()).toEqual(fixtureIds.map((id: string, index: number) => ({ id, revision: 164 + index })));
});
it("rejects a mislabeled fixture identity instead of caching the wrong project", () => {
  fs.writeFileSync(path.join(directory, `${fixtureIds[0]}.json`), JSON.stringify({ project: { id: "wrong" }, rev: { revision: 164 } }));
  expect(() => fixtureManifest(directory)).toThrow("Invalid fixture identity");
});
it("serves only exact current build artifacts; a stale hash cannot silently load another build", async () => {
  const current = await fetch(origin + "/static/sub/build/client.current.js");
  expect(current.status).toBe(200); expect(await current.text()).toBe("current runtime");
  expect((await fetch(origin + "/static/sub/build/client.stale.js")).status).toBe(404);
});
it("serves the production API fixture and metadata without changing the saved model", async () => {
  const data = await (await fetch(`${origin}/api/v1/projects/${fixtureIds[0]}?revisionNum=164`)).json();
  expect(data.rev).toEqual({ revision: 164, data: "model" });
  const metadata = await (await fetch(`${origin}/api/v1/projects/${fixtureIds[0]}/revision-without-data`)).json();
  expect(metadata.rev).toEqual({ revision: 164 });
  expect((await fetch(origin + "/api/v1/projects/unknown")).status).toBe(404);
});
it("serves pinned registration assets and the production entrypoint", async () => {
  expect(await (await fetch(origin + "/api/v1/hostless-libraries/antd-icons/canvas?version=1.0.0")).text()).toBe("pinned icons");
  expect(await (await fetch(origin + "/canvas-preview/index.html")).text()).toBe("entry");
});
it("never substitutes a latest or different registration for the requested library version", async () => {
  expect((await fetch(origin + "/api/v1/hostless-libraries/antd-icons/canvas?version=2.0.0")).status).toBe(404);
  expect((await fetch(origin + "/api/v1/hostless-libraries/antd-icons/canvas")).status).toBe(400);
});
it("serves the minimal Preview Host to the experiment instead of the coordinator or onboarding page", async () => {
  const probe = createProbeServer({ fixtureDirectory: directory, rendererDirectory: directory, buildDirectory: directory });
  fs.writeFileSync(path.join(directory, "engine.html"), "minimal preview host");
  await new Promise<void>((resolve) => probe.listen(0, "127.0.0.1", resolve));
  try {
    const port = (probe.address() as any).port;
    expect(await (await fetch(`http://127.0.0.1:${port}/canvas-preview/index.html`)).text()).toBe("minimal preview host");
  } finally { probe.closeAllConnections(); await new Promise<void>((resolve) => probe.close(() => resolve())); }
});
it("rejects writes, path traversal and unknown libraries", async () => {
  expect((await fetch(origin + "/api/v1/projects/x", { method: "POST" })).status).toBe(405);
  expect((await fetch(origin + "/fixture/..%2foutside.json")).status).toBe(403);
  expect((await fetch(origin + "/api/v1/hostless-libraries/unknown/canvas")).status).toBe(404);
});
