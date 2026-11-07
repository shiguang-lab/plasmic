import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { chmod, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { projectId, renderData } from "./fixture.mjs";
import { readHydrationBuild } from "../../../scripts/build-html-hydrate.mjs";

const image = process.env.RENDERER_TEST_IMAGE;
assert(image, "Set RENDERER_TEST_IMAGE to the locally built renderer image");
const repository = fileURLToPath(new URL("../../../", import.meta.url));
const hydration = await readHydrationBuild(repository);
const hydrationScript = await readFile(new URL("../../loader-html-hydrate/build/loader-hydrate.js", import.meta.url));
const exec = promisify(execFile);
const name = `plasmic-renderer-test-${process.pid}`;
const require = createRequire(
  new URL("../../wab/package.json", import.meta.url),
);
const { chromium } = require("playwright");
let browser;
let web;
const tlsFixture = await mkdtemp(path.join(os.tmpdir(), "plasmic-renderer-tls-"));
try {
  await exec("openssl", ["req", "-x509", "-newkey", "rsa:2048", "-nodes", "-days", "1", "-keyout", path.join(tlsFixture, "key.pem"), "-out", path.join(tlsFixture, "cert.pem"), "-subj", "/CN=127.0.0.1", "-addext", "subjectAltName=IP:127.0.0.1"]);
  await chmod(tlsFixture, 0o755);
  await chmod(path.join(tlsFixture, "key.pem"), 0o644);
  await writeFile(path.join(tlsFixture, "server.mjs"), `
    import {createServer} from "node:https";
    import {readFileSync} from "node:fs";
    createServer({key:readFileSync("/run/renderer-test/key.pem"),cert:readFileSync("/run/renderer-test/cert.pem")}, async (request,response) => {
      const chunks=[]; for await (const chunk of request) chunks.push(chunk);
      response.setHeader("Content-Type","application/json");
      response.end(JSON.stringify({method:request.method, label:JSON.parse(Buffer.concat(chunks).toString()).label, tls:!!request.socket.encrypted}));
    }).listen(3443,"127.0.0.1");
  `);

  await exec("docker", [
    "run",
    "-d",
    "--name",
    name,
    "--label",
    "com.plasmic.codex.task=react19-renderer-test",
    "--security-opt",
    `seccomp=${fileURLToPath(new URL("../docker-seccomp.json", import.meta.url))}`,
    "--cap-add",
    "SYS_ADMIN",
    "-e",
    "NODE_ENV=test",
    "--mount",
    `type=bind,src=${tlsFixture},dst=/run/renderer-test,readonly`,
    "-e",
    "NODE_EXTRA_CA_CERTS=/run/renderer-test/cert.pem",
    "-e",
    "CODEGEN_HOST=https://renderer-assets.invalid",
    "-p",
    "127.0.0.1::3010",
    image,
    "bash",
    "tools/run.bash",
    "src/main.ts",
  ]);
  await exec("docker", [
    "exec",
    name,
    "node",
    "-e",
    `
    const assert = require("node:assert/strict");
    const sdkRequire = require("node:module").createRequire(require.resolve("@plasmicapp/loader-react"));
    assert.equal(require("react").version, "19.3.1");
    assert.equal(sdkRequire("react"), require("react"));
    const query = sdkRequire("@plasmicapp/query");
    assert.equal(typeof query.usePlasmicPrepass, "function");
    assert.equal("isPlasmicPrepass" in query, false);
    assert.equal(typeof sdkRequire("react-dom/static").prerender, "function");
  `,
  ]);
  console.log(
    "PASS: deployed SDK uses one React 19 instance and the new public prepass API",
  );
  await exec("docker", ["exec", "-d", name, "node", "/run/renderer-test/server.mjs"]);
  await exec("docker", ["exec", name, "node", "-e", `
    (async () => { for(let n=0;n<50;n++) { try { const response=await fetch("https://127.0.0.1:3443/data",{method:"POST",body:JSON.stringify({label:"ready"})}); if(response.ok)return; }catch{} await new Promise(resolve=>setTimeout(resolve,100)); } process.exitCode=1; })();
  `]);
  const { stdout } = await exec("docker", ["port", name, "3010/tcp"]);
  const origin = `http://${stdout.trim()}`;
  const health = () =>
    fetch(`${origin}/healthcheck`, { signal: AbortSignal.timeout(2000) });
  let ready = false;
  for (let i = 0; i < 100; i++) {
    try {
      ready = (await health()).ok;
    } catch {}
    if (ready) {
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  assert(ready, "Renderer did not start");
  const render = async (componentProps, options = {}) => {
    const response = await fetch(`${origin}/api/v1/render`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId,
        component: "RendererPage",
        version: "1.0.0",
        projectToken: "test-token",
        bundle: renderData,
        componentProps,
        ...options,
      }),
      signal: AbortSignal.timeout(40000),
    });
    return { response, text: await response.text() };
  };
  const plain = await render({ label: "SSR <escaped>" });
  assert.equal(plain.response.status, 200, plain.text);
  assert.match(JSON.parse(plain.text).html, /SSR &lt;escaped&gt;/);
  assert.match(JSON.parse(plain.text).html, /loading/);
  console.log(
    "PASS: sandboxed SSR returns awaited HTML and escapes component props",
  );

  const httpQuery = await render({ label: "HTTP", dataUrl: "http://127.0.0.1:3010/healthcheck" }, {prepass:true});
  assert.equal(httpQuery.response.status, 200, httpQuery.text);
  assert.match(JSON.parse(httpQuery.text).html, /networkStatus(?:&quot;|"):200/);
  console.log("PASS: sandboxed native prepass supports HTTP GET");

  const results = await Promise.all(
    ["First", "Second", "Third"].map(async (label) => {
      const result = await render(
        { label, dataUrl: "https://127.0.0.1:3443/data", post: true },
        { prepass: true, hydrate: true, embedHydrate: true },
      );
      assert.equal(result.response.status, 200, result.text);
      const { html } = JSON.parse(result.text);
      assert.match(html, new RegExp(label));
      return html;
    }),
  );
  console.log("PASS: concurrent native prepass performs trusted HTTPS POST requests inside the sandbox");

  web = createServer((request, response) => {
    response.setHeader("Content-Type", "text/html");
    response.end(`<!doctype html>${results[0]}`);
  });
  await new Promise((resolve) => web.listen(0, "127.0.0.1", resolve));
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.addInitScript(() => { window.queryFetches = 0; });
  await page.route("https://renderer-assets.invalid/static/js/loader-hydrate.js", (route) => route.fulfill({ contentType: "application/javascript", body: hydrationScript }));
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") {
      errors.push(message.text());
    }
  });
  await page.goto(`http://127.0.0.1:${web.address().port}`);
  await page.getByRole("button", { name: "Count 0" }).click();
  assert.equal(await page.getByRole("button", { name: "Count 1" }).count(), 1);
  assert.deepEqual(JSON.parse(await page.getByLabel("Query").textContent()), {
    label: "First",
    zero: 0,
    disabled: false,
    empty: "",
    networkStatus: 200,
    network: {method:"POST",label:"First",tls:true},
  });
  assert.equal(await page.locator("[data-plasmic-component]").getAttribute("data-plasmic-hydrated"), "true");
  assert.equal(await page.evaluate(() => window.queryFetches), 0);
  assert.deepEqual(errors, []);
  console.log(
    `PASS: production hydration artifact ${hydration.artifactHash} hydrates embedded data without refetch or errors; interaction updates`,
  );

  const recoverable = await render({ fail: true });
  assert.equal(recoverable.response.status, 200);
  assert.match(JSON.parse(recoverable.text).html, /Expected renderer failure/);
  const failure = await render(
    { fail: true },
    {
      bundle: {
        ...renderData,
        bundle: {
          ...renderData.bundle,
          disableRootLoadingBoundaryByDefault: true,
        },
      },
    },
  );
  assert.equal(failure.response.status, 500);
  assert((await health()).ok, "Service must survive a rendering error");
  const seccomp = await render({ probeSeccomp: true });
  assert.equal(
    seccomp.response.status,
    500,
    "Seccomp must reject the disallowed getuid syscall",
  );
  assert.match(seccomp.text, /SIGSYS|Bad system call|159/);
  assert((await health()).ok, "Service must survive a forbidden syscall");
  console.log(
    "PASS: rendering errors and forbidden syscalls terminate child work without killing the service",
  );
  const timeout = await render({ hang: true });
  assert.equal(timeout.response.status, 500);
  assert.match(timeout.text, /timed out/);
  assert(
    (await health()).ok,
    "Service must survive a timed out rendering child",
  );
  const children = await exec("docker", ["exec", name, "ps", "-o", "args"]);
  assert(
    !children.stdout.includes("src/renderer.ts"),
    "Timed out rendering child must be reaped",
  );
  console.log(
    "PASS: infinite rendering is killed after 30 seconds without leaving child processes",
  );
} catch (error) {
  const logs = await exec("docker", ["logs", "--tail", "35", name]).catch(
    () => null,
  );
  if (logs) {
    console.error(logs.stdout, logs.stderr);
  }
  throw error;
} finally {
  await browser?.close();
  if (web) {
    await new Promise((resolve) => web.close(resolve));
  }
  await exec("docker", ["rm", "-f", name]).catch(() => {});
  await rm(tlsFixture, { recursive: true, force: true });
}
